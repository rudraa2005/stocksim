from flask import Blueprint, render_template, jsonify, request, current_app as app
import yfinance as yf
import pandas as pd
import time
import random
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

trade_bp = Blueprint("trade", __name__)

# Firestore helper (keep your existing function)
import firebase_admin
from firebase_admin import firestore
def get_db():
    return firestore.client()

# ----------------- requests helper -----------------
def requests_session(retries=2, backoff=0.3, status_forcelist=(429,500,502,503,504)):
    s = requests.Session()
    retry = Retry(total=retries, backoff_factor=backoff, status_forcelist=status_forcelist, allowed_methods=["GET","POST"])
    s.mount("https://", HTTPAdapter(max_retries=retry))
    s.mount("http://", HTTPAdapter(max_retries=retry))
    return s

def fetch_text_with_ua(url, timeout=8):
    s = requests_session()
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
        "Accept": "text/plain, text/html, */*",
        "Referer": "https://www.google.com/"
    }
    r = s.get(url, headers=headers, timeout=timeout)
    r.raise_for_status()
    return r.text
# ---------------------------------------------------

# Cache dictionary (10-minute cache)
cached_trade_stocks = {"timestamp": 0, "data": []}
CACHE_DURATION = 600  # seconds (10 minutes)

@trade_bp.route("/trade")
def trade():
    return render_template("trade.html")

@trade_bp.route("/trade/stocks")
def get_stocks():
    """
    Returns a JSON array of stock objects: [{name, symbol, price}, ...]
    Uses a cached result for CACHE_DURATION seconds to avoid repeated external calls.
    Uses a stable raw GitHub list of S&P tickers rather than scraping Wikipedia.
    """
    try:
        now = time.time()

        # Return cached data if fresh
        if cached_trade_stocks["data"] and now - cached_trade_stocks["timestamp"] < CACHE_DURATION:
            app.logger.info("Using cached /trade/stocks")
            return jsonify(cached_trade_stocks["data"])

        # Preferred: read tickers from stable GitHub raw dataset (faster & reliable)
        tickers_url = "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents_symbols.txt"

        try:
            text = fetch_text_with_ua(tickers_url, timeout=6)
            all_tickers = [line.strip() for line in text.splitlines() if line.strip()]
            if not all_tickers:
                raise ValueError("Empty ticker list from GitHub")
        except Exception as e:
            app.logger.warning("Failed to fetch tickers list from GitHub: %s. Falling back to small builtin list.", e)
            # fallback small list (guaranteed)
            all_tickers = ["AAPL", "MSFT", "AMZN", "GOOGL", "TSLA", "NVDA", "META", "BRK-B", "JPM", "V"]

        # Limit to first N or sample for broader variety
        sample_size = min(50, len(all_tickers))
        sample_tickers = all_tickers[:sample_size]  # stable selection (not random on every request)

        stock_data = []
        # Fetch minimal info for each ticker. Use try/except per ticker to avoid one failure breaking all.
        for ticker in sample_tickers:
            try:
                t = yf.Ticker(ticker)
                info = t.info or {}
                stock_data.append({
                    "name": info.get("shortName", ticker),
                    "symbol": ticker,
                    "price": info.get("currentPrice")  # can be None
                })
            except Exception as e:
                app.logger.debug("Error fetching data for %s: %s", ticker, e)
                stock_data.append({"name": ticker, "symbol": ticker, "price": None})

        # update cache
        cached_trade_stocks["timestamp"] = now
        cached_trade_stocks["data"] = stock_data

        return jsonify(stock_data)

    except Exception as e:
        app.logger.error("get_stocks error: %s", e, exc_info=True)
        return jsonify({"error": "Failed to load stocks"}), 500

@trade_bp.route("/trade/buysell")
def buysell():
    return render_template("buy-sell.html")

@trade_bp.route('/api/stock-data')
def stock_data():
    """
    Returns historical intraday data for a specific symbol for the last day
    in JSON: { labels: [...], prices: [...] }
    """
    symbol = request.args.get('symbol')
    if not symbol:
        return jsonify({'error': 'Missing symbol'}), 400

    try:
        # use yfinance to download intraday history
        # small timeout: wrap in try/except to return a friendly error if yfinance fails
        try:
            hist = yf.Ticker(symbol).history(period='1d', interval='5m')
        except Exception as e:
            app.logger.error("yfinance history error for %s: %s", symbol, e, exc_info=True)
            return jsonify({'error': 'Failed to fetch stock history'}), 500

        if hist.empty:
            return jsonify({'error': 'No data available for symbol'}), 404

        prices = hist['Close'].tolist()
        labels = hist.index.strftime('%H:%M').tolist()

        return jsonify({'labels': labels, 'prices': prices})
    except Exception as e:
        app.logger.error("stock_data error for %s: %s", symbol, e, exc_info=True)
        return jsonify({'error': 'Server error fetching stock data'}), 500
