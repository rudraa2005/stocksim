from flask import Blueprint, render_template, jsonify, request, current_app as app
import yfinance as yf
import pandas as pd
import time
import threading
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

trade_bp = Blueprint("trade", __name__)

# Firestore helper
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

# ============ PROGRESSIVE STOCK CACHE (array-based, no Redis) ============
# Phase 1: ticker symbols + names cached for 24h
# Phase 2: prices fetched on-demand per selected stock

TICKER_CACHE = {
    "timestamp": 0,
    "tickers": [],        # full list of {symbol, name}
    "loading": False,
    "initial_ready": False,
    "all_ready": False,
}
TICKER_CACHE_DURATION = 86400  # 24 hours for ticker list

# Built-in fallback tickers (top stocks by market cap)
BUILTIN_TICKERS = [
    {"symbol": "AAPL", "name": "Apple Inc."},
    {"symbol": "MSFT", "name": "Microsoft Corporation"},
    {"symbol": "AMZN", "name": "Amazon.com Inc."},
    {"symbol": "GOOGL", "name": "Alphabet Inc."},
    {"symbol": "GOOG", "name": "Alphabet Inc. Class C"},
    {"symbol": "TSLA", "name": "Tesla Inc."},
    {"symbol": "NVDA", "name": "NVIDIA Corporation"},
    {"symbol": "META", "name": "Meta Platforms Inc."},
    {"symbol": "BRK-B", "name": "Berkshire Hathaway Inc."},
    {"symbol": "JPM", "name": "JPMorgan Chase & Co."},
    {"symbol": "V", "name": "Visa Inc."},
    {"symbol": "UNH", "name": "UnitedHealth Group Inc."},
    {"symbol": "JNJ", "name": "Johnson & Johnson"},
    {"symbol": "WMT", "name": "Walmart Inc."},
    {"symbol": "MA", "name": "Mastercard Inc."},
    {"symbol": "PG", "name": "Procter & Gamble Co."},
    {"symbol": "HD", "name": "The Home Depot Inc."},
    {"symbol": "XOM", "name": "Exxon Mobil Corporation"},
    {"symbol": "DIS", "name": "The Walt Disney Company"},
    {"symbol": "BAC", "name": "Bank of America Corp."},
    {"symbol": "NFLX", "name": "Netflix Inc."},
    {"symbol": "ADBE", "name": "Adobe Inc."},
    {"symbol": "CRM", "name": "Salesforce Inc."},
    {"symbol": "CSCO", "name": "Cisco Systems Inc."},
    {"symbol": "PFE", "name": "Pfizer Inc."},
    {"symbol": "TMO", "name": "Thermo Fisher Scientific"},
    {"symbol": "AVGO", "name": "Broadcom Inc."},
    {"symbol": "COST", "name": "Costco Wholesale Corp."},
    {"symbol": "ABT", "name": "Abbott Laboratories"},
    {"symbol": "NKE", "name": "Nike Inc."},
    {"symbol": "KO", "name": "The Coca-Cola Company"},
    {"symbol": "PEP", "name": "PepsiCo Inc."},
    {"symbol": "MRK", "name": "Merck & Co. Inc."},
    {"symbol": "LLY", "name": "Eli Lilly and Company"},
    {"symbol": "ABBV", "name": "AbbVie Inc."},
    {"symbol": "ORCL", "name": "Oracle Corporation"},
    {"symbol": "ACN", "name": "Accenture plc"},
    {"symbol": "DHR", "name": "Danaher Corporation"},
    {"symbol": "MCD", "name": "McDonald's Corporation"},
    {"symbol": "TXN", "name": "Texas Instruments Inc."},
    {"symbol": "AMD", "name": "Advanced Micro Devices"},
    {"symbol": "INTC", "name": "Intel Corporation"},
    {"symbol": "QCOM", "name": "Qualcomm Inc."},
    {"symbol": "INTU", "name": "Intuit Inc."},
    {"symbol": "AMGN", "name": "Amgen Inc."},
    {"symbol": "GS", "name": "Goldman Sachs Group"},
    {"symbol": "MS", "name": "Morgan Stanley"},
    {"symbol": "CAT", "name": "Caterpillar Inc."},
    {"symbol": "BA", "name": "The Boeing Company"},
    {"symbol": "PYPL", "name": "PayPal Holdings Inc."},
]

def _fetch_all_tickers_background():
    """Background thread: fetch full ticker list from GitHub and store in cache."""
    try:
        tickers_url = "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents.csv"
        text = fetch_text_with_ua(tickers_url, timeout=10)
        lines = text.strip().splitlines()

        all_tickers = []
        seen = set()
        # CSV format: Symbol,Name,Sector
        for line in lines[1:]:  # skip header
            parts = line.split(",")
            if len(parts) >= 2:
                symbol = parts[0].strip()
                name = parts[1].strip()
                if symbol and symbol not in seen:
                    seen.add(symbol)
                    all_tickers.append({"symbol": symbol, "name": name})

        if all_tickers:
            TICKER_CACHE["tickers"] = all_tickers
            TICKER_CACHE["all_ready"] = True
            TICKER_CACHE["timestamp"] = time.time()
            app.logger.info("Background ticker fetch complete: %d tickers", len(all_tickers))
        else:
            app.logger.warning("Background ticker fetch returned empty list, keeping builtin fallback")

    except Exception as e:
        app.logger.error("Background ticker fetch failed: %s", e)
    finally:
        TICKER_CACHE["loading"] = False


