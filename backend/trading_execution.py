import logging
import os
import threading
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from typing import Any

import pandas as pd
from alpaca.data.enums import DataFeed
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest
from alpaca.data.timeframe import TimeFrame
from alpaca.trading.client import TradingClient
from alpaca.trading.enums import OrderSide, TimeInForce
from alpaca.trading.requests import MarketOrderRequest

from database.models import Session, SessionStatus, Trade, TradeType, User, db
from trading_agent import TradingAgent
from utils.encryption import decrypt_secret

logger = logging.getLogger(__name__)

DEFAULT_SYMBOL = "QQQ"
DEFAULT_INTERVAL_SECONDS = 60
DEFAULT_BAR_LOOKBACK_MINUTES = 180
DEFAULT_TAKE_PROFIT_PCT = Decimal("0.10")
DEFAULT_TRAILING_STOP_PCT = Decimal("0.05")
DEFAULT_TAKE_PROFIT_MIN_USD = Decimal("0.01")
MIN_NOTIONAL = Decimal("1")
DATA_FEEDS = {
    "iex": DataFeed.IEX,
    "sip": DataFeed.SIP,
}

_loops: dict[int, tuple[threading.Event, threading.Thread]] = {}
_loop_results: dict[int, dict[str, Any]] = {}
_loops_lock = threading.Lock()
_resume_checked = False


class TradingExecutionError(RuntimeError):
    pass


def _paper_trading_enabled() -> bool:
    return os.getenv("ALPACA_PAPER_TRADING", "true").lower() != "false"


def _get_user_secret(user: User) -> str:
    if not user.api_key:
        raise TradingExecutionError("Save your Alpaca API key before starting trading.")
    if not user.alpaca_secret:
        raise TradingExecutionError("Save your Alpaca API secret in Account Settings before starting trading.")
    return decrypt_secret(user.alpaca_secret)


def _clients_for_user(user: User) -> tuple[TradingClient, StockHistoricalDataClient]:
    secret = _get_user_secret(user)
    trading = TradingClient(user.api_key, secret, paper=_paper_trading_enabled())
    data = StockHistoricalDataClient(user.api_key, secret)
    return trading, data


def _bars_to_frame(raw_df: pd.DataFrame, symbol: str) -> pd.DataFrame:
    if raw_df.empty:
        raise TradingExecutionError(f"No recent market bars returned for {symbol}.")

    df = raw_df.reset_index()
    if "symbol" in df.columns:
        df = df[df["symbol"] == symbol]

    required = ["open", "high", "low", "close", "volume", "trade_count"]
    missing = [col for col in required if col not in df.columns]
    if missing:
        raise TradingExecutionError(f"Alpaca bars missing columns: {', '.join(missing)}")

    if "vwap" not in df.columns:
        df["vwap"] = df["close"]
    df["vwap"] = df["vwap"].fillna(df["close"])

    return df.sort_values("timestamp" if "timestamp" in df.columns else df.index.name or df.columns[0])


def fetch_recent_bars(data_client: StockHistoricalDataClient, symbol: str) -> pd.DataFrame:
    lookback = int(os.getenv("TRADING_BAR_LOOKBACK_MINUTES", DEFAULT_BAR_LOOKBACK_MINUTES))
    feed_name = os.getenv("ALPACA_DATA_FEED", "iex").lower()
    feed = DATA_FEEDS.get(feed_name, DataFeed.IEX)
    end = datetime.now(timezone.utc)
    start = end - timedelta(minutes=lookback)

    request = StockBarsRequest(
        symbol_or_symbols=[symbol],
        timeframe=TimeFrame.Minute,
        start=start,
        end=end,
        feed=feed,
    )
    bars = data_client.get_stock_bars(request)
    return _bars_to_frame(bars.df, symbol)


def _current_position(trading_client: TradingClient, symbol: str) -> tuple[str, Decimal]:
    position = _get_open_position(trading_client, symbol)
    qty = _position_quantity(position)
    return ("asset" if qty > 0 else "cash"), qty


def _get_open_position(trading_client: TradingClient, symbol: str) -> Any | None:
    try:
        return trading_client.get_open_position(symbol)
    except Exception:
        return None


