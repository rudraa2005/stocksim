from flask import Blueprint, render_template, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
dashboard_bp = Blueprint("dashboard", __name__)
import yfinance as yf
import pandas as pd
import random
import ssl
from urllib.request import urlopen
import firebase_admin
import requests
from firebase_admin import credentials, firestore
from flask import current_app as app
import traceback

def json_error(status=500, message="Internal server error", body=None):
    resp = {"error": message}
    if body:
        resp["detail"] = body
    return jsonify(resp), status


def get_db():
    return firestore.client()
cached_stocks = None

@dashboard_bp.route("/dashboard")
def dashboard_home():
    return render_template("dashboard.html")

@dashboard_bp.route("/dashboard/balance", methods=["GET"])
def balance():
    uid = request.args.get("uid")
    app.logger.info("Balance request for uid: %r", uid)
    if not uid:
        return jsonify({"error": "No UID provided"}), 400

    db = get_db()
    user_ref = db.collection("users").document(uid)
    doc = user_ref.get()
    if not doc.exists:
        app.logger.info("User doc not found for uid: %r", uid)
        return jsonify({"error": "Not Found"}), 404

    data = doc.to_dict() or {}
    balance = float(data.get("balance") or 0.0)
    profit = float(data.get("profit") or 0.0)
    loss = float(data.get("loss") or 0.0)
    name = data.get("name", "")

    return jsonify({
        "name": name,
        "balance": balance,
        "profit": profit,
        "loss": loss,
        "pl": profit - loss
    }), 200
    
@dashboard_bp.route("/dashboard/updated_balance", methods=["POST"])
def update_balance():
    data = request.get_json()
    uid = data.get("uid")
    symbol = data.get("symbol")
    quantity = data.get("quantity")
    
    if not uid or not symbol or not quantity:
        return jsonify({"error": "Missing required fields"}), 400
    
    quantity = float(quantity)
    if quantity <= 0:
        return jsonify({"error": "Quantity must be positive"}), 400

    # ---- SERVER-SIDE BALANCE VALIDATION ----
    # Always re-read balance from Firestore to prevent race conditions
    db = get_db()
    user_ref = db.collection("users").document(uid)
    doc = user_ref.get()
    if not doc.exists:
        return jsonify({"error": "User not found"}), 404
    
    user_data = doc.to_dict() or {}
    current_balance = float(user_data.get("balance") or 0.0)
    
    # Get live price
    ticker = yf.Ticker(symbol)
    history = ticker.history(period="1d", interval="5m")
    if history.empty:
        return jsonify({"error": "Could not fetch price for symbol"}), 500
    live_price = float(history['Close'].iloc[-1])
    
    curr_price = float(data.get("price", live_price))
    total_cost = live_price * quantity
    
    # CRITICAL: Validate balance BEFORE executing the trade
    if total_cost > current_balance:
        return jsonify({
            "error": "Insufficient balance",
            "balance": current_balance,
            "required": round(total_cost, 2)
        }), 403
    
    new_balance = round(current_balance - total_cost, 2)
    profit = round((live_price - curr_price) * quantity, 2) if live_price > curr_price else 0
    loss = round((curr_price - live_price) * quantity, 2) if curr_price > live_price else 0
    
    # Update user balance
    user_ref.set({
        "balance": new_balance,
        "profit": profit,
        "loss": loss,
        "pl": profit - loss,
    }, merge=True)
    
    # Record the trade
    db.collection("users").document(uid).collection("trades").add({
        "symbol": symbol,
        "quantity": quantity,
        "buy_price": curr_price,
        "live_price": live_price,
        "timestamp": firestore.SERVER_TIMESTAMP,
        "pl": profit - loss,
        "buy": True
    })
    
    return jsonify({
        "message": "success",
        "balance": new_balance,
        "totalCost": round(total_cost, 2)
    })
    
