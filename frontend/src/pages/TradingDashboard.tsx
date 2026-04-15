import { useEffect, useState } from "react";
import { Play, Square, AlertCircle, Lock } from "lucide-react";

export function TradingDashboard() {
    const [botRunning, setBotRunning] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const [showApiKey, setShowApiKey] = useState(false);
    const [sessionId, setSessionId] = useState(null);

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

    // 🔥 IA SESSION DIN BACKEND
    const fetchSession = async () => {
        try {
            const res = await fetch("/api/sessions?user_id=1");
            const data = await res.json();

            if (data.sessions.length > 0) {
                const session = data.sessions[0];

                setSessionId(session.id);

                if (session.status === "ACTIVE") {
                    setBotRunning(true);

                    const start = new Date(session.start_timestamp);
                    const now = new Date();

                    const diff = Math.floor((now - start) / 1000);
                    setSeconds(diff);
                } else {
                    setBotRunning(false);
                }
            }
        } catch (err) {
            console.error(err);
        }
    };

    // 🔁 update la 1 sec
    useEffect(() => {
        fetchSession();

        const interval = setInterval(() => {
            fetchSession();
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    // ▶️ START / STOP
    const handleStartStop = async () => {
        try {
            if (botRunning) {
                // STOP
                await fetch(`/api/sessions/${sessionId}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        status: "STOPPED",
                        stop_timestamp: new Date().toISOString(),
                    }),
                });
            } else {
                if (!isFormValid) return;

                // START
                await fetch("/api/sessions", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        user_id: 1,
                        status: "ACTIVE",
                    }),
                });
            }

            fetchSession();
        } catch (err) {
            console.error(err);
        }
    };

    const handleChange = (field, value) => {
        setSettings({ ...settings, [field]: value });
    };

    const formatTime = () => {
        const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
        const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
        const s = String(seconds % 60).padStart(2, "0");
        return `${h}:${m}:${s}`;
    };

    return (
        <div className="min-h-screen bg-gray-100 p-6">
            <div className="max-w-5xl mx-auto space-y-6">

                {/* HEADER */}
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                        Trading Dashboard
                    </h1>
                    <p className="text-gray-500">
                        Manage your trading session and settings.
                    </p>
                </div>

                {/* BOT STATUS */}
                <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-gray-900">
                            Bot Status
                        </h2>

                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            botRunning
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-700"
                        }`}>
                            {botRunning ? "Running" : "Stopped"}
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

                    <button
                        onClick={handleStartStop}
                        disabled={!botRunning && !isFormValid}
                        className={`flex items-center gap-2 px-5 py-3 rounded-lg font-semibold text-white ${
                            botRunning
                                ? "bg-red-600 hover:bg-red-700"
                                : isFormValid
                                ? "bg-green-600 hover:bg-green-700"
                                : "bg-gray-300 text-gray-500 cursor-not-allowed"
                        }`}
                    >
                        {botRunning ? (
                            <>
                                <Square size={18} />
                                Stop Trading
                            </>
                        ) : (
                            <>
                                <Play size={18} />
                                Start Trading
                            </>
                        )}
                    </button>
                </div>

                {/* SETTINGS */}
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

                {/* SESSION */}
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