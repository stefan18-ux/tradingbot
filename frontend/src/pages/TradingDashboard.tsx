import { useState } from "react";
import "./TradingDashboard.css";

export function TradingDashboard() {
    const [botRunning, setBotRunning] = useState(false);
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

    const handleStartStop = () => {
        if (!botRunning && !isFormValid) {
            return;
        }

        setBotRunning(!botRunning);
    };

    const handleToggleApiKeyVisibility = () => {
        setShowApiKey(!showApiKey);
    };

    const handleSettingChange = (field, value) => {
        setSettings((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    return (
        <div className="trading-page">
            <div className="trading-container">
                <div>
                    <header className="page-header">
                        <h1>Trading Dashboard</h1>
                        <p>Manage your trading session and settings.</p>
                    </header>

                    <section className="card">
                        <h2>Bot Status</h2>

                        <p>Status: {botRunning ? "Running" : "Stopped"}</p>

                        <button
                            className={botRunning ? "btn stop" : "btn start"}
                            onClick={handleStartStop}
                            disabled={!botRunning && !isFormValid}
                        >
                            {botRunning ? "Stop Trading" : "Start Trading"}
                        </button>
                    </section>

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
                                    onChange={(event) => {
                                        handleSettingChange("apiKey", event.target.value);
                                    }}
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
                                onChange={(event) => {
                                    handleSettingChange("investmentAmount", event.target.value);
                                }}
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
                                onChange={(event) => {
                                    handleSettingChange("maxLoss", event.target.value);
                                }}
                                disabled={botRunning}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="duration">Duration</label>

                            <select
                                className="form-input"
                                id="duration"
                                value={settings.duration}
                                onChange={(event) => {
                                    handleSettingChange("duration", event.target.value);
                                }}
                                disabled={botRunning}
                            >
                                <option value="1h">1 Hour</option>
                                <option value="4h">4 Hours</option>
                                <option value="8h">8 Hours</option>
                                <option value="24h">24 Hours</option>
                            </select>
                        </div>
                    </section>

                    <section className="card">
                        <h2>Current Session</h2>
                    </section>
                </div>
            </div>
        </div>
    );
}