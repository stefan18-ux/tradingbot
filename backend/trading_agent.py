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

load_dotenv()
logger = logging.getLogger(__name__)

ACTION_MAP = {0: "BUY", 1: "SELL", 2: "HOLD"}
WINDOW_SIZE = 30


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
            weights_path = os.getenv("MODEL_CHECKPOINT_PATH", "")
        weights_path = Path(weights_path)
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
        return action_idx, ACTION_MAP[action_idx]

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
        df = extract(market_data)
        window = (
            df[self.feature_cols]
            .iloc[-self.window_size:]
            .values
            .astype(np.float32)
        )
        return self.predict_from_observation(window)

    def get_action_logits(self, market_data: pd.DataFrame) -> dict[str, float]:
        """Return the raw logits (scores) for each action.

        Useful for debugging — lets you see how confident the model is
        in each action before argmax picks the winner.

        Returns
        -------
        dict
            ``{"BUY": float, "SELL": float, "HOLD": float}``
        """
        df = extract(market_data)
        window = (
            df[self.feature_cols]
            .iloc[-self.window_size:]
            .values
            .astype(np.float32)
        )
        logits = self._forward(window.flatten())
        return {ACTION_MAP[i]: float(logits[i]) for i in range(len(logits))}

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
        df = extract(market_data)
        window = (
            df[self.feature_cols]
            .iloc[-self.window_size:]
            .values
            .astype(np.float32)
        )
        logits = self._forward(window.flatten())
        exp = np.exp(logits - logits.max())
        probs = exp / exp.sum()
        return {ACTION_MAP[i]: float(probs[i]) for i in range(len(probs))}