def _position_quantity(position: Any | None) -> Decimal:
    try:
        qty = Decimal(str(position.qty))
    except (InvalidOperation, TypeError, AttributeError):
        return Decimal("0")
    return qty


def _position_snapshot(position: Any | None) -> dict[str, str] | None:
    qty = _position_quantity(position)
    if qty <= 0:
        return {
            "state": "CASH",
            "quantity": _quantity(Decimal("0")),
        }

    avg_entry = _decimal(getattr(position, "avg_entry_price", None))
    current_price = _decimal(getattr(position, "current_price", None))
    market_value = _decimal(getattr(position, "market_value", None))
    cost_basis = _decimal(getattr(position, "cost_basis", None))
    unrealized_pl = _decimal(getattr(position, "unrealized_pl", None))

    if current_price <= 0 and market_value > 0:
        current_price = market_value / qty
    if market_value <= 0 and current_price > 0:
        market_value = qty * current_price
    if cost_basis <= 0 and avg_entry > 0:
        cost_basis = qty * avg_entry
    if unrealized_pl == 0 and market_value > 0 and cost_basis > 0:
        unrealized_pl = market_value - cost_basis

    unrealized_plpc_pct = (
        (unrealized_pl / cost_basis) * Decimal("100")
        if cost_basis > 0
        else Decimal("0")
    )

    return {
        "state": "ASSET",
        "quantity": _quantity(qty),
        "avg_entry_price": _money(avg_entry),
        "current_price": _money(current_price),
        "market_value": _money(market_value),
        "cost_basis": _money(cost_basis),
        "unrealized_pl": _money(unrealized_pl),
        "unrealized_plpc_pct": str(unrealized_plpc_pct.quantize(Decimal("0.01"))),
    }


def _buying_power(trading_client: TradingClient) -> Decimal:
    account = trading_client.get_account()
    try:
        return Decimal(str(account.buying_power))
    except (InvalidOperation, TypeError, AttributeError) as exc:
        raise TradingExecutionError("Could not read Alpaca buying power.") from exc


def _account_snapshot(trading_client: TradingClient) -> dict[str, str]:
    account = trading_client.get_account()
    return {
        "cash": str(getattr(account, "cash", "") or ""),
        "buying_power": str(getattr(account, "buying_power", "") or ""),
        "portfolio_value": str(getattr(account, "portfolio_value", "") or ""),
    }


def _investment_amount(user: User, trading_client: TradingClient) -> Decimal:
    configured = Decimal(str(user.wallet or 0))
    if configured > 0:
        return min(configured, _buying_power(trading_client))
    return Decimal("0")


def _submit_order(
    trading_client: TradingClient,
    symbol: str,
    trade: str,
    investment_amount: Decimal,
    current_qty: Decimal,
) -> Any | None:
    if trade == "BUY":
        if investment_amount < MIN_NOTIONAL:
            raise TradingExecutionError("Investment amount/buying power is too small to place an order.")
        order = MarketOrderRequest(
            symbol=symbol,
            notional=str(investment_amount.quantize(Decimal("0.01"))),
            side=OrderSide.BUY,
            time_in_force=TimeInForce.DAY,
        )
        return trading_client.submit_order(order)

    if trade == "SELL":
        if current_qty <= 0:
            return None
        order = MarketOrderRequest(
            symbol=symbol,
            qty=str(current_qty),
            side=OrderSide.SELL,
            time_in_force=TimeInForce.DAY,
        )
        return trading_client.submit_order(order)

    return None


def _wait_for_order_fill(trading_client: TradingClient, order: Any | None) -> Any | None:
    if order is None:
        return None

    order_id = getattr(order, "id", None)
    latest_order = order
    attempts = int(os.getenv("TRADING_ORDER_FILL_WAIT_ATTEMPTS", "5"))
    delay_seconds = float(os.getenv("TRADING_ORDER_FILL_WAIT_SECONDS", "0.4"))

    for _ in range(max(attempts, 0)):
        if _decimal(getattr(latest_order, "filled_qty", None)) > 0:
            return latest_order
        if not order_id:
            return latest_order
        time.sleep(delay_seconds)
        try:
            latest_order = trading_client.get_order_by_id(order_id)
        except Exception:
            return latest_order

    return latest_order


