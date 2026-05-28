from flask import Blueprint, current_app, jsonify, request

from trading_execution import (
    DEFAULT_SYMBOL,
    TradingExecutionError,
    liquidate_session_position,
    run_trading_tick,
    start_trading_loop,
    stop_trading_loop,
    trading_loop_status,
)
from utils.auth import firebase_auth_required

trading_bp = Blueprint("trading", __name__, url_prefix="/api/trading")


@trading_bp.route("/sessions/<int:session_id>/tick", methods=["POST"])
@firebase_auth_required
def tick(session_id: int):
    data = request.get_json(silent=True) or {}
    symbol = data.get("symbol", DEFAULT_SYMBOL)
    dry_run = bool(data.get("dry_run", False))

    try:
        return jsonify(run_trading_tick(session_id, symbol=symbol, dry_run=dry_run)), 200
    except TradingExecutionError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Trading tick failed: {exc}"}), 500


@trading_bp.route("/sessions/<int:session_id>/start", methods=["POST"])
@firebase_auth_required
def start(session_id: int):
    data = request.get_json(silent=True) or {}
    symbol = data.get("symbol", DEFAULT_SYMBOL)

    try:
        # Run a dry preflight first so missing credentials/data fail immediately.
        preflight = run_trading_tick(session_id, symbol=symbol, dry_run=True)
        started = start_trading_loop(current_app._get_current_object(), session_id, symbol)
        return jsonify({
            "session_id": session_id,
            "symbol": symbol,
            "started": started,
            "running": True,
            "preflight": preflight,
            "status": trading_loop_status(session_id),
        }), 200
    except TradingExecutionError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Could not start trading loop: {exc}"}), 500


@trading_bp.route("/sessions/<int:session_id>/stop", methods=["POST"])
@firebase_auth_required
def stop(session_id: int):
    data = request.get_json(silent=True) or {}
    symbol = data.get("symbol", DEFAULT_SYMBOL)

    try:
        stopped = stop_trading_loop(session_id)
        liquidation = liquidate_session_position(session_id, symbol=symbol)
        return jsonify({
            "session_id": session_id,
            "symbol": symbol,
            "stopped": stopped,
            "running": False,
            "liquidation": liquidation,
            "status": trading_loop_status(session_id),
        }), 200
    except TradingExecutionError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Could not stop trading loop: {exc}"}), 500


@trading_bp.route("/sessions/<int:session_id>/status", methods=["GET"])
@firebase_auth_required
def status(session_id: int):
    return jsonify(trading_loop_status(session_id)), 200
