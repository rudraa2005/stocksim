from flask import Flask, render_template, flash, request, redirect, url_for
from flask_jwt_extended import JWTManager

from auth import auth_bp
from dashboard import dashboard_bp
from portfolio import portfolio_bp
from trade import trade_bp

from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
app = Flask(__name__)
app.secret_key = "supersecret123" 


app.config['JWT_SECRET_KEY'] = 'jwt-secret-string'  # Add JWT secret key
jwt = JWTManager(app)


app.register_blueprint(auth_bp, url_prefix='/auth')

@app.route('/')
def home():
    return redirect(url_for('auth.login'))  


# Register blueprints
app.register_blueprint(dashboard_bp)  # OPTIONAL: if your dashboard is a blueprint
app.register_blueprint(trade_bp)
app.register_blueprint(portfolio_bp)

if __name__ == '__main__':
    app.run(debug=True)