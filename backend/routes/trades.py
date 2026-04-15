from flask import Blueprint, request, jsonify
from database.models import db, Trade, Session, TradeType
from sqlalchemy.exc import IntegrityError
from datetime import datetime
from decimal import Decimal

trades_bp = Blueprint('trades', __name__, url_prefix='/api/trades')


def format_trade_response(trade):
    """Format trade object to JSON response"""
    return {
        'id': trade.id,
        'session_id': trade.session_id,
        'price': str(trade.price),
        'quantity': str(trade.quantity),
        'type': trade.type.value,
        'timestamp': trade.timestamp.isoformat()
    }


@trades_bp.route('', methods=['POST'])
def create_trade():
    """Create a new trade"""
    try:
        data = request.get_json()
        
        required_fields = ['session_id', 'price', 'quantity', 'type']
        if not data or not all(field in data for field in required_fields):
            return jsonify({'error': f'Missing required fields: {", ".join(required_fields)}'}), 400
        
        session = Session.query.get(data['session_id'])
        if not session:
            return jsonify({'error': f'Session with id {data["session_id"]} not found'}), 404
        
        try:
            price = Decimal(str(data['price']))
            quantity = Decimal(str(data['quantity']))
        except (ValueError, TypeError):
            return jsonify({'error': 'price and quantity must be valid numbers'}), 400
        
        if price <= 0 or quantity <= 0:
            return jsonify({'error': 'price and quantity must be positive'}), 400
        
        try:
            trade_type = TradeType[data['type'].upper()]
        except KeyError:
            return jsonify({'error': 'Invalid type. Must be BUY or SELL'}), 400
        
        trade = Trade(
            session_id=data['session_id'],
            price=price,
            quantity=quantity,
            type=trade_type
        )
        
        db.session.add(trade)
        db.session.commit()
        
        return jsonify(format_trade_response(trade)), 201
        
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({'error': 'Database integrity error: ' + str(e)}), 400
    except ValueError as e:
        return jsonify({'error': 'Invalid input: ' + str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'An error occurred: ' + str(e)}), 500


@trades_bp.route('', methods=['GET'])
def get_all_trades():
    """Get all trades with optional filters"""
    try:
        # Optional filters
        session_id = request.args.get('session_id', type=int)
        trade_type = request.args.get('type', type=str)
        limit = request.args.get('limit', default=100, type=int)
        offset = request.args.get('offset', default=0, type=int)
        
        query = Trade.query
        
        if session_id:
            query = query.filter_by(session_id=session_id)
        
        if trade_type:
            try:
                trade_type_enum = TradeType[trade_type.upper()]
                query = query.filter_by(type=trade_type_enum)
            except KeyError:
                return jsonify({'error': 'Invalid type. Must be BUY or SELL'}), 400
        
        query = query.order_by(Trade.timestamp.desc())
        
        total = query.count()
        
        # Apply pagination
        trades = query.limit(limit).offset(offset).all()
        
        trades_data = [format_trade_response(trade) for trade in trades]
        
        return jsonify({
            'trades': trades_data,
            'total': total,
            'limit': limit,
            'offset': offset
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'An error occurred: ' + str(e)}), 500


@trades_bp.route('/<int:trade_id>', methods=['GET'])
def get_trade(trade_id):
    """Get a specific trade by ID"""
    try:
        trade = Trade.query.get(trade_id)
        
        if not trade:
            return jsonify({'error': 'Trade not found'}), 404
        
        return jsonify(format_trade_response(trade)), 200
        
    except Exception as e:
        return jsonify({'error': 'An error occurred: ' + str(e)}), 500


@trades_bp.route('/session/<int:session_id>', methods=['GET'])
def get_trades_by_session(session_id):
    """Get all trades for a specific session"""
    try:
        session = Session.query.get(session_id)
        if not session:
            return jsonify({'error': f'Session with id {session_id} not found'}), 404
        
        limit = request.args.get('limit', default=100, type=int)
        offset = request.args.get('offset', default=0, type=int)
        
        query = Trade.query.filter_by(session_id=session_id).order_by(Trade.timestamp.desc())
        
        total = query.count()
        trades = query.limit(limit).offset(offset).all()
        
        trades_data = [format_trade_response(trade) for trade in trades]
        
        return jsonify({
            'session_id': session_id,
            'trades': trades_data,
            'total': total,
            'limit': limit,
            'offset': offset
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'An error occurred: ' + str(e)}), 500


@trades_bp.route('/<int:trade_id>', methods=['PUT'])
def update_trade(trade_id):
    """Update a specific trade"""
    try:
        trade = Trade.query.get(trade_id)
        
        if not trade:
            return jsonify({'error': 'Trade not found'}), 404
        
        data = request.get_json()
        
        # session_id cannot be updated
        if 'session_id' in data:
            return jsonify({'error': 'session_id cannot be updated'}), 400
        
        if 'price' in data:
            try:
                price = Decimal(str(data['price']))
            except (ValueError, TypeError):
                return jsonify({'error': 'price must be a valid number'}), 400
            
            if price <= 0:
                return jsonify({'error': 'price must be positive'}), 400
            
            trade.price = price
        
        if 'quantity' in data:
            try:
                quantity = Decimal(str(data['quantity']))
            except (ValueError, TypeError):
                return jsonify({'error': 'quantity must be a valid number'}), 400
            
            if quantity <= 0:
                return jsonify({'error': 'quantity must be positive'}), 400
            
            trade.quantity = quantity
        
        if 'type' in data:
            try:
                trade.type = TradeType[data['type'].upper()]
            except KeyError:
                return jsonify({'error': 'Invalid type. Must be BUY or SELL'}), 400
        
        db.session.commit()
        
        return jsonify(format_trade_response(trade)), 200
        
    except IntegrityError as e:
        db.session.rollback()
        return jsonify({'error': 'Database integrity error: ' + str(e)}), 400
    except ValueError as e:
        return jsonify({'error': 'Invalid input: ' + str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'An error occurred: ' + str(e)}), 500


@trades_bp.route('/<int:trade_id>', methods=['DELETE'])
def delete_trade(trade_id):
    """Delete a specific trade"""
    try:
        trade = Trade.query.get(trade_id)
        
        if not trade:
            return jsonify({'error': 'Trade not found'}), 404
        
        # Store trade info before deletion for response
        trade_info = {
            'id': trade.id,
            'session_id': trade.session_id,
            'message': 'Trade deleted successfully'
        }
        
        db.session.delete(trade)
        db.session.commit()
        
        return jsonify(trade_info), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'An error occurred: ' + str(e)}), 500