def _record_trade(session: Session, trade: str, bars: pd.DataFrame, order: Any | None) -> Trade | None:
    if trade not in {"BUY", "SELL"} or order is None:
        return None

    close_price = Decimal(str(bars.iloc[-1]["close"]))
    filled_qty_value = getattr(order, "filled_qty", None)
    filled_avg_price_value = getattr(order, "filled_avg_price", None)
    filled_qty = _decimal(filled_qty_value)
    filled_avg_price = _decimal(filled_avg_price_value)

    if filled_qty_value is not None and (filled_qty <= 0 or filled_avg_price <= 0):
        logger.warning(
            "Order %s was not recorded as a trade because it has no fill yet.",
            getattr(order, "id", ""),
        )
        return None

    if filled_qty > 0 and filled_avg_price > 0:
        qty = filled_qty
        price = filled_avg_price
    else:
        price = close_price
        qty = getattr(order, "qty", None)
        if qty is None:
            notional = getattr(order, "notional", None)
            qty = Decimal(str(notional or 0)) / close_price if close_price > 0 else Decimal("0")
        else:
            qty = Decimal(str(qty))

    if qty <= 0:
        notional = getattr(order, "notional", None)
        qty = Decimal(str(notional or 0)) / close_price if close_price > 0 else Decimal("0")

    if qty <= 0:
        return None

    trade_row = Trade(
        session_id=session.id,
        price=price,
        quantity=qty,
        type=TradeType[trade],
    )
    db.session.add(trade_row)
    db.session.commit()
    return trade_row


def _decimal(value: Any, default: str = "0") -> Decimal:
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(default)


def _money(value: Decimal) -> str:
    return str(value.quantize(Decimal("0.01")))


def _quantity(value: Decimal) -> str:
    return str(value.quantize(Decimal("0.00000001")))


def _decimal_setting(name: str, default: Decimal) -> Decimal:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default

    value = _decimal(raw_value, str(default))
    return value if value >= 0 else default


def _take_profit_settings() -> tuple[Decimal, Decimal, Decimal]:
    return (
        _decimal_setting("TRADING_TAKE_PROFIT_PCT", DEFAULT_TAKE_PROFIT_PCT),
        _decimal_setting("TRADING_TRAILING_STOP_PCT", DEFAULT_TRAILING_STOP_PCT),
        _decimal_setting("TRADING_TAKE_PROFIT_MIN_USD", DEFAULT_TAKE_PROFIT_MIN_USD),
    )


def _open_position_started_at(session: Session) -> datetime | None:
    position_qty = Decimal("0")
    opened_at = None

    for trade in sorted(session.trades, key=lambda row: row.timestamp or datetime.min):
        qty = _decimal(trade.quantity)
        if trade.type == TradeType.BUY:
            if position_qty <= 0:
                opened_at = trade.timestamp
            position_qty += qty
            continue

        matched_qty = min(qty, position_qty) if position_qty > 0 else qty
        position_qty -= matched_qty
        if position_qty <= 0:
            position_qty = Decimal("0")
            opened_at = None

    return opened_at


def _peak_price_since_open(session: Session, bars: pd.DataFrame) -> Decimal:
    if "high" not in bars.columns or bars.empty:
        return Decimal("0")

    opened_at = _open_position_started_at(session)
    relevant_bars = bars
    if opened_at is not None and "timestamp" in bars.columns:
        opened = opened_at
        if opened.tzinfo is None:
            opened = opened.replace(tzinfo=timezone.utc)
        timestamps = pd.to_datetime(bars["timestamp"], utc=True, errors="coerce")
        since_open = bars[timestamps >= pd.Timestamp(opened)]
        if not since_open.empty:
            relevant_bars = since_open

    try:
        return Decimal(str(relevant_bars["high"].max()))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal("0")


