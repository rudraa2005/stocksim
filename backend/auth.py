from flask import Blueprint, request, jsonify, render_template, flash
from werkzeug.security import generate_password_hash, check_password_hash
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
import datetime
import firebase_admin
from firebase_admin import credentials, auth, firestore 

def get_db():
    return firestore.client()
    
auth_bp = Blueprint("auth", __name__, url_prefix="/auth")

@auth_bp.route("/register", methods=["GET", "POST"])
def register():
    if request.method == 'GET':
        return render_template("register.html")

    data = request.json
    id_token = data.get("idToken")

    try:
        decoded_token = auth.verify_id_token(id_token)
        uid = decoded_token["uid"]
        name = data.get("name")
        email = data.get("email")
        db.collection('users').document(uid).set({
            'name': name,
            'email': email,
            "balance": 10000,
            "profit": 0,
            "loss": 0,
            "stocks_buy": None,
            "stocks_sell": None,
            "price": 0
        })

        return jsonify({"message": "User profile saved"}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 400
    
@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        return render_template("login.html")
    
    id_token=request.json["idToken"]
    try:
        import time
        time.sleep(2)  # Add a short delay
        decoded_token = auth.verify_id_token(id_token, check_revoked=False)
        uid = decoded_token['uid']
        user = auth.get_user(uid)
        return jsonify({"uid": uid, "name": user.display_name})
    except Exception as e:
        return jsonify({"error": str(e)}), 401

    




