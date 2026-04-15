import { useEffect, useState } from "react";
import "./TradingDashboard.css";

export function TradingDashboard() {
    const [botRunning, setBotRunning] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const [showApiKey, setShowApiKey] = useState(false);

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

    useEffect(() => {
        let timer;

        if (botRunning) {
            timer = setInterval(() => {
                setSeconds((prevSeconds) => prevSeconds + 1);
            }, 1000);
        }

        return () => {
            clearInterval(timer);
        };
    }, [botRunning]);

    const handleStartStop = () => {
        if (botRunning) {
            setBotRunning(false);
            setSeconds(0);
        } else {
            if (!isFormValid) {
                return;
            }

            setBotRunning(true);
        }
    };

    const handleToggleApiKeyVisibility = () => {
        setShowApiKey(!showApiKey);
    };

    const handleApiKeyChange = (event) => {
        setSettings({
            ...settings,
            apiKey: event.target.value,
        });
    };

    const handleInvestmentChange = (event) => {
        setSettings({
            ...settings,
            investmentAmount: event.target.value,
        });
    };

    const handleMaxLossChange = (event) => {
        setSettings({
            ...settings,
            maxLoss: event.target.value,
        });
    };

    const handleDurationChange = (event) => {
        setSettings({
            ...settings,
            duration: event.target.value,
        });
    };

    const formatTime = () => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        const hoursText = String(hours).padStart(2, "0");
        const minutesText = String(minutes).padStart(2, "0");
        const secondsText = String(secs).padStart(2, "0");

        return hoursText + ":" + minutesText + ":" + secondsText;
    };

    return (
        <div className="trading-page">
            <div className="trading-container">
                <div>
                    <header className="page-header">
                        <h1>Trading Dashboard</h1>
                        <p>Manage your trading session and settings.</p>
                    </header>

                    {/* BOT STATUS */}
                    <section className="card">
                        <div className="status-row">
                            <span>Status</span>
                            <span className={botRunning ? "status running" : "status stopped"}>
                                {botRunning ? "Running" : "Stopped"}
                            </span>
                        </div>

                        {!isFormValid && !botRunning && (
                            <div className="warning">
                                Please complete all fields before starting trading
                            </div>
                        )}

                        <button
                            className={botRunning ? "btn stop" : "btn start"}
                            onClick={handleStartStop}
                            disabled={!botRunning && !isFormValid}
                        >
                            {botRunning ? "Stop Trading" : "Start Trading"}
                        </button>
                    </section>

                    {/* SETTINGS */}
                    <section className="card">
                        <h2>Trading Settings</h2>

                        <div className="form-group">
                            <label htmlFor="apiKey">Trading API Key</label>

                            <div className="input-row">
                                <input
                                    className="form-input"
                                    id="apiKey"
                                    type={showApiKey ? "text" : "password"}
                                    value={settings.apiKey}
                                    onChange={handleApiKeyChange}
                                    placeholder="Enter your API key"
                                    disabled={botRunning}
                                />

                                <button type="button" onClick={handleToggleApiKeyVisibility}>
                                    {showApiKey ? "Hide" : "Show"}
                                </button>
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="investment">Investment Amount ($)</label>
                            <input
                                className="form-input"
                                id="investment"
                                type="number"
                                placeholder="e.g. 5000"
                                value={settings.investmentAmount}
                                onChange={handleInvestmentChange}
                                disabled={botRunning}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="maxLoss">Maximum Loss ($)</label>
                            <input
                                className="form-input"
                                id="maxLoss"
                                type="number"
                                placeholder="e.g. 500"
                                value={settings.maxLoss}
                                onChange={handleMaxLossChange}
                                disabled={botRunning}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="duration">Duration</label>

                            <select
                                className="form-input"
                                id="duration"
                                value={settings.duration}
                                onChange={handleDurationChange}
                                disabled={botRunning}
                            >
                                <option value="1h">1 Hour</option>
                                <option value="4h">4 Hours</option>
                                <option value="8h">8 Hours</option>
                                <option value="24h">24 Hours</option>
                            </select>
                        </div>
                    </section>

                    {/* SESSION */}
                    <section className="card">
                        <h2>Current Session {botRunning ? "(Active)" : ""}</h2>

                        {botRunning ? (
                            <p className="session-time">{formatTime()}</p>
                        ) : (
                            <p>No active trading session.</p>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}