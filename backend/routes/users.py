from flask import Blueprint, request, jsonify
from database.models import db, User, UserRole
from utils.encryption import encrypt_secret
import os
from sqlalchemy.exc import IntegrityError
from datetime import datetime
from decimal import Decimal

users_bp = Blueprint('users', __name__, url_prefix='/api/users')


def format_user_response(user, include_secret=False):
    """Format user object to JSON response"""
    response = {
        'id': user.id,
        'firebase_uid': user.firebase_uid,
        'api_key': user.api_key,
        'wallet': str(user.wallet),
        'role': user.role.value,
        'created_at': user.created_at.isoformat(),
        'updated_at': user.updated_at.isoformat()
    }
    if include_secret:
        response['alpaca_secret'] = user.alpaca_secret
    return response


@users_bp.route('', methods=['POST'])
def create_user():
    """Create a new user"""
    try:
        data = request.get_json()
        
        if not data or 'firebase_uid' not in data:
            return jsonify({'error': 'firebase_uid is required'}), 400
        
        # Check if user already exists
        existing_user = User.query.filter_by(firebase_uid=data['firebase_uid']).first()
        if existing_user:
            return jsonify({'error': 'User with this firebase_uid already exists'}), 409
        
        if 'wallet' in data:
            wallet_value = Decimal(str(data.get('wallet', 0)))
            if wallet_value < 0:
                return jsonify({'error': 'wallet cannot be negative'}), 400
        else:
            wallet_value = Decimal('0.00')

        if 'role' in data:
            try:
                role_value = UserRole[data['role'].upper()]
            except KeyError:
                return jsonify({'error': 'Invalid role. Must be USER or ADMIN'}), 400
        
        alpaca_secret_raw = data.get('alpaca_secret')
        user = User(
            firebase_uid=data['firebase_uid'],
            api_key=data.get('api_key'),
            alpaca_secret=encrypt_secret(alpaca_secret_raw) if alpaca_secret_raw is not None else None,
            wallet=wallet_value,
            role=role_value if 'role' in data else UserRole.USER
        )
        
        db.session.add(user)
        db.session.commit()
        
        return jsonify({
            'id': user.id,
            'firebase_uid': user.firebase_uid,
            'api_key': user.api_key,
            'wallet': str(user.wallet),
            'role': user.role.value,
            'created_at': user.created_at.isoformat(),
            'updated_at': user.updated_at.isoformat()
        }), 201
        
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({'error': 'Database integrity error: ' + str(e)}), 400
    except ValueError as e:
        return jsonify({'error': 'Invalid input: ' + str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'An error occurred: ' + str(e)}), 500


@users_bp.route('', methods=['GET'])
def get_all_users():
    """Get all users"""
    try:
        users = User.query.all()
        
        users_data = [format_user_response(user) for user in users]
        
        return jsonify({
            'users': users_data,
            'total': len(users_data)
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'An error occurred: ' + str(e)}), 500


@users_bp.route('/<int:user_id>', methods=['GET'])
def get_user(user_id):
    """Get a specific user by ID"""
    try:
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify(format_user_response(user)), 200
        
    except Exception as e:
        return jsonify({'error': 'An error occurred: ' + str(e)}), 500


@users_bp.route('/firebase/<firebase_uid>', methods=['GET'])
def get_user_by_firebase(firebase_uid):
    """Get a user by firebase_uid"""
    try:
        if not firebase_uid or not str(firebase_uid).strip():
            return jsonify({'error': 'firebase_uid cannot be empty'}), 400
        
        user = User.query.filter_by(firebase_uid=firebase_uid).first()
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify(format_user_response(user)), 200
        
    except Exception as e:
        return jsonify({'error': 'An error occurred: ' + str(e)}), 500


@users_bp.route('/<int:user_id>/secret', methods=['GET'])
def get_user_with_secret(user_id):
    """Get a specific user by ID and include the Alpaca secret in response (encrypted)"""
    try:
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify(format_user_response(user, True)), 200
        
    except Exception as e:
        return jsonify({'error': 'An error occurred: ' + str(e)}), 500


@users_bp.route('/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    """Update a specific user"""
    try:
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        if 'firebase_uid' in data:
            return jsonify({'error': 'firebase_uid cannot be updated'}), 400
        
        if 'api_key' in data:
            user.api_key = data['api_key']
        
        if 'alpaca_secret' in data:
            alpaca_secret_raw = data.get('alpaca_secret')
            user.alpaca_secret = encrypt_secret(alpaca_secret_raw) if alpaca_secret_raw is not None else None
        
        if 'wallet' in data:
            wallet_value = Decimal(str(data['wallet']))
            if wallet_value < 0:
                return jsonify({'error': 'wallet cannot be negative'}), 400
            user.wallet = wallet_value
        
        if 'role' in data:
            try:
                user.role = UserRole[data['role'].upper()]
            except KeyError:
                return jsonify({'error': 'Invalid role. Must be USER or ADMIN'}), 400
        
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify(format_user_response(user)), 200
        
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({'error': 'Database integrity error: ' + str(e)}), 400
    except ValueError as e:
        return jsonify({'error': 'Invalid input: ' + str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'An error occurred: ' + str(e)}), 500


@users_bp.route('/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    """Delete a specific user"""
    try:
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Store user info before deletion for response
        user_info = {
            'id': user.id,
            'firebase_uid': user.firebase_uid,
            'message': 'User deleted successfully'
        }
        
        db.session.delete(user)
        db.session.commit()
        
        return jsonify(user_info), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'An error occurred: ' + str(e)}), 500


@users_bp.route('/<int:user_id>/wallet', methods=['PATCH'])
def update_wallet(user_id):
    """Update user's wallet balance"""
    try:
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        if 'amount' not in data:
            return jsonify({'error': 'amount is required'}), 400
        
        try:
            amount = Decimal(str(data['amount']))
        except (ValueError, TypeError):
            return jsonify({'error': 'amount must be a valid number'}), 400
        
        if amount < 0:
            return jsonify({'error': 'amount cannot be negative'}), 400
        
        operation = data.get('operation', 'set')  # 'set', 'add', 'subtract'
        
        if operation == 'add':
            user.wallet += amount
        elif operation == 'subtract':
            if user.wallet < amount:
                return jsonify({'error': 'Insufficient wallet balance'}), 400
            user.wallet -= amount
        elif operation == 'set':
            user.wallet = amount
        else:
            return jsonify({'error': 'Invalid operation. Must be set, add, or subtract'}), 400
        
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'id': user.id,
            'wallet': str(user.wallet),
            'updated_at': user.updated_at.isoformat()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'An error occurred: ' + str(e)}), 500
