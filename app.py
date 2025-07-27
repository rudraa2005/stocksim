from flask import Flask, redirect
from flask_cors import CORS
from flask_jwt_extended import JWTManager


from backend.auth import auth_bp
from backend.dashboard import dashboard_bp
from backend.portfolio import portfolio_bp
from backend.trade import trade_bp

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
    return redirect("/auth/login")

if __name__ == "__main__":
    app.run(debug=True)