def calculate_session_performance(session: Session, mark_price: Decimal | None = None) -> dict:
    trades = sorted(session.trades, key=lambda trade: trade.timestamp or datetime.min)
    position_qty = Decimal("0")
    avg_cost = Decimal("0")
    realized_pnl = Decimal("0")
    bought_notional = Decimal("0")
    sold_notional = Decimal("0")
    bought_quantity = Decimal("0")
    buy_count = 0
    sell_count = 0

    for trade in trades:
        qty = _decimal(trade.quantity)
        price = _decimal(trade.price)
        notional = qty * price

        if trade.type == TradeType.BUY:
            buy_count += 1
            bought_notional += notional
            bought_quantity += qty
            new_qty = position_qty + qty
            if new_qty > 0:
                avg_cost = ((avg_cost * position_qty) + notional) / new_qty
            position_qty = new_qty
            continue

        sell_count += 1
        sold_notional += notional
        matched_qty = min(qty, position_qty) if position_qty > 0 else qty
        realized_pnl += (price - avg_cost) * matched_qty
        position_qty -= matched_qty
        if position_qty <= 0:
            position_qty = Decimal("0")
            avg_cost = Decimal("0")

    current_price = mark_price if mark_price is not None else avg_cost
    market_value = position_qty * current_price
    open_cost_basis = position_qty * avg_cost
    unrealized_pnl = position_qty * (current_price - avg_cost) if position_qty > 0 else Decimal("0")
    total_pnl = realized_pnl + unrealized_pnl
    sell_now_return_pct = (
        (unrealized_pnl / open_cost_basis) * Decimal("100")
        if open_cost_basis > 0
        else Decimal("0")
    )
    average_buy_price = (
        bought_notional / bought_quantity
        if bought_quantity > 0
        else Decimal("0")
    )
    bought_at = avg_cost if position_qty > 0 else average_buy_price

    return {
        "trade_count": len(trades),
        "buy_count": buy_count,
        "sell_count": sell_count,
        "open_quantity": _quantity(position_qty),
        "bought_at": _money(bought_at) if bought_at > 0 else "0.00",
        "current_stock_price": _money(current_price) if current_price > 0 else "0.00",
        "open_cost_basis": _money(open_cost_basis),
        "position_value_if_sold_now": _money(market_value),
        "pnl_if_sold_now": _money(unrealized_pnl),
        "return_if_sold_now_pct": str(sell_now_return_pct.quantize(Decimal("0.01"))),
        "session_pnl_if_sold_now": _money(total_pnl),
        "average_entry_price": _money(avg_cost) if avg_cost > 0 else "0.00",
        "average_buy_price": _money(average_buy_price) if average_buy_price > 0 else "0.00",
        "mark_price": _money(current_price) if current_price > 0 else "0.00",
        "market_value": _money(market_value),
        "bought_notional": _money(bought_notional),
        "sold_notional": _money(sold_notional),
        "realized_pnl": _money(realized_pnl),
        "unrealized_pnl": _money(unrealized_pnl),
        "total_pnl": _money(total_pnl),
        "total_profit": _money(max(total_pnl, Decimal("0"))),
        "total_loss": _money(max(-total_pnl, Decimal("0"))),
    }


def _apply_live_position_to_performance(performance: dict, position: Any | None) -> dict:
    snapshot = _position_snapshot(position)
    if not snapshot or snapshot["state"] != "ASSET":
        return performance
    if not _live_position_matches_session(performance, position):
        return performance

    realized_pnl = _decimal(performance.get("realized_pnl"))
    unrealized_pnl = _decimal(snapshot.get("unrealized_pl"))
    total_pnl = realized_pnl + unrealized_pnl

    updated = dict(performance)
    updated.update({
        "source": "alpaca_position",
        "open_quantity": snapshot["quantity"],
        "bought_at": snapshot["avg_entry_price"],
        "current_stock_price": snapshot["current_price"],
        "open_cost_basis": snapshot["cost_basis"],
        "position_value_if_sold_now": snapshot["market_value"],
        "pnl_if_sold_now": snapshot["unrealized_pl"],
        "return_if_sold_now_pct": snapshot["unrealized_plpc_pct"],
        "session_pnl_if_sold_now": _money(total_pnl),
        "average_entry_price": snapshot["avg_entry_price"],
        "average_buy_price": snapshot["avg_entry_price"],
        "mark_price": snapshot["current_price"],
        "market_value": snapshot["market_value"],
        "unrealized_pnl": snapshot["unrealized_pl"],
        "total_pnl": _money(total_pnl),
        "total_profit": _money(max(total_pnl, Decimal("0"))),
        "total_loss": _money(max(-total_pnl, Decimal("0"))),
    })
    return updated