@trade_bp.route("/trade")
def trade():
    return render_template("trade.html")

@trade_bp.route("/trade/stocks")
def get_stocks():
    """
    Returns a JSON array of stock objects: [{name, symbol}, ...]
    Uses progressive caching:
    - Immediately returns builtin tickers if cache is empty
    - Kicks off background fetch for the full S&P 500 list
    - Once loaded, returns the full list
    """
    try:
        now = time.time()

        # If cache is fresh and fully loaded, return it
        if TICKER_CACHE["all_ready"] and now - TICKER_CACHE["timestamp"] < TICKER_CACHE_DURATION:
            return jsonify({"stocks": TICKER_CACHE["tickers"], "complete": True})

        # If not loading yet, start background fetch
        if not TICKER_CACHE["loading"]:
            TICKER_CACHE["loading"] = True
            TICKER_CACHE["initial_ready"] = True
            # Set builtin tickers as initial cache
            if not TICKER_CACHE["tickers"]:
                TICKER_CACHE["tickers"] = BUILTIN_TICKERS[:]
            thread = threading.Thread(target=_fetch_all_tickers_background, daemon=True)
            thread.start()

        # Return whatever we have (builtin or partial)
        return jsonify({
            "stocks": TICKER_CACHE["tickers"],
            "complete": TICKER_CACHE["all_ready"]
        })

    except Exception as e:
        app.logger.error("get_stocks error: %s", e, exc_info=True)
        return jsonify({"stocks": BUILTIN_TICKERS, "complete": False})


@trade_bp.route("/trade/stock-price")
def stock_price():
    """
    Returns live price for a single stock symbol.
    Uses yfinance history for reliability.
    """
    symbol = request.args.get("symbol")
    if not symbol:
        return jsonify({"error": "Missing symbol"}), 400

    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period="1d", interval="5m")

        current_price = None
        prev_close = None

        if not hist.empty:
            current_price = float(hist['Close'].iloc[-1])

        # Try to get previous close from info
        try:
            info = ticker.info or {}
            prev_close = info.get("previousClose")
            if current_price is None:
                current_price = info.get("currentPrice")
        except Exception:
            pass

        if current_price is None:
            return jsonify({"error": "Could not fetch price for symbol"}), 404

        change = 0
        change_percent = 0
        if prev_close and prev_close > 0:
            change = current_price - prev_close
            change_percent = (change / prev_close) * 100

        return jsonify({
            "symbol": symbol,
            "price": round(current_price, 2),
            "previousClose": round(prev_close, 2) if prev_close else None,
            "change": round(change, 2),
            "changePercent": round(change_percent, 2)
        })

    except Exception as e:
        app.logger.error("stock_price error for %s: %s", symbol, e, exc_info=True)
        return jsonify({"error": "Failed to fetch stock price"}), 500


@trade_bp.route("/trade/buysell")
def buysell():
    return render_template("buy-sell.html")

@trade_bp.route('/api/stock-data')
def stock_data():
    """
    Returns historical intraday data for a specific symbol.
    Supports period param: 1d, 5d, 1mo, 3mo, 6mo, 1y
    """
    symbol = request.args.get('symbol')
    period = request.args.get('period', '1d')
    if not symbol:
        return jsonify({'error': 'Missing symbol'}), 400

    # Map period to appropriate interval
    interval_map = {
        '1d': '5m',
        '5d': '15m',
        '1mo': '1d',
        '3mo': '1d',
        '6mo': '1d',
        '1y': '1wk',
    }
    interval = interval_map.get(period, '5m')

    try:
        try:
            hist = yf.Ticker(symbol).history(period=period, interval=interval)
        except Exception as e:
            app.logger.error("yfinance history error for %s: %s", symbol, e, exc_info=True)
            return jsonify({'error': 'Failed to fetch stock history'}), 500

        if hist.empty:
            return jsonify({'error': 'No data available for symbol'}), 404

        prices = hist['Close'].tolist()
        # Format labels based on period
        if period in ('1d', '5d'):
            labels = hist.index.strftime('%H:%M').tolist()
        else:
            labels = hist.index.strftime('%Y-%m-%d').tolist()

        return jsonify({'labels': labels, 'prices': prices})
    except Exception as e:
        app.logger.error("stock_data error for %s: %s", symbol, e, exc_info=True)
        return jsonify({'error': 'Server error fetching stock data'}), 500
