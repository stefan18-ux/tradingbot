/**
 * Authenticated API client.
 *
 * Wraps fetch() and automatically attaches the Firebase ID token (JWT)
 * as a Bearer token in the Authorization header.
 */

import { auth } from "../firebase";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

/**
 * Get the current Firebase user's ID token (JWT).
 * Returns null if no user is logged in.
 */
export async function getAuthToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;

  try {
    // getIdToken(true) forces a refresh if the token is about to expire
    const token = await user.getIdToken(/* forceRefresh */ false);
    return token;
  } catch (err) {
    console.error("[API] Failed to get auth token:", err);
    return null;
  }
}

/**
 * Authenticated fetch wrapper.
 *
 * Usage:
 *   const res = await apiFetch("/api/users/1");
 *   const data = await res.json();
 *
 *   const res = await apiFetch("/api/sessions", {
 *     method: "POST",
 *     body: JSON.stringify({ user_id: 1 }),
 *   });
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;

  return fetch(url, {
    ...options,
    headers,
  });
}

export type MarketBar = {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap: number;
  trade_count: number;
  timestamp?: string;
  symbol?: string;
};

export type ModelSignal = {
  action_index: number;
  action: string;
  trade: "BUY" | "SELL" | "HOLD" | string;
  confidence: number;
  confidence_threshold?: number;
  execution_rule?: string;
  model_trade_before_override?: string;
  model_target_before_override?: string;
  target_position?: string;
  profit_rule?: {
    mode: string;
    armed: boolean;
    take_profit_threshold_pct: number;
    trailing_stop_pct: number;
    peak_price_since_buy: string;
    peak_return_pct: string;
    drawdown_from_peak_pct: string;
    min_profit_usd: string;
  };
  probabilities: Record<string, number>;
  logits: Record<string, number>;
  reason?: string;
  warning?: string;
};

export type TradingTickResult = {
  session_id: number;
  symbol: string;
  paper: boolean;
  dry_run: boolean;
  position: string;
  position_quantity: string;
  investment_amount: string;
  latest_close: number;
  account?: {
    cash: string;
    buying_power: string;
    portfolio_value: string;
  };
  performance?: SessionPerformance;
  signal: ModelSignal;
  order: {
    id: string;
    symbol?: string;
    side: string;
    status: string;
    qty: string;
    notional: string;
  } | null;
  trade: {
    id: number;
    session_id: number;
    price: string;
    quantity: string;
    type: string;
    timestamp: string | null;
  } | null;
  decision?: string;
  checked_at?: string;
};

export type SessionPerformance = {
  source?: string;
  trade_count: number;
  buy_count: number;
  sell_count: number;
  open_quantity: string;
  bought_at: string;
  current_stock_price: string;
  open_cost_basis: string;
  position_value_if_sold_now: string;
  pnl_if_sold_now: string;
  return_if_sold_now_pct: string;
  session_pnl_if_sold_now: string;
  average_entry_price: string;
  average_buy_price: string;
  mark_price: string;
  market_value: string;
  bought_notional: string;
  sold_notional: string;
  realized_pnl: string;
  unrealized_pnl: string;
  total_pnl: string;
  total_profit: string;
  total_loss: string;
};

export type SessionPerformanceResponse = {
  session_id: number;
  symbol: string;
  status: string;
  price_source: string;
  market_error?: string | null;
  account?: {
    cash: string;
    buying_power: string;
    portfolio_value: string;
  } | null;
  position?: {
    state: string;
    quantity: string;
    avg_entry_price?: string;
    current_price?: string;
    market_value?: string;
    cost_basis?: string;
    unrealized_pl?: string;
    unrealized_plpc_pct?: string;
  } | null;
  performance: SessionPerformance;
  trades: Array<{
    id: number;
    session_id: number;
    price: string;
    quantity: string;
    type: "BUY" | "SELL" | string;
    timestamp: string | null;
    source?: string;
  }>;
};

export type TradingLoopStatus = {
  session_id: number;
  running: boolean;
  last_checked_at?: string | null;
  last_result?: TradingTickResult | null;
  last_error?: string | null;
};

export type TradingLoopResponse = {
  session_id: number;
  symbol: string;
  started?: boolean;
  stopped?: boolean;
  running: boolean;
  preflight?: TradingTickResult;
  status?: TradingLoopStatus;
  liquidation?: TradingTickResult & {
    liquidated: boolean;
    position_before: string;
    position_quantity_before: string;
  };
};

export async function fetchModelSignal(
  bars: MarketBar[],
  currentPosition: "cash" | "asset" = "cash"
): Promise<ModelSignal> {
  const res = await apiFetch("/api/model/predict", {
    method: "POST",
    body: JSON.stringify({
      bars,
      current_position: currentPosition,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to fetch model signal");
  }

  return data;
}

export async function startTradingLoop(
  sessionId: number,
  symbol = "QQQ"
): Promise<TradingLoopResponse> {
  const res = await apiFetch(`/api/trading/sessions/${sessionId}/start`, {
    method: "POST",
    body: JSON.stringify({ symbol }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to start trading loop");
  }

  return data;
}

export async function stopTradingLoop(
  sessionId: number
): Promise<TradingLoopResponse> {
  const res = await apiFetch(`/api/trading/sessions/${sessionId}/stop`, {
    method: "POST",
    body: JSON.stringify({}),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to stop trading loop");
  }

  return data;
}

export async function runTradingTick(
  sessionId: number,
  dryRun = false,
  symbol = "QQQ"
): Promise<TradingTickResult> {
  const res = await apiFetch(`/api/trading/sessions/${sessionId}/tick`, {
    method: "POST",
    body: JSON.stringify({ symbol, dry_run: dryRun }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to run trading tick");
  }

  return data;
}

export async function fetchTradingLoopStatus(
  sessionId: number
): Promise<TradingLoopStatus> {
  const res = await apiFetch(`/api/trading/sessions/${sessionId}/status`);

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to fetch trading loop status");
  }

  return data;
}

export async function fetchSessionPerformance(
  sessionId: number,
  symbol = "QQQ"
): Promise<SessionPerformanceResponse> {
  const res = await apiFetch(`/api/sessions/${sessionId}/performance?symbol=${encodeURIComponent(symbol)}`);

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Failed to fetch session performance");
  }

  return data;
}
