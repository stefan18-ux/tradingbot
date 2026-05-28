import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from sklearn.metrics import accuracy_score, precision_recall_fscore_support
from torch import nn
from torch.utils.data import DataLoader, TensorDataset

import sys

MODEL_DEV_PATH = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(MODEL_DEV_PATH))

from features.feature_extraction import extract, get_feature_cols  # noqa: E402


WINDOW_SIZE = 30
HIDDEN_SIZE = 128


class ActivePolicy(nn.Module):
    def __init__(self, input_size: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_size, HIDDEN_SIZE),
            nn.Tanh(),
            nn.Linear(HIDDEN_SIZE, HIDDEN_SIZE),
            nn.Tanh(),
            nn.Linear(HIDDEN_SIZE, 2),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


def build_windows(
    data: pd.DataFrame,
    *,
    lookahead: int,
    positive_return_threshold: float,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    data = extract(data)
    feature_cols = get_feature_cols()
    features = data[feature_cols].to_numpy(dtype=np.float32)
    future_return = (
        data["close"].shift(-lookahead).to_numpy(dtype=np.float32)
        / data["close"].to_numpy(dtype=np.float32)
        - 1.0
    )

    xs: list[np.ndarray] = []
    ys: list[int] = []
    closes: list[float] = []
    last_index = len(data) - lookahead
    for idx in range(WINDOW_SIZE - 1, last_index):
        xs.append(features[idx - WINDOW_SIZE + 1 : idx + 1].reshape(-1))
        ys.append(int(future_return[idx] > positive_return_threshold))
        closes.append(float(data["close"].iloc[idx]))

    return (
        np.asarray(xs, dtype=np.float32),
        np.asarray(ys, dtype=np.int64),
        np.asarray(closes, dtype=np.float32),
    )


def chronological_split(
    x: np.ndarray,
    y: np.ndarray,
    closes: np.ndarray,
) -> tuple[tuple[np.ndarray, np.ndarray, np.ndarray], ...]:
    train_end = int(len(x) * 0.7)
    val_end = int(len(x) * 0.85)
    return (
        (x[:train_end], y[:train_end], closes[:train_end]),
        (x[train_end:val_end], y[train_end:val_end], closes[train_end:val_end]),
        (x[val_end:], y[val_end:], closes[val_end:]),
    )


def class_weights(y: np.ndarray) -> torch.Tensor:
    counts = np.bincount(y, minlength=2).astype(np.float32)
    weights = counts.sum() / (2.0 * np.maximum(counts, 1.0))
    return torch.tensor(weights, dtype=torch.float32)


def evaluate_model(
    model: nn.Module,
    x: np.ndarray,
    y: np.ndarray,
    closes: np.ndarray,
    *,
    commission: float,
    batch_size: int,
) -> dict:
    logits = predict_logits(model, x, batch_size=batch_size)
    probs = softmax(logits)
    pred = logits.argmax(axis=1)
    precision, recall, f1, _ = precision_recall_fscore_support(
        y,
        pred,
        average="binary",
        zero_division=0,
    )
    return {
        "accuracy": float(accuracy_score(y, pred)),
        "precision_asset": float(precision),
        "recall_asset": float(recall),
        "f1_asset": float(f1),
        "asset_ratio": float(pred.mean()),
        "mean_confidence": float(probs.max(axis=1).mean()),
        **simulate_strategy(pred, closes, commission=commission),
    }


def predict_logits(model: nn.Module, x: np.ndarray, *, batch_size: int) -> np.ndarray:
    model.eval()
    outputs = []
    with torch.no_grad():
        for start in range(0, len(x), batch_size):
            batch = torch.from_numpy(x[start : start + batch_size])
            outputs.append(model(batch).cpu().numpy())
    return np.concatenate(outputs, axis=0)


def softmax(logits: np.ndarray) -> np.ndarray:
    shifted = logits - logits.max(axis=1, keepdims=True)
    exp = np.exp(shifted)
    return exp / exp.sum(axis=1, keepdims=True)


def simulate_strategy(target_positions: np.ndarray, closes: np.ndarray, *, commission: float) -> dict:
    if len(target_positions) < 2:
        return {"pnl_pct": 0.0, "buy_count": 0, "sell_count": 0, "position_flips": 0}

    returns = closes[1:] / closes[:-1] - 1.0
    held_positions = target_positions[:-1]
    flips = np.diff(target_positions) != 0
    strategy_returns = held_positions * returns
    strategy_returns[flips] -= commission
    equity = float(np.prod(1.0 + strategy_returns) - 1.0)
    buy_count = int(((target_positions[1:] == 1) & (target_positions[:-1] == 0)).sum())
    sell_count = int(((target_positions[1:] == 0) & (target_positions[:-1] == 1)).sum())
    return {
        "pnl_pct": equity,
        "buy_count": buy_count,
        "sell_count": sell_count,
        "position_flips": int(flips.sum()),
    }


def save_as_backend_weights(
    model: ActivePolicy,
    output_dir: Path,
    metadata: dict,
    *,
    asset_logit_bias: float = 0.0,
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    layers = [module for module in model.net if isinstance(module, nn.Linear)]
    b_logits = layers[2].bias.detach().cpu().numpy().astype(np.float32)
    if asset_logit_bias:
        b_logits = b_logits.copy()
        b_logits[1] += np.float32(asset_logit_bias)

    np.savez(
        output_dir / "model_weights.npz",
        W1=layers[0].weight.detach().cpu().numpy().astype(np.float32),
        b1=layers[0].bias.detach().cpu().numpy().astype(np.float32),
        W2=layers[1].weight.detach().cpu().numpy().astype(np.float32),
        b2=layers[1].bias.detach().cpu().numpy().astype(np.float32),
        W_logits=layers[2].weight.detach().cpu().numpy().astype(np.float32),
        b_logits=b_logits,
    )
    (output_dir / "active_policy_metadata.json").write_text(
        json.dumps(metadata, indent=2),
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Train an active 2-action CASH/ASSET policy.")
    parser.add_argument("training_data_path")
    parser.add_argument("--output-dir", default="best_qqq_model_active")
    parser.add_argument("--lookahead", type=int, default=30)
    parser.add_argument("--positive-return-threshold", type=float, default=0.0)
    parser.add_argument("--epochs", type=int, default=12)
    parser.add_argument("--batch-size", type=int, default=2048)
    parser.add_argument("--learning-rate", type=float, default=1e-3)
    parser.add_argument("--commission", type=float, default=0.0002)
    parser.add_argument("--asset-logit-bias", type=float, default=0.0)
    parser.add_argument("--seed", type=int, default=7)
    args = parser.parse_args()

    torch.manual_seed(args.seed)
    np.random.seed(args.seed)

    data = pd.read_csv(args.training_data_path)
    if "timestamp" in data.columns:
        data = data.sort_values("timestamp")

    x, y, closes = build_windows(
        data,
        lookahead=args.lookahead,
        positive_return_threshold=args.positive_return_threshold,
    )
    (x_train, y_train, closes_train), (x_val, y_val, closes_val), (x_test, y_test, closes_test) = (
        chronological_split(x, y, closes)
    )

    train_loader = DataLoader(
        TensorDataset(torch.from_numpy(x_train), torch.from_numpy(y_train)),
        batch_size=args.batch_size,
        shuffle=True,
    )

    model = ActivePolicy(input_size=x.shape[1])
    optimizer = torch.optim.Adam(model.parameters(), lr=args.learning_rate)
    loss_fn = nn.CrossEntropyLoss(weight=class_weights(y_train))

    best_state = None
    best_score = float("-inf")
    best_epoch = 0
    history = []

    for epoch in range(1, args.epochs + 1):
        model.train()
        losses = []
        for xb, yb in train_loader:
            optimizer.zero_grad()
            loss = loss_fn(model(xb), yb)
            loss.backward()
            optimizer.step()
            losses.append(float(loss.item()))

        val_metrics = evaluate_model(
            model,
            x_val,
            y_val,
            closes_val,
            commission=args.commission,
            batch_size=args.batch_size,
        )
        score = val_metrics["f1_asset"] + min(val_metrics["position_flips"], 500) / 5000
        history.append({"epoch": epoch, "loss": float(np.mean(losses)), **val_metrics})
        print(
            f"epoch={epoch:02d} loss={np.mean(losses):.5f} "
            f"val_acc={val_metrics['accuracy']:.3f} "
            f"asset_ratio={val_metrics['asset_ratio']:.3f} "
            f"flips={val_metrics['position_flips']} "
            f"pnl={val_metrics['pnl_pct']:.2%}"
        )

        if score > best_score:
            best_score = score
            best_epoch = epoch
            best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}

    if best_state is not None:
        model.load_state_dict(best_state)

    train_metrics = evaluate_model(
        model, x_train, y_train, closes_train, commission=args.commission, batch_size=args.batch_size
    )
    val_metrics = evaluate_model(
        model, x_val, y_val, closes_val, commission=args.commission, batch_size=args.batch_size
    )
    test_metrics = evaluate_model(
        model, x_test, y_test, closes_test, commission=args.commission, batch_size=args.batch_size
    )
    metadata = {
        "kind": "active_supervised_cash_asset_policy",
        "source_data": str(Path(args.training_data_path).resolve()),
        "window_size": WINDOW_SIZE,
        "lookahead": args.lookahead,
        "positive_return_threshold": args.positive_return_threshold,
        "epochs": args.epochs,
        "best_epoch": best_epoch,
        "feature_columns": get_feature_cols(),
        "class_labels": {"0": "CASH", "1": "ASSET"},
        "train": train_metrics,
        "validation": val_metrics,
        "test": test_metrics,
        "calibration": {
            "asset_logit_bias": args.asset_logit_bias,
        },
    }

    output_dir = Path(args.output_dir)
    save_as_backend_weights(
        model,
        output_dir,
        metadata,
        asset_logit_bias=args.asset_logit_bias,
    )
    print(json.dumps(metadata, indent=2))
    print(f"saved active policy to {output_dir / 'model_weights.npz'}")


if __name__ == "__main__":
    main()