def _live_position_matches_session(performance: dict, position: Any | None) -> bool:
    live_qty = _position_quantity(position)
    session_qty = _decimal(performance.get("open_quantity"))
    if live_qty <= 0 or session_qty <= 0:
        return False

    tolerance = max(Decimal("0.0001"), session_qty * Decimal("0.01"))
    return abs(live_qty - session_qty) <= tolerance


def _format_trades_for_session(session: Session, live_position: Any | None = None) -> list[dict | None]:
    trades = sorted(session.trades, key=lambda trade: trade.timestamp or datetime.min, reverse=True)
    snapshot = _position_snapshot(live_position)

    session_performance = calculate_session_performance(session)
    if (
        snapshot
        and snapshot["state"] == "ASSET"
        and _live_position_matches_session(session_performance, live_position)
    ):
        buy_trades = [trade for trade in session.trades if trade.type == TradeType.BUY]
        sell_trades = [trade for trade in session.trades if trade.type == TradeType.SELL]
        if len(buy_trades) == 1 and not sell_trades:
            trade = buy_trades[0]
            return [{
                "id": trade.id,
                "session_id": trade.session_id,
                "price": snapshot["avg_entry_price"],
                "quantity": snapshot["quantity"],
                "type": trade.type.value,
                "timestamp": trade.timestamp.isoformat() if trade.timestamp else None,
                "source": "alpaca_position",
            }]

    return [_format_trade(trade) for trade in trades]


def _apply_profit_taking_rule(
    signal: dict,
    performance: dict,
    current_position: str,
    session: Session,
    bars: pd.DataFrame,
) -> dict:
    if current_position != "asset" or signal.get("trade") == "SELL":
        return signal

    take_profit_pct, trailing_stop_pct, min_profit_usd = _take_profit_settings()
    open_quantity = _decimal(performance.get("open_quantity"))
    bought_at = _decimal(performance.get("bought_at"))
    pnl_if_sold_now = _decimal(performance.get("pnl_if_sold_now"))
    return_if_sold_now_pct = _decimal(performance.get("return_if_sold_now_pct"))
    peak_price = _peak_price_since_open(session, bars)
    peak_return_pct = (
        ((peak_price - bought_at) / bought_at) * Decimal("100")
        if bought_at > 0 and peak_price > 0
        else return_if_sold_now_pct
    )
    drawdown_from_peak_pct = max(peak_return_pct - return_if_sold_now_pct, Decimal("0"))

    updated_signal = dict(signal)
    updated_signal["profit_rule"] = {
        "mode": "trailing_take_profit",
        "armed": peak_return_pct >= take_profit_pct,
        "take_profit_threshold_pct": float(take_profit_pct),
        "trailing_stop_pct": float(trailing_stop_pct),
        "peak_price_since_buy": _money(peak_price) if peak_price > 0 else "0.00",
        "peak_return_pct": str(peak_return_pct.quantize(Decimal("0.01"))),
        "drawdown_from_peak_pct": str(drawdown_from_peak_pct.quantize(Decimal("0.01"))),
        "min_profit_usd": _money(min_profit_usd),
    }

    if open_quantity <= 0:
        return updated_signal
    if pnl_if_sold_now < min_profit_usd:
        return updated_signal
    if peak_return_pct < take_profit_pct:
        return updated_signal
    if drawdown_from_peak_pct < trailing_stop_pct:
        return updated_signal

    updated_signal["model_trade_before_override"] = signal.get("trade")
    updated_signal["model_target_before_override"] = signal.get("target_position")
    updated_signal["trade"] = "SELL"
    updated_signal["reason"] = "trailing_take_profit_reached"
    updated_signal["execution_rule"] = "trailing_take_profit"
    updated_signal["take_profit_threshold_pct"] = float(take_profit_pct)
    updated_signal["trailing_stop_pct"] = float(trailing_stop_pct)
    updated_signal["peak_return_pct"] = str(peak_return_pct.quantize(Decimal("0.01")))
    updated_signal["drawdown_from_peak_pct"] = str(drawdown_from_peak_pct.quantize(Decimal("0.01")))
    updated_signal["take_profit_min_usd"] = _money(min_profit_usd)
    updated_signal["pnl_if_sold_now"] = _money(pnl_if_sold_now)
    updated_signal["return_if_sold_now_pct"] = str(return_if_sold_now_pct)
    return updated_signal


