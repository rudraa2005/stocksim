from flask import Flask
from flask import redirect 
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from backend.auth import auth_bp
from backend.dashboard import dashboard_bp
from backend.portfolio import portfolio_bp
from backend.trade import trade_bp

import os
import json
import tempfile
import firebase_admin
from firebase_admin import credentials, firestore

firebase_config_str = os.environ.get("FIREBASE_CONFIG")
if not firebase_config_str:
    raise Exception("Missing FIREBASE_CONFIG environment variable.")


firebase_config = json.loads(firebase_config_str)
cred = credentials.Certificate(firebase_cred_path)
firebase_admin.initialize_app(cred)


db = firestore.client()

app = Flask(__name__)
CORS(app)
@app.route("/")
def home():
    print("Redirecting to /auth/login")
    return redirect("/auth/login")


app.secret_key = "your-secret-key"
app.config["JWT_SECRET_KEY"] = "your-jwt-secret-key"

jwt = JWTManager(app)


app.register_blueprint(auth_bp)
app.register_blueprint(dashboard_bp)
app.register_blueprint(portfolio_bp)
app.register_blueprint(trade_bp)
