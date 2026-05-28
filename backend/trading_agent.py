"""
Trading agent that loads a trained PPO policy and predicts BUY / SELL / HOLD.
"""

import logging
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "model-dev"))
from features.feature_extraction import extract, get_feature_cols  # noqa: E402

load_dotenv(Path(__file__).resolve().parent / ".env")
logger = logging.getLogger(__name__)

LEGACY_ACTION_MAP = {0: "BUY", 1: "SELL", 2: "HOLD"}
TARGET_POSITION_MAP = {0: "CASH", 1: "ASSET"}
WINDOW_SIZE = 30
MIN_BARS = WINDOW_SIZE + 1
REQUIRED_COLUMNS = ["open", "high", "low", "close", "volume", "vwap", "trade_count"]
DEFAULT_CONFIDENCE_THRESHOLD = 0.55


def _default_weights_path() -> Path:
    repo_root = Path(__file__).resolve().parent.parent
    return repo_root / "model-dev" / "training" / "best_qqq_model" / "model_weights.npz"


class TradingAgent:
    """Loads a trained PPO policy and exposes helpers that talk to the model.

    Parameters
    ----------
    weights_path : str | Path | None
        Path to the ``model_weights.npz`` file produced by
        ``model-dev/training/export_model.py``.
        When *None* the value of ``MODEL_CHECKPOINT_PATH`` from ``.env`` is used.

    Example
    -------
    >>> agent = TradingAgent()
    >>> action_idx, label = agent.predict(market_bars_df)
    >>> print(label)  # "BUY", "SELL", or "HOLD"
    """

    def __init__(self, weights_path: str | Path | None = None):
        if weights_path is None:
            weights_path = os.getenv("MODEL_CHECKPOINT_PATH") or _default_weights_path()
        weights_path = Path(weights_path)
        if not weights_path.is_absolute():
            cwd_path = Path.cwd() / weights_path
            if cwd_path.exists():
                weights_path = cwd_path
            else:
                weights_path = Path(__file__).resolve().parent / weights_path
        if weights_path.is_dir():
            weights_path = weights_path / "model_weights.npz"
        if not weights_path.exists():
            raise FileNotFoundError(f"Weights file not found at {weights_path}")

        self._load_weights(weights_path)
        logger.info("TradingAgent ready  (weights=%s)", weights_path)


    def _load_weights(self, path: Path) -> None:
        """
        Load the ``.npz`` and store each weight matrix as an attribute.
        """
        w = np.load(path)
        self.W1 = w["W1"]              # (128, 300)
        self.b1 = w["b1"]              # (128,)
        self.W2 = w["W2"]              # (128, 128)
        self.b2 = w["b2"]              # (128,)
        self.W_logits = w["W_logits"]  # (3, 128)
        self.b_logits = w["b_logits"]  # (3,)

        self.feature_cols = get_feature_cols()
        self.window_size = WINDOW_SIZE
        self.action_count = int(self.b_logits.shape[0])
        self.confidence_threshold = float(
            os.getenv("MODEL_CONFIDENCE_THRESHOLD", DEFAULT_CONFIDENCE_THRESHOLD)
        )
        if self.action_count not in (2, 3):
            raise ValueError(f"Unsupported policy output size: {self.action_count}")


    def _forward(self, obs: np.ndarray) -> np.ndarray:
        """Run a single forward pass through the neural network.

        This reproduces exactly what the trained model does: three
        matrix multiplications with tanh activations in between.

        see in model-dev/training/simple_training.py
         .training(
            model={"fcnet_hiddens": [128, 128], "fcnet_activation": "tanh"},
        )
        """
        x = obs.astype(np.float32)
        x = np.tanh(self.W1 @ x + self.b1)
        x = np.tanh(self.W2 @ x + self.b2)
        logits = self.W_logits @ x + self.b_logits
        return logits

    # ── Public helpers ───────────────────────────────────────────────

    def predict_from_observation(self, obs: np.ndarray) -> tuple[int, str]:
        """Predict an action from an already-formatted observation array.

        Parameters
        ----------
        obs : np.ndarray
            Either shape ``(window_size, n_features)`` or already flattened
            ``(window_size * n_features,)``.

        Returns
        -------
        action_idx : int
            0 = BUY, 1 = SELL, 2 = HOLD.
        action_label : str
            ``"BUY"`` / ``"SELL"`` / ``"HOLD"``.
        """
        logits = self._forward(obs.flatten())
        action_idx = int(np.argmax(logits))
        return action_idx, self._label_for_action(action_idx)

    def predict(self, market_data: pd.DataFrame) -> tuple[int, str]:
        """End-to-end prediction: raw OHLCV bars -> action.

        Takes a DataFrame of recent 1-minute bars, computes the 10
        technical-indicator features (via ``feature_extraction.extract``),
        takes the last 30 rows as the observation window, and runs the
        neural network forward pass to get the action.

        Parameters
        ----------
        market_data : pd.DataFrame
            Recent 1-minute bars with at least the columns
            ``open, high, low, close, volume, vwap, trade_count``.
            Should contain >= ``window_size`` rows (more is better so that
            rolling indicators warm up properly).

        Returns
        -------
        action_idx : int
        action_label : str
        """
        df = self._prepare_features(market_data)
        window = (
            df[self.feature_cols]
            .iloc[-self.window_size:]
            .values
            .astype(np.float32)
        )
        return self.predict_from_observation(window)

    def predict_signal(
        self,
        market_data: pd.DataFrame,
        current_position: str = "cash",
    ) -> dict:
        """Return a frontend/API friendly signal payload."""
        df = self._prepare_features(market_data)
        window = (
            df[self.feature_cols]
            .iloc[-self.window_size:]
            .values
            .astype(np.float32)
        )
        logits = self._forward(window.flatten())
        action_idx = int(np.argmax(logits))
        probabilities = self._softmax(logits)
        label = self._label_for_action(action_idx)

        signal = {
            "action_index": action_idx,
            "action": label,
            "confidence": float(probabilities[action_idx]),
            "probabilities": {
                self._label_for_action(i): float(probabilities[i])
                for i in range(len(probabilities))
            },
            "logits": {
                self._label_for_action(i): float(logits[i])
                for i in range(len(logits))
            },
            "window_size": self.window_size,
            "feature_columns": self.feature_cols,
            "bars_received": int(len(market_data)),
            "confidence_threshold": self.confidence_threshold,
        }

        if self.action_count == 2:
            trade = self._trade_from_target(label, current_position)
            signal["target_position"] = label
            signal["raw_trade"] = trade
            signal["trade"] = trade
        else:
            signal["raw_trade"] = label
            signal["trade"] = label
            signal["warning"] = (
                "This is a legacy 3-output checkpoint. New BSH training should "
                "produce 2 outputs: CASH and ASSET."
            )

        if signal["confidence"] < self.confidence_threshold:
            signal["trade"] = "HOLD"
            signal["reason"] = "confidence_below_threshold"
            if self.action_count == 2:
                signal["target_position"] = current_position.strip().upper()

        return signal

    def get_action_logits(self, market_data: pd.DataFrame) -> dict[str, float]:
        """Return the raw logits (scores) for each action.

        Useful for debugging — lets you see how confident the model is
        in each action before argmax picks the winner.

        Returns
        -------
        dict
            ``{"BUY": float, "SELL": float, "HOLD": float}``
        """
        df = self._prepare_features(market_data)
        window = (
            df[self.feature_cols]
            .iloc[-self.window_size:]
            .values
            .astype(np.float32)
        )
        logits = self._forward(window.flatten())
        return {self._label_for_action(i): float(logits[i]) for i in range(len(logits))}

    def get_action_probabilities(self, market_data: pd.DataFrame) -> dict[str, float]:
        """Return softmax probabilities for each action.

        Converts the raw logits into probabilities (0-1, summing to 1.0)
        using the softmax function:  prob_i = exp(logit_i) / sum(exp(logits)).
        https://en.wikipedia.org/wiki/Softmax_function

        Returns
        -------
        dict
            ``{"BUY": float, "SELL": float, "HOLD": float}`` summing to 1.0.
        """
        df = self._prepare_features(market_data)
        window = (
            df[self.feature_cols]
            .iloc[-self.window_size:]
            .values
            .astype(np.float32)
        )
        logits = self._forward(window.flatten())
        probs = self._softmax(logits)
        return {self._label_for_action(i): float(probs[i]) for i in range(len(probs))}

    def _prepare_features(self, market_data: pd.DataFrame) -> pd.DataFrame:
        missing = [col for col in REQUIRED_COLUMNS if col not in market_data.columns]
        if missing:
            raise ValueError(f"Missing market data columns: {', '.join(missing)}")

        if len(market_data) < MIN_BARS:
            raise ValueError(
                f"Need at least {MIN_BARS} bars for a {self.window_size}-bar "
                "model window with 30-minute return features"
            )

        df = extract(market_data)
        feature_values = df[self.feature_cols].iloc[-self.window_size:]
        if not np.isfinite(feature_values.values).all():
            raise ValueError("Feature extraction produced NaN or infinite values")
        return df

    def _label_for_action(self, action_idx: int) -> str:
        if self.action_count == 2:
            return TARGET_POSITION_MAP[action_idx]
        return LEGACY_ACTION_MAP[action_idx]

    @staticmethod
    def _softmax(logits: np.ndarray) -> np.ndarray:
        exp = np.exp(logits - logits.max())
        return exp / exp.sum()

    @staticmethod
    def _trade_from_target(target_position: str, current_position: str) -> str:
        current = current_position.strip().upper()
        if current not in {"CASH", "ASSET"}:
            current = "CASH"
        if target_position == current:
            return "HOLD"
        return "BUY" if target_position == "ASSET" else "SELL"
