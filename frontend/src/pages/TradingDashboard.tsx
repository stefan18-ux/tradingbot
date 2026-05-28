// If you use useNavigate, import it from react-router-dom
import { useEffect, useState } from "react";
import { Play, Square, AlertCircle, Lock, RefreshCw } from "lucide-react";
import {
    apiFetch,
    fetchTradingLoopStatus,
    runTradingTick,
    startTradingLoop,
    stopTradingLoop,
    type TradingLoopResponse,
    type TradingLoopStatus,
} from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

export function TradingDashboard() {
    const [botRunning, setBotRunning] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const [showApiKey, setShowApiKey] = useState(false);
    const [sessionId, setSessionId] = useState<number | null>(null);
    const [wallet, setWallet] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [backendStatus, setBackendStatus] = useState<"checking" | "ok" | "error">("checking");
    const [lastTradingStart, setLastTradingStart] = useState<TradingLoopResponse | null>(null);
    const [loopStatus, setLoopStatus] = useState<TradingLoopStatus | null>(null);
    const [sessionStatus, setSessionStatus] = useState<string | null>(null);
    const [checkingTick, setCheckingTick] = useState(false);
    const { dbUserId } = useAuth();

    const [settings, setSettings] = useState({
        apiKey: "",
        investmentAmount: "",
        maxLoss: "",
        duration: "1h",
    });

    const isFormValid =
        settings.apiKey.trim() !== "" &&
        settings.investmentAmount.trim() !== "" &&
        settings.maxLoss.trim() !== "";

    const fetchSession = async () => {
        if (!dbUserId) return;
        try {
            const res = await apiFetch(`/api/sessions?user_id=${dbUserId}`);
            const data = await res.json();

            if (data.sessions.length > 0) {
                const session = data.sessions[0];
                setSessionId(session.id);
                setSessionStatus(session.status);

                if (session.status === "ACTIVE") {
                    setBotRunning(true);

                    const start = new Date(
                        session.start_timestamp.endsWith("Z")
                            ? session.start_timestamp
                            : session.start_timestamp + "Z"
                    );
                    const now = new Date();
                    const diff = Math.floor((now.getTime() - start.getTime()) / 1000);

                    setSeconds(diff);
                } else {
                    setBotRunning(false);
                    setSeconds(0);
                    if (session.status !== "FAILED") {
                        setLoopStatus(null);
                    }
                }
            } else {
                setBotRunning(false);
                setSeconds(0);
                setSessionId(null);
                setSessionStatus(null);
                setLoopStatus(null);
            }
        } catch (err) {
            console.error("Error fetching session:", err);
        }
    };

    const fetchUserSettings = async (isInitial = false) => {
        if (!dbUserId) return;
        try {
            const res = await apiFetch(`/api/users/${dbUserId}`);
            const data = await res.json();

            if (isInitial) {
                setSettings((prev) => ({
                    ...prev,
                    apiKey: data.api_key || "",
                }));
            }

            if (data.wallet !== undefined && data.wallet !== null) {
                const num = Number(data.wallet);
                setWallet(!isNaN(num) ? num.toFixed(4) : "");
            } else {
                setWallet("");
            }
        } catch (err) {
            console.error("Error fetching user settings:", err);
        }
    };

    useEffect(() => {
        fetchSession();
        fetchUserSettings(true);

        const interval = setInterval(() => {
            fetchSession();
            fetchUserSettings(false);
        }, 1000);

        return () => clearInterval(interval);
    }, [dbUserId]);

    useEffect(() => {
        let active = true;

        async function checkBackend() {
            try {
                const res = await apiFetch("/health");
                if (active) setBackendStatus(res.ok ? "ok" : "error");
            } catch (err) {
                console.error("Backend health check failed:", err);
                if (active) setBackendStatus("error");
            }
        }

        checkBackend();
        const interval = setInterval(checkBackend, 10000);

        return () => {
            active = false;
            clearInterval(interval);
        };
    }, []);

    const fetchLoopStatus = async (targetSessionId = sessionId) => {
        if (!targetSessionId) return;
        try {
            const status = await fetchTradingLoopStatus(targetSessionId);
            setLoopStatus(status);
        } catch (err) {
            console.error("Error fetching trading loop status:", err);
        }
    };

    useEffect(() => {
        if (!sessionId || sessionStatus !== "ACTIVE") return;

        fetchLoopStatus(sessionId);
        const interval = setInterval(() => fetchLoopStatus(sessionId), 5000);

        return () => clearInterval(interval);
    }, [sessionId, sessionStatus]);

    const handleStartStop = async () => {
        setSubmitting(true);
        setMessage("");
        setError("");

        try {
            if (botRunning && sessionId) {
                const stopped = await stopTradingLoop(sessionId);

                const res = await apiFetch(`/api/sessions/${sessionId}`, {
                    method: "PUT",
                    body: JSON.stringify({
                        status: "STOPPED",
                        stop_timestamp: new Date().toISOString(),
                    }),
                });

                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || "Failed to stop trading session.");
                }

                setMessage(stopped.liquidation?.decision || "Trading session stopped.");
                setLastTradingStart(null);
                setLoopStatus(stopped.status ?? null);
                setSessionStatus("STOPPED");
            } else {
                if (!dbUserId) {
                    throw new Error("Log in before starting a trading session.");
                }

                if (!isFormValid) {
                    throw new Error("Complete all trading settings before starting.");
                }

                const investmentAmount = Number(settings.investmentAmount);
                const maxLoss = Number(settings.maxLoss);

                if (!Number.isFinite(investmentAmount) || investmentAmount <= 0) {
                    throw new Error("Investment Amount must be greater than 0.");
                }

                if (!Number.isFinite(maxLoss) || maxLoss <= 0) {
                    throw new Error("Max Loss must be greater than 0.");
                }

                const settingsRes = await apiFetch(`/api/users/${dbUserId}`, {
                    method: "PUT",
                    body: JSON.stringify({
                        api_key: settings.apiKey.trim(),
                        wallet: investmentAmount,
                    }),
                });

                if (!settingsRes.ok) {
                    const data = await settingsRes.json();
                    throw new Error(data.error || "Failed to save trading settings.");
                }

                const sessionRes = await apiFetch("/api/sessions", {
                    method: "POST",
                    body: JSON.stringify({
                        user_id: dbUserId,
                        status: "ACTIVE",
                    }),
                });

                const sessionData = await sessionRes.json();
                if (!sessionRes.ok) {
                    throw new Error(sessionData.error || "Failed to start trading session.");
                }

                try {
                    const loopStart = await startTradingLoop(sessionData.id);
                    setLastTradingStart(loopStart);
                    setLoopStatus(
                        loopStart.status ?? {
                            session_id: sessionData.id,
                            running: loopStart.running,
                            last_checked_at: loopStart.preflight?.checked_at ?? null,
                            last_result: loopStart.preflight ?? null,
                            last_error: null,
                        }
                    );
                } catch (startErr) {
                    await apiFetch(`/api/sessions/${sessionData.id}`, {
                        method: "PUT",
                        body: JSON.stringify({
                            status: "FAILED",
                            stop_timestamp: new Date().toISOString(),
                        }),
                    });
                    throw startErr;
                }

                setSessionId(sessionData.id);
                setSessionStatus("ACTIVE");
                setBotRunning(true);
                setSeconds(0);
                setMessage("Trading session and paper-trading loop started.");
            }

            await fetchSession();
            await fetchUserSettings();
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : "Trading action failed.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleCheckSignal = async () => {
        if (!sessionId) return;

        setCheckingTick(true);
        setError("");

        try {
            const result = await runTradingTick(sessionId, true);
            setLoopStatus({
                session_id: sessionId,
                running: botRunning,
                last_checked_at: result.checked_at ?? null,
                last_result: result,
                last_error: null,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not check the latest signal.");
        } finally {
            setCheckingTick(false);
        }
    };

    const handleChange = (field: string, value: any) => {
        setSettings({ ...settings, [field]: value });
    };

    const formatTime = () => {
        const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
        const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
        const s = String(seconds % 60).padStart(2, "0");
        return `${h}:${m}:${s}`;
    };

    const latestTick = loopStatus?.last_result ?? lastTradingStart?.preflight ?? null;
    const latestError = loopStatus?.last_error ?? null;
    const botStatusLabel = botRunning
        ? loopStatus?.running === false
            ? "Loop offline"
            : "Running"
        : sessionStatus === "FAILED"
        ? "Failed"
        : "Stopped";
    const botStatusClass = botRunning
        ? loopStatus?.running === false
            ? "bg-yellow-100 text-yellow-700"
            : "bg-green-100 text-green-700"
        : sessionStatus === "FAILED"
        ? "bg-red-100 text-red-700"
        : "bg-gray-100 text-gray-700";
    const checkedAt = latestTick?.checked_at ?? loopStatus?.last_checked_at;
    const paperCash = Number(latestTick?.account?.cash);
    const paperPortfolioValue = Number(latestTick?.account?.portfolio_value);
    const totalPnl = Number(latestTick?.performance?.session_pnl_if_sold_now);
    const sellNowPnl = Number(latestTick?.performance?.pnl_if_sold_now);
    const sellNowValue = Number(latestTick?.performance?.position_value_if_sold_now);
    const boughtAt = Number(latestTick?.performance?.bought_at);
    const currentStockPrice = Number(latestTick?.performance?.current_stock_price);
    const profitRule = latestTick?.signal.profit_rule;

    return (
        <div className="min-h-screen bg-gray-100 p-6">
            <div className="max-w-5xl mx-auto space-y-6">

                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-3xl font-bold text-gray-900">
                            Trading Dashboard
                        </h1>
                        <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                backendStatus === "ok"
                                    ? "bg-green-100 text-green-700"
                                    : backendStatus === "checking"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-red-100 text-red-700"
                            }`}
                        >
                            {backendStatus === "ok"
                                ? "Backend connected"
                                : backendStatus === "checking"
                                ? "Checking backend"
                                : "Backend offline"}
                        </span>
                    </div>
                    <p className="text-gray-500">
                        Manage your trading session and settings.
                    </p>
                </div>

                {message && (
                    <div className="bg-green-100 border border-green-300 text-green-800 p-3 rounded-lg">
                        {message}
                    </div>
                )}

                {error && (
                    <div className="bg-red-100 border border-red-300 text-red-800 p-3 rounded-lg">
                        {error}
                    </div>
                )}

                {(latestTick || latestError) && (
                    <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
                        <div className="flex items-center justify-between gap-4 mb-3">
                            <h2 className="text-xl font-semibold text-gray-900">
                                Latest Trading Check
                            </h2>
                            {botRunning && (
                                <button
                                    onClick={handleCheckSignal}
                                    disabled={checkingTick}
                                    className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-wait disabled:text-gray-400"
                                >
                                    <RefreshCw size={16} className={checkingTick ? "animate-spin" : ""} />
                                    {checkingTick ? "Checking..." : "Check Signal"}
                                </button>
                            )}
                        </div>

                        {latestError && (
                            <div className="bg-red-100 border border-red-300 text-red-800 p-3 rounded-lg mb-4">
                                {latestError}
                            </div>
                        )}

                        {latestTick && (
                            <div className="space-y-4">
                                <div className="grid md:grid-cols-5 gap-4 text-sm">
                                    <div>
                                        <p className="text-gray-500">Symbol</p>
                                        <p className="font-semibold text-gray-900">{latestTick.symbol}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500">Signal</p>
                                        <p className="font-semibold text-gray-900">
                                            {latestTick.signal.trade}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500">Confidence</p>
                                        <p className="font-semibold text-gray-900">
                                            {(latestTick.signal.confidence * 100).toFixed(1)}%
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500">Latest Close</p>
                                        <p className="font-semibold text-gray-900">
                                            ${latestTick.latest_close.toFixed(2)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500">Position</p>
                                        <p className="font-semibold text-gray-900">
                                            {latestTick.position}
                                        </p>
                                    </div>
                                </div>

                                {latestTick.decision && (
                                    <div className="bg-gray-50 border border-gray-200 text-gray-800 p-3 rounded-lg text-sm">
                                        {latestTick.decision}
                                    </div>
                                )}

                                <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-gray-500">
                                    <span>Mode: {latestTick.paper ? "Paper" : "Live"}</span>
                                    {latestTick.account && Number.isFinite(paperCash) && (
                                        <span>Paper cash: ${paperCash.toFixed(2)}</span>
                                    )}
                                    {latestTick.account && Number.isFinite(paperPortfolioValue) && (
                                        <span>Paper portfolio: ${paperPortfolioValue.toFixed(2)}</span>
                                    )}
                                    {latestTick.performance && Number.isFinite(boughtAt) && (
                                        <span>Bought at: ${boughtAt.toFixed(2)}</span>
                                    )}
                                    {latestTick.performance && Number.isFinite(currentStockPrice) && (
                                        <span>Current price: ${currentStockPrice.toFixed(2)}</span>
                                    )}
                                    {latestTick.performance && Number.isFinite(sellNowValue) && (
                                        <span>Value if sold: ${sellNowValue.toFixed(2)}</span>
                                    )}
                                    {latestTick.performance && Number.isFinite(sellNowPnl) && (
                                        <span>P/L if sold: {formatSignedDollars(sellNowPnl)}</span>
                                    )}
                                    {latestTick.performance && Number.isFinite(totalPnl) && (
                                        <span>Session P/L if sold: {formatSignedDollars(totalPnl)}</span>
                                    )}
                                    {profitRule && (
                                        <span>
                                            Profit rule: {profitRule.armed ? "armed" : "watching"} | peak{" "}
                                            {profitRule.peak_return_pct}% | pullback{" "}
                                            {profitRule.drawdown_from_peak_pct}%
                                        </span>
                                    )}
                                    <span>
                                        Last checked:{" "}
                                        {checkedAt ? new Date(checkedAt).toLocaleTimeString() : "unknown"}
                                    </span>
                                    {latestTick.order && <span>Order: {latestTick.order.status}</span>}
                                    {latestTick.trade && <span>Trade row: #{latestTick.trade.id}</span>}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-gray-900">
                            Bot Status
                        </h2>

                        <span
                            className={`px-3 py-1 rounded-full text-sm font-semibold ${botStatusClass}`}
                        >
                            {botStatusLabel}
                        </span>
                    </div>

                    {!isFormValid && !botRunning && (
                        <div className="flex items-center gap-2 bg-yellow-100 border border-yellow-300 text-yellow-800 p-3 rounded-lg mb-4">
                            <AlertCircle size={18} />
                            <span>
                                Trading settings must be completed before starting trading.
                            </span>
                        </div>
                    )}

                    {botRunning && (
                        <div className="mb-4">
                            <p className="text-sm text-gray-500">Configured Investment Amount</p>
                            <p className="text-2xl font-bold text-gray-900">
                                ${wallet || "0.00"}
                            </p>
                        </div>
                    )}

                    <button
                        onClick={handleStartStop}
                        disabled={submitting}
                        className={`flex items-center gap-2 px-5 py-3 rounded-lg font-semibold text-white ${
                            submitting
                                ? "bg-gray-400 cursor-wait"
                                : botRunning
                                ? "bg-red-600 hover:bg-red-700"
                                : isFormValid
                                ? "bg-green-600 hover:bg-green-700"
                                : "bg-gray-300 text-gray-500 cursor-not-allowed"
                        }`}
                    >
                        {botRunning ? (
                            <>
                                <Square size={18} />
                                {submitting ? "Stopping..." : "Stop Trading"}
                            </>
                        ) : (
                            <>
                                <Play size={18} />
                                {submitting ? "Starting..." : "Start Trading"}
                            </>
                        )}
                    </button>
                </div>

                <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-gray-900">
                            Trading Settings
                        </h2>
                        {botRunning && <Lock size={18} className="text-gray-400" />}
                    </div>

                    {botRunning && (
                        <div className="flex items-center gap-2 bg-blue-100 border border-blue-300 text-blue-800 p-3 rounded-lg mb-4">
                            <Lock size={18} />
                            <span>
                                Trading settings are locked while a trading session is active.
                            </span>
                        </div>
                    )}

                    <div className="grid md:grid-cols-2 gap-4">

                        <div>
                            <label className="block mb-1 font-semibold text-gray-700">
                                Trading API Key
                            </label>

                            <div className="flex gap-2">
                                <input
                                    type={showApiKey ? "text" : "password"}
                                    value={settings.apiKey}
                                    onChange={(e) => handleChange("apiKey", e.target.value)}
                                    disabled={botRunning}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                />

                                <button
                                    onClick={() => setShowApiKey(!showApiKey)}
                                    className="px-3 py-2 border rounded-lg"
                                >
                                    {showApiKey ? "Hide" : "Show"}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block mb-1 font-semibold text-gray-700">
                                Investment Amount
                            </label>
                            <input
                                type="number"
                                value={settings.investmentAmount}
                                onChange={(e) =>
                                    handleChange("investmentAmount", e.target.value)
                                }
                                disabled={botRunning}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                        </div>

                        <div>
                            <label className="block mb-1 font-semibold text-gray-700">
                                Max Loss
                            </label>
                            <input
                                type="number"
                                value={settings.maxLoss}
                                onChange={(e) =>
                                    handleChange("maxLoss", e.target.value)
                                }
                                disabled={botRunning}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                        </div>

                        <div>
                            <label className="block mb-1 font-semibold text-gray-700">
                                Duration
                            </label>
                            <select
                                value={settings.duration}
                                onChange={(e) =>
                                    handleChange("duration", e.target.value)
                                }
                                disabled={botRunning}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            >
                                <option value="1h">1 Hour</option>
                                <option value="4h">4 Hours</option>
                                <option value="8h">8 Hours</option>
                                <option value="24h">24 Hours</option>
                            </select>
                        </div>

                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">
                        Current Session {botRunning ? "(Active)" : ""}
                    </h2>

                    {botRunning ? (
                        <div className="text-2xl font-mono font-bold text-blue-600">
                            {formatTime()}
                        </div>
                    ) : (
                        <p className="text-gray-500">
                            No active trading session.
                        </p>
                    )}
                </div>

            </div>
        </div>
    );
}

function formatSignedDollars(value: number) {
    const amount = Math.abs(value).toFixed(2);
    if (!Number.isFinite(value) || value === 0) return `$${amount}`;
    return `${value > 0 ? "+" : "-"}$${amount}`;
}
