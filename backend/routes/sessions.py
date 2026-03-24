from flask import Blueprint, request, jsonify
from database.models import db, Session, User, SessionStatus
from sqlalchemy.exc import IntegrityError
from datetime import datetime
from decimal import Decimal

sessions_bp = Blueprint('sessions', __name__, url_prefix='/api/sessions')


def format_session_response(session):
    """Format session object to JSON response"""
    return {
        'id': session.id,
        'user_id': session.user_id,
        'start_timestamp': session.start_timestamp.isoformat() if session.start_timestamp else None,
        'stop_timestamp': session.stop_timestamp.isoformat() if session.stop_timestamp else None,
        'pnl': str(session.pnl) if session.pnl is not None else None,
        'status': session.status.value
    }


@sessions_bp.route('', methods=['POST'])
def create_session():
    """Create a new session"""
    try:
        data = request.get_json()

        if not data or 'user_id' not in data:
            return jsonify({'error': 'user_id is required'}), 400

        user = User.query.get(data['user_id'])
        if not user:
            return jsonify({'error': f'User not found'}), 404

        pnl_value = None
        if 'pnl' in data and data['pnl'] is not None:
            try:
                pnl_value = Decimal(str(data['pnl']))
            except (ValueError, TypeError):
                return jsonify({'error': 'pnl must be a valid number'}), 400

        status_value = SessionStatus.ACTIVE
        if 'status' in data and data['status']:
            try:
                status_value = SessionStatus[data['status'].upper()]
            except KeyError:
                return jsonify({'error': 'Invalid status. Must be ACTIVE, STOPPED, COMPLETED or FAILED'}), 400

        session = Session(
            user_id=data['user_id'],
            pnl=pnl_value,
            status=status_value
        )

        db.session.add(session)
        db.session.commit()

        return jsonify(format_session_response(session)), 201

    except IntegrityError as e:
        db.session.rollback()
        return jsonify({'error': 'Database integrity error: ' + str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'An error occurred: ' + str(e)}), 500


@sessions_bp.route('', methods=['GET'])
def get_all_sessions():
    """Get all sessions with optional filters"""
    try:
        user_id = request.args.get('user_id', type=int)
        status = request.args.get('status', type=str)
        limit = request.args.get('limit', default=100, type=int)
        offset = request.args.get('offset', default=0, type=int)

        query = Session.query

        if user_id:
            query = query.filter_by(user_id=user_id)

        if status:
            try:
                status_enum = SessionStatus[status.upper()]
                query = query.filter_by(status=status_enum)
            except KeyError:
                return jsonify({'error': 'Invalid status. Must be ACTIVE, STOPPED, COMPLETED or FAILED'}), 400

        query = query.order_by(Session.start_timestamp.desc())

        total = query.count()

        sessions = query.limit(limit).offset(offset).all()

        sessions_data = [format_session_response(s) for s in sessions]

        return jsonify({
            'sessions': sessions_data,
            'total': total,
            'limit': limit,
            'offset': offset
        }), 200

    except Exception as e:
        return jsonify({'error': 'An error occurred: ' + str(e)}), 500


@sessions_bp.route('/<int:session_id>', methods=['GET'])
def get_session(session_id):
    """Get a specific session by ID"""
    try:
        session = Session.query.get(session_id)

        if not session:
            return jsonify({'error': 'Session not found'}), 404

        return jsonify(format_session_response(session)), 200

    except Exception as e:
        return jsonify({'error': 'An error occurred: ' + str(e)}), 500


@sessions_bp.route('/user/<int:user_id>', methods=['GET'])
def get_sessions_by_user(user_id):
    """Get all sessions for a specific user"""
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': f'User with id {user_id} not found'}), 404

        limit = request.args.get('limit', default=100, type=int)
        offset = request.args.get('offset', default=0, type=int)

        query = Session.query.filter_by(user_id=user_id).order_by(Session.start_timestamp.desc())

        total = query.count()
        sessions = query.limit(limit).offset(offset).all()

        sessions_data = [format_session_response(s) for s in sessions]

        return jsonify({
            'user_id': user_id,
            'sessions': sessions_data,
            'total': total,
            'limit': limit,
            'offset': offset
        }), 200

    except Exception as e:
        return jsonify({'error': 'An error occurred: ' + str(e)}), 500


@sessions_bp.route('/<int:session_id>', methods=['PUT'])
def update_session(session_id):
    """Update a specific session"""
    try:
        session = Session.query.get(session_id)

        if not session:
            return jsonify({'error': 'Session not found'}), 404

        data = request.get_json()

        if 'user_id' in data:
            return jsonify({'error': 'user_id cannot be updated'}), 400

        if 'pnl' in data:
            if data['pnl'] is None:
                session.pnl = None
            else:
                try:
                    pnl_value = Decimal(str(data['pnl']))
                except (ValueError, TypeError):
                    return jsonify({'error': 'pnl must be a valid number'}), 400
                session.pnl = pnl_value

        if 'stop_timestamp' in data:
            try:
                # Expecting ISO formatted datetime string
                session.stop_timestamp = datetime.fromisoformat(data['stop_timestamp']) if data['stop_timestamp'] else None
            except Exception:
                return jsonify({'error': 'stop_timestamp must be an ISO formatted datetime string'}), 400

        if 'status' in data:
            try:
                session.status = SessionStatus[data['status'].upper()]
            except KeyError:
                return jsonify({'error': 'Invalid status. Must be ACTIVE, STOPPED, COMPLETED or FAILED'}), 400

        db.session.commit()

        return jsonify(format_session_response(session)), 200

    except IntegrityError as e:
        db.session.rollback()
        return jsonify({'error': 'Database integrity error: ' + str(e)}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'An error occurred: ' + str(e)}), 500


@sessions_bp.route('/<int:session_id>', methods=['DELETE'])
def delete_session(session_id):
    """Delete a specific session"""
    try:
        session = Session.query.get(session_id)

        if not session:
            return jsonify({'error': 'Session not found'}), 404

        session_info = {
            'id': session.id,
            'user_id': session.user_id,
            'message': 'Session deleted successfully'
        }

        db.session.delete(session)
        db.session.commit()

        return jsonify(session_info), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'An error occurred: ' + str(e)}), 500
