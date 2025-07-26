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


if not firebase_admin._apps:
    cred = credentials.Certificate("serviceAccount.json")
    firebase_admin.initialize_app(cred)
db = firestore.client()


@portfolio_bp.route("/portfolio")
def portfolio():
    return render_template("portfolio.html")

@portfolio_bp.route("/portfolio/trades")
def trades():
    uid=request.args.get("uid")
    user_ref=db.collection("users").document(uid).collection("trades")
    docs = user_ref.stream()
    result=[]
    for doc in docs:
        trade_data= doc.to_dict()
        trade_data["id"] = doc.id
        result.append(trade_data)
    return jsonify(result)
        
        
         