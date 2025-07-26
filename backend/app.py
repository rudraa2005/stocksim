from flask import Flask
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from backend.auth import auth_bp
from backend.dashboard import dashboard_bp
from backend.portfolio import portfolio_bp
from backend.trade import trade_bp

import os
import json
import firebase_admin
from firebase_admin import credentials, firestore

# Load Firebase credentials from environment variable
firebase_config_str = os.environ.get("GOOGLE_CREDENTIALS")
if not firebase_config_str:
    raise Exception("Missing GOOGLE_CREDENTIALS environment variable.")

firebase_config = json.loads(firebase_config_str)

# ✅ Initialize Firebase directly from the parsed dict (no temp files)
cred = credentials.Certificate(firebase_config)
firebase_admin.initialize_app(cred)

# Connect to Firestore
db = firestore.client()

app = Flask(__name__)
CORS(app)
app.secret_key = "your-secret-key"
app.config["JWT_SECRET_KEY"] = "your-jwt-secret-key"

jwt = JWTManager(app)

# Register blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(dashboard_bp)
app.register_blueprint(portfolio_bp)
app.register_blueprint(trade_bp)

@app.route("/")
def home():
    return "Demo Stock Trading App is running."

if __name__ == "__main__":
    app.run(debug=True)

if __name__ == "__main__":
    app.run(debug=True)
