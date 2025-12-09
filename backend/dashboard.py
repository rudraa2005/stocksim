from flask import Blueprint, render_template,jsonify,request
from flask_jwt_extended import jwt_required, get_jwt_identity
dashboard_bp = Blueprint("dashboard", __name__)
import yfinance as yf
import pandas as pd
import random
import ssl
from urllib.request import urlopen
import firebase_admin
from firebase_admin import credentials, firestore
from flask import current_app as app
import traceback

def json_error(status=500, message="Internal server error", body=None):
    resp = {"error": message}
    if body:
        resp["detail"] = body
    return jsonify(resp), status

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
    uid=request.args.get("uid")
    if not uid:
        return jsonify({
            "error":"No UID"
        }),400
    db = get_db() 
    user_ref=db.collection("users").document(uid)
    doc= user_ref.get()
    if doc.exists:
        data = doc.to_dict()
        balance = data.get("balance", 0)
        profit = data.get("profit", 0)
        loss = data.get("loss", 0)
        name = data.get("name")
        return jsonify({
            "name": name,
            "balance": balance,
            "profit": profit,
            "loss": loss,
            "pl": profit - loss
        })
    else:
        return jsonify({"error":"Not Found"}),400
    
@dashboard_bp.route("/dashboard/updated_balance",methods=["POST"])
def update_balance():
    data = request.get_json()
    uid = data.get("uid")
    symbol = data.get("symbol")
    new_balance= data.get("balance")
    
    ticker = yf.Ticker(symbol)
    history = ticker.history(period="1d", interval="5m")
    live_price= history['Close'].iloc[-1] 
    
    curr_price = float(data.get("price"))
    
    quantity = data.get("quantity")
    profit= round((live_price-curr_price)*quantity,2) if live_price>curr_price else 0
    loss = round((curr_price - live_price)*quantity,2) if curr_price>live_price else 0
    totalcost= data.get("totalCost")
    print("balance:", new_balance)
    print("profit:", profit)
    print("loss:", loss)
    print("symbol:", symbol)
    print("curr_price:", curr_price)
    print("live_price:", live_price)
    print("quantity:", quantity)
    db = get_db() 
    user_ref = db.collection("users").document(uid)
    user_ref.set({
        "balance": new_balance,
        "profit": profit,
        "loss": loss,
        "pl": profit - loss,
    }, merge=True)
    db.collection("users").document(uid).collection("trades").add({
        "symbol": symbol,
        "quantity": quantity,
        "buy_price": curr_price,
        "live_price": live_price,
        "timestamp": firestore.SERVER_TIMESTAMP,
        "pl": profit - loss,
        "buy": True
    })
    return jsonify({"message":"success", "balance":"balance"})
    
@dashboard_bp.route("/dashboard/update_sell", methods=["POST"])
def update_sell():
    data = request.get_json()
    
    uid = data["uid"]
    symbol = data["symbol"]
    quantity = data["quantity"]
    price = data["price"]
    total_value = data["totalValue"]
    balance = data["balance"]
    new_quantity = data["newQuantity"]
    timestamp = data["timestamp"]
    db = get_db() 
    user_ref = db.collection("users").document(uid)
    ticker = yf.Ticker(symbol)
    history = ticker.history(period="1d", interval="5m")
    live_price= history['Close'].iloc[-1] 
    # Update balance
    user_ref.update({
        "balance": balance
    })

    # Log the sell trade
    trade_data = {
        "symbol": symbol,
        "quantity": new_quantity, # still store as positive
        "oldQuantity":quantity,
        "price": price,
        "total": total_value,
        "timestamp": timestamp,
        "livePrice":live_price,
        "sell": True  # key part
    }
    db.collection("users").document(uid).collection("trades").add(trade_data)

    return jsonify({"message": "Sell recorded and balance updated"}), 200

@dashboard_bp.route("/dashboard/watchlist", methods=["GET"])
def watchlist():
    try:
        url= "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
        context = ssl._create_unverified_context()  
        html = urlopen(url, context=context)
        table = pd.read_html(html)[0]
        all_tickers= table["Symbol"].tolist()      #creating a list this becomes an array when we jsonify it 
        random_tickers = random.sample(all_tickers, 5)
        
        stock_data=[] #empty array to store the data
        for ticker in random_tickers:
            stock=yf.Ticker(ticker)
            info = stock.info
            stock_data.append({
                "name":info.get('shortName',ticker),
                "symbol": ticker,
                "price": info.get("currentPrice") 
            })
        
        return jsonify(stock_data)
        
    except Exception as e:
        app.logger.error("Watchlist exception: %s\n%s", e, traceback.format_exc())
        return json_error(500, "Failed to load watchlist")
        