def get_session_performance(session_id: int, symbol: str = DEFAULT_SYMBOL) -> dict:
    session = Session.query.get(session_id)
    if not session:
        raise TradingExecutionError("Session not found.")

    user = User.query.get(session.user_id)
    if not user:
        raise TradingExecutionError("Session user not found.")

    latest_trade = max(session.trades, key=lambda trade: trade.timestamp or datetime.min, default=None)
    fallback_mark_price = _decimal(latest_trade.price) if latest_trade else None
    fallback_performance = calculate_session_performance(session, fallback_mark_price)
    open_quantity = _decimal(fallback_performance["open_quantity"])
    needs_live_mark = session.status == SessionStatus.ACTIVE or open_quantity > 0

    account = None
    position = None
    live_position = None
    market_error = None
    mark_price = fallback_mark_price
    price_source = "last_trade" if latest_trade else "none"

    if needs_live_mark:
        try:
            trading_client, data_client = _clients_for_user(user)
            bars = fetch_recent_bars(data_client, symbol)
            mark_price = _decimal(bars.iloc[-1]["close"])
            price_source = "alpaca_iex"
            account = _account_snapshot(trading_client)
            live_position = _get_open_position(trading_client, symbol)
            position = _position_snapshot(live_position)
        except Exception as exc:
            logger.warning("Could not fetch live session performance for %s: %s", session_id, exc)
            market_error = str(exc)

    performance = _apply_live_position_to_performance(
        calculate_session_performance(session, mark_price),
        live_position,
    )
    if performance.get("source") == "alpaca_position":
        price_source = "alpaca_position"
    return {
        "session_id": session.id,
        "symbol": symbol,
        "status": session.status.value,
        "price_source": price_source,
        "market_error": market_error,
        "account": account,
        "position": position,
        "performance": performance,
        "trades": _format_trades_for_session(session, live_position),
    }


def liquidate_session_position(session_id: int, symbol: str = DEFAULT_SYMBOL) -> dict:
    session = Session.query.get(session_id)
    if not session:
        raise TradingExecutionError("Session not found.")

    user = User.query.get(session.user_id)
    if not user:
        raise TradingExecutionError("Session user not found.")

    trading_client, data_client = _clients_for_user(user)
    bars = fetch_recent_bars(data_client, symbol)
    live_position = _get_open_position(trading_client, symbol)
    qty = _position_quantity(live_position)
    position = "asset" if qty > 0 else "cash"

    order = None
    recorded_trade = None
    if position == "asset" and qty > 0:
        order = _submit_order(
            trading_client=trading_client,
            symbol=symbol,
            trade="SELL",
            investment_amount=Decimal("0"),
            current_qty=qty,
        )
        order = _wait_for_order_fill(trading_client, order)
        recorded_trade = _record_trade(session, "SELL", bars, order)

    account = _account_snapshot(trading_client)
    post_live_position = _get_open_position(trading_client, symbol)
    performance = _apply_live_position_to_performance(
        calculate_session_performance(session, _decimal(bars.iloc[-1]["close"])),
        post_live_position,
    )
    session.pnl = _decimal(performance["total_pnl"])
    db.session.commit()

    return {
        "session_id": session.id,
        "symbol": symbol,
        "paper": _paper_trading_enabled(),
        "liquidated": order is not None,
        "position_before": position.upper(),
        "position_quantity_before": _quantity(qty),
        "latest_close": float(bars.iloc[-1]["close"]),
        "account": account,
        "order": _format_order(order),
        "trade": _format_trade(recorded_trade),
        "performance": performance,
        "decision": (
            "Submitted paper SELL before stopping the session."
            if order is not None
            else "No open position to sell before stopping the session."
        ),
        "checked_at": _utc_now_iso(),
    }


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _decision_message(
    signal: dict,
    trade: str,
    dry_run: bool,
    order: Any | None,
    current_qty: Decimal,
    current_position: str,
) -> str:
    if signal.get("reason") == "trailing_take_profit_reached":
        pnl = signal.get("pnl_if_sold_now", "0.00")
        return_pct = signal.get("return_if_sold_now_pct", "0.00")
        peak_pct = signal.get("peak_return_pct", "0.00")
        trailing_stop_pct = signal.get("trailing_stop_pct", 0)
        if dry_run:
            return (
                "Preflight only: trailing take-profit rule would submit a SELL because "
                f"open P/L is ${pnl} ({return_pct}%) after peaking at {peak_pct}%."
            )
        if order is not None:
            return (
                "Submitted paper SELL because profit pulled back from its peak by at least "
                f"{trailing_stop_pct}%: open P/L was ${pnl} ({return_pct}%), peak was {peak_pct}%."
            )

    if dry_run:
        if trade == "HOLD":
            return _hold_message(signal, current_position)
        return f"Preflight only: model selected {trade}, so no order was submitted."

    if trade == "HOLD":
        return _hold_message(signal, current_position)

    if trade == "SELL" and current_qty <= 0 and order is None:
        return "Model selected SELL, but there is no open position to sell."

    if order is not None:
        side = getattr(order, "side", trade)
        return f"Submitted paper {side} order to Alpaca."

    return f"Model selected {trade}, but no order was submitted."


