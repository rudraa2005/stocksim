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
    Returns chart data showing cumulative buy and sell trade values over time.
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
        
        # ---- Parse timestamps robustly ----
        def parse_timestamp(ts):
            """Handle all possible Firestore timestamp formats."""
            import datetime as dt
            if ts is None:
                return None
            # Firestore DatetimeWithNanoseconds (has .timestamp() method)
            if hasattr(ts, 'timestamp'):
                return pd.Timestamp.fromtimestamp(ts.timestamp())
            # Dict format {"_seconds": ..., "_nanoseconds": ...}
            if isinstance(ts, dict) and "_seconds" in ts:
                return pd.Timestamp.fromtimestamp(ts["_seconds"])
            # Raw epoch (ms or seconds)
            if isinstance(ts, (int, float)):
                return pd.Timestamp.fromtimestamp(ts / 1000 if ts > 1e10 else ts)
            # String format
            if isinstance(ts, str):
                try:
                    return pd.Timestamp(ts)
                except Exception:
                    return None
            return None

        # Parse and sort trades by time
        parsed_trades = []
        for trade in trades:
            ts = parse_timestamp(trade.get("timestamp"))
            if ts is None:
                # If no timestamp, use current time as fallback
                ts = pd.Timestamp.now()
            parsed_trades.append((ts, trade))
        
        parsed_trades.sort(key=lambda x: x[0])
        
        # Build chart data: cumulative values
        buy_data = []
        sell_data = []
        labels = []
        
        cumulative_buy_value = 0
        cumulative_sell_value = 0
        
        for ts, trade in parsed_trades:
            quantity = float(trade.get("quantity", 0))
            price = float(trade.get("buy_price", 0) or trade.get("price", 0) or 0)
            trade_value = price * quantity
            
            if trade.get("buy"):
                cumulative_buy_value += trade_value
            elif trade.get("sell"):
                cumulative_sell_value += trade_value
            
            buy_data.append(round(cumulative_buy_value, 2))
            sell_data.append(round(cumulative_sell_value, 2))
            labels.append(ts.strftime("%b %d, %H:%M"))
        
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
        
         
