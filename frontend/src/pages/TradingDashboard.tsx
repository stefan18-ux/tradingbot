import { useState } from "react";
import "./TradingDashboard.css";

export function TradingDashboard() {
    const [isBotRunning, setIsBotRunning] = useState(false);
    const [apiKey, setApiKey] = useState("");
    const [investmentAmount, setInvestmentAmount] = useState("");
    const [showApiKey, setShowApiKey] = useState(false);
    const [maxLoss, setMaxLoss] = useState("");
    const [duration, setDuration] = useState("1h");

    const tradingSettings = {
        apiKey,
        investmentAmount,
        maxLoss,
        duration,
    };

    const isFormValid =
        apiKey.trim() !== "" &&
        investmentAmount.trim() !== "" &&
        maxLoss.trim() !== "";

    const handleToggleBot = () => {
        if (!isBotRunning && !isFormValid) {
            return;
        }

        setIsBotRunning(!isBotRunning);
    };

    const handleToggleApiKeyVisibility = () => {
        setShowApiKey(!showApiKey);
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

                        <p>
                            Status: {isBotRunning ? "Running" : "Stopped"}
                        </p>

                        <button
                            className={isBotRunning ? "btn stop" : "btn start"}
                            onClick={handleToggleBot}
                            disabled={!isBotRunning && !isFormValid}
                        >
                            {isBotRunning ? "Stop Trading" : "Start Trading"}
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
                                    value={apiKey}
                                    onChange={(event) => {
                                        setApiKey(event.target.value);
                                    }}
                                    placeholder="Enter your API key"
                                    disabled={isBotRunning}
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
                                value={investmentAmount}
                                onChange={(event) => {
                                    setInvestmentAmount(event.target.value);
                                }}
                                disabled={isBotRunning}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="maxLoss">Maximum Loss ($)</label>
                            <input
                                className="form-input"
                                id="maxLoss"
                                type="number"
                                placeholder="e.g. 500"
                                value={maxLoss}
                                onChange={(event) => {
                                    setMaxLoss(event.target.value);
                                }}
                                disabled={isBotRunning}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="duration">Duration</label>

                            <select
                                className="form-input"
                                id="duration"
                                value={duration}
                                onChange={(event) => {
                                    setDuration(event.target.value);
                                }}
                                disabled={isBotRunning}
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