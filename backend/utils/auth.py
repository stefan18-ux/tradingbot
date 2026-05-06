"""
Firebase JWT authentication middleware for Flask.

Verifies Firebase ID tokens sent as Bearer tokens in the Authorization header.
Provides a decorator `firebase_auth_required` to protect routes.
"""

import os
import firebase_admin
from firebase_admin import credentials, auth as firebase_auth
from flask import request, jsonify, g
from functools import wraps

# Initialize Firebase Admin SDK
# Uses GOOGLE_APPLICATION_CREDENTIALS env var or a service account JSON path
_firebase_app = None


def _get_firebase_app():
    """Lazily initialize the Firebase Admin app."""
    global _firebase_app
    if _firebase_app is not None:
        return _firebase_app

    service_account_path = os.getenv('FIREBASE_SERVICE_ACCOUNT_KEY')
    if service_account_path and os.path.exists(service_account_path):
        cred = credentials.Certificate(service_account_path)
        _firebase_app = firebase_admin.initialize_app(cred)
    else:
        # Fallback to project ID (sufficient for verifying tokens)
        project_id = os.getenv('FIREBASE_PROJECT_ID', 'tradingbot-c0986')
        _firebase_app = firebase_admin.initialize_app(options={'projectId': project_id})

    return _firebase_app


def verify_firebase_token(id_token: str) -> dict | None:
    """
    Verify a Firebase ID token and return the decoded claims.
    Returns None if the token is invalid or expired.
    """
    try:
        _get_firebase_app()
        decoded_token = firebase_auth.verify_id_token(id_token)
        return decoded_token
    except Exception as e:
        print(f"[AUTH] Token verification failed: {e}")
        return None


def firebase_auth_required(f):
    """
    Decorator that enforces Firebase JWT authentication on a Flask route.

    Expects an Authorization header in the format:
        Authorization: Bearer <firebase_id_token>

    On success, sets:
        g.firebase_uid  — the user's Firebase UID
        g.firebase_user — the full decoded token claims
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')

        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing or invalid Authorization header'}), 401

        id_token = auth_header.split('Bearer ', 1)[1]

        if not id_token:
            return jsonify({'error': 'Empty token'}), 401

        decoded = verify_firebase_token(id_token)
        if decoded is None:
            return jsonify({'error': 'Invalid or expired token'}), 401

        # Make user info available to the route handler
        g.firebase_uid = decoded['uid']
        g.firebase_user = decoded
        
        print(f"[AUTH SUCCESS] User {g.firebase_uid} authenticated for {request.path}")

        return f(*args, **kwargs)

    return decorated_function