def _hold_message(signal: dict, current_position: str | None = None) -> str:
    reason = signal.get("reason")
    raw_trade = signal.get("raw_trade")
    target_position = signal.get("target_position")
    if raw_trade == "HOLD" and target_position and current_position:
        base = (
            f"Model target is {target_position}, and the current position is "
            f"{current_position.upper()}, so no order was needed."
        )
        if reason == "confidence_below_threshold":
            confidence = signal.get("confidence", 0)
            threshold = signal.get("confidence_threshold", 0)
            return f"{base} Confidence was {confidence:.1%}, below the {threshold:.1%} threshold."
        return base

    if reason == "confidence_below_threshold":
        confidence = signal.get("confidence", 0)
        threshold = signal.get("confidence_threshold", 0)
        return (
            f"Model held because confidence was {confidence:.1%}, "
            f"below the {threshold:.1%} threshold."
        )
    if reason:
        return f"Model held: {reason}."
    return "Model selected HOLD, so no order was submitted."


def _remember_tick_result(
    session_id: int,
    *,
    result: dict | None = None,
    error: str | None = None,
) -> None:
    snapshot = {
        "updated_at": _utc_now_iso(),
        "last_result": result,
        "last_error": error,
    }
    with _loops_lock:
        _loop_results[session_id] = snapshot


def run_trading_tick(session_id: int, symbol: str = DEFAULT_SYMBOL, dry_run: bool = False) -> dict:
    try:
        session = Session.query.get(session_id)
        if not session:
            raise TradingExecutionError("Session not found.")
        if session.status != SessionStatus.ACTIVE:
            raise TradingExecutionError("Trading session is not ACTIVE.")

        user = User.query.get(session.user_id)
        if not user:
            raise TradingExecutionError("Session user not found.")

        trading_client, data_client = _clients_for_user(user)
        bars = fetch_recent_bars(data_client, symbol)
        live_position = _get_open_position(trading_client, symbol)
        qty = _position_quantity(live_position)
        position = "asset" if qty > 0 else "cash"
        signal = TradingAgent().predict_signal(bars, current_position=position)
        mark_price = _decimal(bars.iloc[-1]["close"])
        performance_before_order = _apply_live_position_to_performance(
            calculate_session_performance(session, mark_price),
            live_position,
        )
        signal = _apply_profit_taking_rule(signal, performance_before_order, position, session, bars)
        investment_amount = _investment_amount(user, trading_client)

        order = None
        recorded_trade = None
        trade = signal.get("trade", "HOLD")
        if trade in {"BUY", "SELL"} and not dry_run:
            order = _submit_order(trading_client, symbol, trade, investment_amount, qty)
            order = _wait_for_order_fill(trading_client, order)
            recorded_trade = _record_trade(session, trade, bars, order)
        account = _account_snapshot(trading_client)
        post_live_position = _get_open_position(trading_client, symbol) if order is not None else live_position
        performance = _apply_live_position_to_performance(
            calculate_session_performance(session, mark_price),
            post_live_position,
        )
        if not dry_run:
            session.pnl = _decimal(performance["total_pnl"])
            db.session.commit()

        result = {
            "session_id": session.id,
            "symbol": symbol,
            "paper": _paper_trading_enabled(),
            "dry_run": dry_run,
            "position": position.upper(),
            "position_quantity": str(qty),
            "investment_amount": str(investment_amount),
            "latest_close": float(bars.iloc[-1]["close"]),
            "account": account,
            "performance": performance,
            "signal": signal,
            "order": _format_order(order),
            "trade": _format_trade(recorded_trade),
            "decision": _decision_message(signal, trade, dry_run, order, qty, position),
            "checked_at": _utc_now_iso(),
        }
        _remember_tick_result(session_id, result=result)
        return result
    except Exception as exc:
        _remember_tick_result(session_id, error=str(exc))
        raise