@dashboard_bp.route("/dashboard/update_sell", methods=["POST"])
def update_sell():
    data = request.get_json()
    
    uid = data.get("uid")
    symbol = data.get("symbol")
    quantity = data.get("quantity")
    
    if not uid or not symbol or not quantity:
        return jsonify({"error": "Missing required fields"}), 400
    
    quantity = float(quantity)
    if quantity <= 0:
        return jsonify({"error": "Quantity must be positive"}), 400
    
    price = float(data.get("price", 0))
    total_value = float(data.get("totalValue", 0))
    new_quantity = data.get("newQuantity", 0)
    timestamp = data.get("timestamp")
    
    db = get_db() 
    user_ref = db.collection("users").document(uid)
    
    # Get live price
    ticker = yf.Ticker(symbol)
    history = ticker.history(period="1d", interval="5m")
    if history.empty:
        return jsonify({"error": "Could not fetch price for symbol"}), 500
    live_price = float(history['Close'].iloc[-1])
    
    # SERVER-SIDE: Validate the user owns enough shares
    trades_ref = db.collection("users").document(uid).collection("trades")
    trades_docs = trades_ref.stream()
    owned_quantity = 0
    for trade_doc in trades_docs:
        trade_data = trade_doc.to_dict()
        if trade_data.get("symbol") == symbol:
            if trade_data.get("sell"):
                owned_quantity -= float(trade_data.get("quantity", 0))
            elif trade_data.get("buy"):
                owned_quantity += float(trade_data.get("quantity", 0))
    
    if quantity > owned_quantity:
        return jsonify({
            "error": "Insufficient shares",
            "owned": owned_quantity,
            "requested": quantity
        }), 403
    
    # Re-read balance from Firestore
    doc = user_ref.get()
    user_data = doc.to_dict() or {}
    current_balance = float(user_data.get("balance") or 0.0)
    
    sell_value = live_price * quantity
    new_balance = round(current_balance + sell_value, 2)
    
    user_ref.update({
        "balance": new_balance
    })

    trade_data = {
        "symbol": symbol,
        "quantity": quantity,
        "oldQuantity": float(data.get("quantity", quantity)),
        "price": price,
        "total": total_value,
        "timestamp": timestamp,
        "livePrice": live_price,
        "sell": True  
    }
    db.collection("users").document(uid).collection("trades").add(trade_data)

    return jsonify({
        "message": "Sell recorded and balance updated",
        "balance": new_balance,
        "sellValue": round(sell_value, 2)
    }), 200

@dashboard_bp.route("/dashboard/watchlist", methods=["GET"])
def watchlist():
    try:
        url = "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv"
        r = requests.get(url, timeout=8)
        r.raise_for_status()

        lines = r.text.strip().splitlines()
        # CSV format: Symbol,Name,Sector — skip header
        tickers = []
        for line in lines[1:]:
            parts = line.split(",")
            if parts and parts[0].strip():
                tickers.append(parts[0].strip())
        
        if not tickers:
            tickers = ["AAPL", "MSFT", "AMZN", "GOOGL", "TSLA", "NVDA", "META", "JPM", "V", "UNH"]
        
        random_tickers = random.sample(tickers, min(5, len(tickers)))

        stock_data = []
        for t in random_tickers:
            try:
                ticker = yf.Ticker(t)
                info = ticker.info
                # Try to get live price from history if currentPrice is not available
                current_price = info.get("currentPrice")
                if current_price is None:
                    history = ticker.history(period="1d", interval="1m")
                    if not history.empty:
                        current_price = float(history['Close'].iloc[-1])
                
                # Get previous close for change calculation
                prev_close = info.get("previousClose", current_price)
                change = current_price - prev_close if current_price and prev_close else 0
                change_percent = (change / prev_close * 100) if prev_close else 0
                
                stock_data.append({
                    "name": info.get("shortName", t),
                    "symbol": t,
                    "price": current_price,
                    "previousClose": prev_close,
                    "change": change,
                    "changePercent": change_percent
                })
            except Exception as e:
                app.logger.error(f"Error fetching data for {t}: {str(e)}")
                # Add stock with minimal data if fetch fails
                stock_data.append({
                    "name": t,
                    "symbol": t,
                    "price": None,
                    "previousClose": None,
                    "change": 0,
                    "changePercent": 0
                })

        return jsonify(stock_data)

    except Exception as e:
        app.logger.error(f"Error in watchlist endpoint: {str(e)}")
        return jsonify({"error": "Failed to load watchlist"}), 500

@dashboard_bp.route("/dashboard/live-prices", methods=["POST"])
def live_prices():
    try:
        data = request.get_json()
        symbols = data.get("symbols", [])
        
        if not symbols:
            return jsonify({"error": "No symbols provided"}), 400
        
        price_data = []
        for symbol in symbols:
            try:
                ticker = yf.Ticker(symbol)
                info = ticker.info
                
                # Get live price
                current_price = info.get("currentPrice")
                if current_price is None:
                    history = ticker.history(period="1d", interval="1m")
                    if not history.empty:
                        current_price = float(history['Close'].iloc[-1])
                
                # Get previous close for change calculation
                prev_close = info.get("previousClose", current_price)
                change = current_price - prev_close if current_price and prev_close else 0
                change_percent = (change / prev_close * 100) if prev_close else 0
                
                price_data.append({
                    "symbol": symbol,
                    "price": current_price,
                    "previousClose": prev_close,
                    "change": change,
                    "changePercent": change_percent
                })
            except Exception as e:
                app.logger.error(f"Error fetching live price for {symbol}: {str(e)}")
                price_data.append({
                    "symbol": symbol,
                    "price": None,
                    "previousClose": None,
                    "change": 0,
                    "changePercent": 0
                })
        
        return jsonify(price_data)
    except Exception as e:
        app.logger.error(f"Error in live-prices endpoint: {str(e)}")
        return jsonify({"error": "Failed to fetch live prices"}), 500
