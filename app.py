from flask import Flask
from flask import redirect 
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from backend.auth import auth_bp
from backend.dashboard import dashboard_bp
from backend.portfolio import portfolio_bp
from backend.trade import trade_bp

from firebase_admin import credentials
import json
import os

# Load the JSON string from the environment
firebase_config_str = os.environ.get("FIREBASE_CONFIG")
if not firebase_config_str:
    raise Exception("Missing FIREBASE_CONFIG environment variable.")

# Parse the string
firebase_config = json.loads(firebase_config_str)

# Use from_json (correct method)
cred = credentials.Certificate._from_json(firebase_config)  # yes, it's a private method
firebase_admin.initialize_app(cred)
# Connect to Firestore
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
