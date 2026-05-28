# Training

Use the active supervised trainer when you want a model that actually takes paper positions:

```bash
backend/.venv/bin/python model-dev/training/train_active_policy.py \
  model-dev/training/big_training.csv \
  --output-dir model-dev/training/best_qqq_model \
  --lookahead 60 \
  --positive-return-threshold 0.0002 \
  --epochs 10 \
  --asset-logit-bias 0.25
```

Then restart the backend so it reloads `model-dev/training/best_qqq_model/model_weights.npz`.

The active policy predicts a target position:

- `CASH`: stay out of QQQ or sell an open QQQ position.
- `ASSET`: buy/hold QQQ.

The backend also has a paper-trading trailing take-profit overlay. Once an open
position has reached at least `TRADING_TAKE_PROFIT_PCT` percent profit and
`TRADING_TAKE_PROFIT_MIN_USD` dollars profit, the executor keeps holding while
the price rises. It sells only after profit pulls back by
`TRADING_TRAILING_STOP_PCT` percentage points from the best price seen since the
buy.

Keep `ALPACA_PAPER_TRADING=true` while experimenting.
