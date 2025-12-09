from flask import Blueprint, render_template,jsonify,request
from flask_jwt_extended import jwt_required, get_jwt_identity
portfolio_bp = Blueprint("portfolio", __name__)
import yfinance as yf
import pandas as pd
import random
import ssl
from urllib.request import urlopen
import firebase_admin
from firebase_admin import credentials, firestore
from firebase_admin import auth

def get_db():
    return firestore.client()

@portfolio_bp.route("/portfolio")
def portfolio():
    return render_template("portfolio.html")

@portfolio_bp.route("/portfolio/trades")
def trades():
    uid=request.args.get("uid")
    db = get_db() 
    user_ref=db.collection("users").document(uid).collection("trades")
    docs = user_ref.stream()
    result=[]
    for doc in docs:
        trade_data= doc.to_dict()
        trade_data["id"] = doc.id
        result.append(trade_data)
    return jsonify(result)

@portfolio_bp.route("/portfolio/chart-data")
def chart_data():
    """
    Returns chart data showing buy and sell transactions over time
    """
    uid = request.args.get("uid")
    if not uid:
        return jsonify({"error": "Missing uid"}), 400
    
    try:
        db = get_db()
        user_ref = db.collection("users").document(uid).collection("trades")
        docs = user_ref.stream()
        
        trades = []
        for doc in docs:
            trade_data = doc.to_dict()
            trade_data["id"] = doc.id
            trades.append(trade_data)
        
        # Sort by timestamp
        trades.sort(key=lambda x: x.get("timestamp", {}).get("_seconds", 0) if isinstance(x.get("timestamp"), dict) else 0)
        
        # Process trades for chart
        buy_data = []
        sell_data = []
        labels = []
        
        cumulative_buy = 0
        cumulative_sell = 0
        
        for trade in trades:
            timestamp = trade.get("timestamp")
            date = None
            
            # Handle different timestamp formats
            if isinstance(timestamp, dict) and "_seconds" in timestamp:
                date = pd.Timestamp.fromtimestamp(timestamp["_seconds"])
            elif isinstance(timestamp, (int, float)):
                date = pd.Timestamp.fromtimestamp(timestamp / 1000 if timestamp > 1e10 else timestamp)
            else:
                continue
            
            if trade.get("buy"):
                quantity = trade.get("quantity", 0)
                cumulative_buy += quantity
                buy_data.append(cumulative_buy)
                sell_data.append(cumulative_sell)
                labels.append(date.strftime("%Y-%m-%d %H:%M"))
            elif trade.get("sell"):
                quantity = trade.get("quantity", 0)
                cumulative_sell += quantity
                buy_data.append(cumulative_buy)
                sell_data.append(cumulative_sell)
                labels.append(date.strftime("%Y-%m-%d %H:%M"))
        
        # If no trades, return empty data
        if not labels:
            return jsonify({
                "labels": [],
                "buyData": [],
                "sellData": []
            })
        
        return jsonify({
            "labels": labels,
            "buyData": buy_data,
            "sellData": sell_data
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
        
         