def _format_order(order: Any | None) -> dict | None:
    if order is None:
        return None
    return {
        "id": str(getattr(order, "id", "")),
        "symbol": getattr(order, "symbol", None),
        "side": str(getattr(order, "side", "")),
        "status": str(getattr(order, "status", "")),
        "qty": str(getattr(order, "qty", "") or ""),
        "notional": str(getattr(order, "notional", "") or ""),
    }


def _format_trade(trade: Trade | None) -> dict | None:
    if trade is None:
        return None
    return {
        "id": trade.id,
        "session_id": trade.session_id,
        "price": str(trade.price),
        "quantity": str(trade.quantity),
        "type": trade.type.value,
        "timestamp": trade.timestamp.isoformat() if trade.timestamp else None,
    }


def start_trading_loop(app, session_id: int, symbol: str = DEFAULT_SYMBOL) -> bool:
    with _loops_lock:
        existing = _loops.get(session_id)
        if existing and existing[1].is_alive():
            return False

        stop_event = threading.Event()
        thread = threading.Thread(
            target=_loop_worker,
            args=(app, session_id, symbol, stop_event),
            daemon=True,
        )
        _loops[session_id] = (stop_event, thread)
        thread.start()
        return True


def stop_trading_loop(session_id: int) -> bool:
    with _loops_lock:
        existing = _loops.pop(session_id, None)
    if not existing:
        return False
    existing[0].set()
    return True


def trading_loop_status(session_id: int) -> dict:
    with _loops_lock:
        existing = _loops.get(session_id)
        snapshot = _loop_results.get(session_id, {})
    return {
        "session_id": session_id,
        "running": bool(existing and existing[1].is_alive()),
        "last_checked_at": snapshot.get("updated_at"),
        "last_result": snapshot.get("last_result"),
        "last_error": snapshot.get("last_error"),
    }


def _loop_worker(app, session_id: int, symbol: str, stop_event: threading.Event) -> None:
    interval = int(os.getenv("TRADING_LOOP_INTERVAL_SECONDS", DEFAULT_INTERVAL_SECONDS))
    while not stop_event.is_set():
        with app.app_context():
            try:
                run_trading_tick(session_id, symbol=symbol)
            except TradingExecutionError as exc:
                logger.exception("Trading loop tick failed for session %s", session_id)
                db.session.rollback()
                if _should_stop_loop(exc):
                    _mark_session_failed_if_needed(session_id, exc)
                    stop_event.set()
            except Exception as exc:
                logger.exception("Trading loop tick failed for session %s; will retry", session_id)
                db.session.rollback()
        stop_event.wait(interval)


def _should_stop_loop(exc: TradingExecutionError) -> bool:
    message = str(exc)
    fatal_prefixes = (
        "Session not found.",
        "Session user not found.",
        "Save your Alpaca",
    )
    return message == "Trading session is not ACTIVE." or message.startswith(fatal_prefixes)


def _mark_session_failed_if_needed(session_id: int, exc: TradingExecutionError) -> None:
    if str(exc) == "Trading session is not ACTIVE.":
        return

    session = Session.query.get(session_id)
    if session:
        session.status = SessionStatus.FAILED
        db.session.commit()


def resume_active_trading_loops(app) -> None:
    global _resume_checked

    if _resume_checked:
        return
    if app.debug and os.environ.get("WERKZEUG_RUN_MAIN") != "true":
        return

    _resume_checked = True
    with app.app_context():
        active_session_ids = [
            session.id
            for session in Session.query.filter_by(status=SessionStatus.ACTIVE).all()
        ]

    for session_id in active_session_ids:
        started = start_trading_loop(app, session_id)
        if started:
            logger.info("Resumed trading loop for active session %s", session_id)
