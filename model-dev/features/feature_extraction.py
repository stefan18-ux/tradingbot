import numpy as np
import pandas as pd


def extract(df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes features for bars of 1 minute.
    Input:  DataFrame with columns: open, high, low, close, volume, vwap, trade_count
    Output: DataFrame with added features, normalized between [-1, 1] or [0, 1]
    """
    df = df.copy()

    # ------------------------------------------------------------------
    # 1. RETURNS — cat s-a miscat pretul in ultimele N minute
    #    tanh() comprima valorile in (-1, 1), evita outlieri mari
    # ------------------------------------------------------------------
    for p in [1, 5, 15, 30]:
        df[f'ret_{p}m'] = np.tanh(df['close'].pct_change(p) * 10)

    # ------------------------------------------------------------------
    # 2. RSI(14) — supracumparat (>70) / supravandut (<30)
    #    normalizat in [-1, 1]: 0=neutru, 1=maxim supracumparat
    # ------------------------------------------------------------------
    delta = df['close'].diff()
    gain = delta.where(delta > 0, 0).rolling(14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
    rs = gain / (loss + 1e-10)
    df['rsi'] = (100 - (100 / (1 + rs)) - 50) / 50  # [-1, 1]

    # ------------------------------------------------------------------
    # 3. VWAP DISTANCE — cat de departe e pretul de VWAP
    #    pozitiv = pret peste VWAP (bullish), negativ = sub VWAP (bearish)
    # ------------------------------------------------------------------
    df['vwap_dist'] = np.tanh((df['close'] - df['vwap']) / (df['vwap'] + 1e-10) * 100)

    # ------------------------------------------------------------------
    # 4. BOLLINGER BAND POSITION — unde e pretul in banda
    #    0 = la banda de jos, 1 = la banda de sus
    # ------------------------------------------------------------------
    bb_mid = df['close'].rolling(20).mean()
    bb_std = df['close'].rolling(20).std()
    bb_low  = bb_mid - 2 * bb_std
    bb_high = bb_mid + 2 * bb_std
    df['bb_pos'] = ((df['close'] - bb_low) / (bb_high - bb_low + 1e-10)).clip(0, 1)

    # ------------------------------------------------------------------
    # 5. VOLUME RATIO — volum curent vs media pe 20 minute
    #    >1 = volum mare (miscare importanta), <1 = volum mic (linistit)
    # ------------------------------------------------------------------
    df['volume_ratio'] = np.log1p(
        df['volume'] / (df['volume'].rolling(20).mean() + 1e-10)
    )

    # ------------------------------------------------------------------
    # 6. TRADE COUNT RATIO — nr tranzactii vs media pe 20 minute
    #    mai bun decat volumul: arata activitatea reala a participantilor
    # ------------------------------------------------------------------
    df['trade_count_ratio'] = np.log1p(
        df['trade_count'] / (df['trade_count'].rolling(20).mean() + 1e-10)
    )

    # ------------------------------------------------------------------
    # 7. TREND — SMA5 vs SMA20 (mai rapid decat SMA20/SMA50 pe 1 minut)
    #    pozitiv = uptrend, negativ = downtrend
    # ------------------------------------------------------------------
    sma5  = df['close'].rolling(5).mean()
    sma20 = df['close'].rolling(20).mean()
    df['trend'] = np.tanh((sma5 - sma20) / (sma20 + 1e-10) * 100)

    # ------------------------------------------------------------------
    # Curata NaN-urile rezultate din rolling windows
    # ------------------------------------------------------------------
    df = df.bfill().ffill()

    return df

def get_feature_cols() -> list:
    """Returns the list of features used for the model."""
    return [
        'ret_1m',
        'ret_5m',
        'ret_15m',
        'ret_30m',
        'rsi',
        'vwap_dist',
        'bb_pos',
        'volume_ratio',
        'trade_count_ratio',
        'trend',
    ]