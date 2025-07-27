from flask import Blueprint, render_template, jsonify
from flask import request
trade_bp = Blueprint("trade", __name__)

import yfinance as yf
import pandas as pd
import ssl
import firebase_admin
from firebase_admin import credentials, auth, firestore 

from urllib.request import urlopen
import time

def get_db():
    return firestore.client()
# Cache dictionary (10-minute cache)
cached_trade_stocks = {
    "timestamp": 0,
    "data": []
}
@trade_bp.route("/trade")
def trade():
        return render_template("trade.html")
    
@trade_bp.route("/trade/stocks")
def get_stocks():
    try:
        now = time.time()
        cache_duration = 60000000000000000000000000000000000000000

        # Use cached data if fresh
        if cached_trade_stocks["data"] and now - cached_trade_stocks["timestamp"] < cache_duration:
            print("Using cached /trade/stocks")
            return jsonify(cached_trade_stocks["data"])

        # Otherwise, fetch fresh data
        url = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies"
        context = ssl._create_unverified_context()
        html = urlopen(url, context=context)
        table = pd.read_html(html)[0]
        all_tickers = table["Symbol"].tolist()

        stock_data = []
        for ticker in all_tickers[:50]:
            try:
                stock = yf.Ticker(ticker)
                info = stock.info
                stock_data.append({
                    "name": info.get('shortName', ticker),
                    "symbol": ticker,
                    "price": info.get("currentPrice")
                })
            except Exception as e:
                print(f"Error fetching {ticker}: {e}")
                continue

        # Update the cache
        cached_trade_stocks["timestamp"] = now
        cached_trade_stocks["data"] = stock_data

        return jsonify(stock_data)

    except Exception as e:
        return jsonify({"error": str(e)}), 400     
@trade_bp.route("/trade/buysell")
def buysell():
    return render_template("buy-sell.html")

@trade_bp.route('/api/stock-data')
def stock_data():
    symbol = request.args.get('symbol')
    if not symbol:
        return jsonify({'error': 'Missing symbol'}), 400

    stock = yf.Ticker(symbol)
    hist = stock.history(period='1d', interval='5m')  # 1 day, 5 min intervals

    prices = hist['Close'].tolist()
    labels = hist.index.strftime('%H:%M').tolist()

    return jsonify({
        'labels': labels,
        'prices': prices
    })
