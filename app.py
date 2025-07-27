from flask import Flask
from flask import redirect 
from flask_cors import CORS
from flask_jwt_extended import JWTManager
import tempfile
from backend.auth import auth_bp
from backend.dashboard import dashboard_bp
from backend.portfolio import portfolio_bp
from backend.trade import trade_bp

import os
import json
import firebase_admin
from firebase_admin import credentials, firestore

firebase_config_str = os.environ.get("FIREBASE_CONFIG")
if not firebase_config_str:
    raise Exception("Missing FIREBASE_CONFIG environment variable.")

# ✅ Parse the string into a dict
firebase_config = json.loads(firebase_config_str)

# ✅ This is now a dictionary, so it's safe to pass directly
cred = credentials.Certificate(firebase_config)
firebase_admin.initialize_app(cred)

# ✅ Access Firestore if needed
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

# Register blueprints
app.register_blueprint(auth_bp)
app.register_blueprint(dashboard_bp)
app.register_blueprint(portfolio_bp)
app.register_blueprint(trade_bp)
