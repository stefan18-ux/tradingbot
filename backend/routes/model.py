from functools import lru_cache

import pandas as pd
from flask import Blueprint, jsonify, request

from trading_agent import TradingAgent
from utils.auth import firebase_auth_required

model_bp = Blueprint("model", __name__, url_prefix="/api/model")


@lru_cache(maxsize=1)
def get_agent() -> TradingAgent:
    return TradingAgent()


@model_bp.route("/health", methods=["GET"])
def model_health():
    try:
        agent = get_agent()
        return jsonify({
            "status": "ok",
            "window_size": agent.window_size,
            "action_count": agent.action_count,
            "confidence_threshold": agent.confidence_threshold,
        }), 200
    except Exception as exc:
        return jsonify({"status": "error", "error": str(exc)}), 503


@model_bp.route("/predict", methods=["POST"])
@firebase_auth_required
def predict():
    data = request.get_json(silent=True) or {}
    bars = data.get("bars")
    if not isinstance(bars, list):
        return jsonify({"error": "Request body must include bars as a list"}), 400

    try:
        market_data = pd.DataFrame(bars)
        current_position = data.get("current_position", "cash")
        signal = get_agent().predict_signal(market_data, current_position)
        return jsonify(signal), 200
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except FileNotFoundError as exc:
        return jsonify({"error": str(exc)}), 503
    except Exception as exc:
        return jsonify({"error": f"Prediction failed: {exc}"}), 500
