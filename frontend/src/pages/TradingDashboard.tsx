import { useState } from "react";

export function TradingDashboard() {
    const [isBotRunning, setIsBotRunning] = useState(false);
    const [apiKey, setApiKey] = useState("");
    const [investmentAmount, setInvestmentAmount] = useState("");
    const isFormValid = apiKey.trim() !== "" && investmentAmount.trim() !== "";
    const [showApiKey, setShowApiKey] = useState(false);

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
        <div>
            <h1>Trading Dashboard</h1>

            <section>
                <h2>Bot Status</h2>

                <p>
                    Status: {isBotRunning ? "Running" : "Stopped"}
                </p>

                <button
                    onClick={handleToggleBot}
                    disabled={!isBotRunning && !isFormValid}
                >
                    {isBotRunning ? "Stop Trading" : "Start Trading"}
                </button>
            </section>

            <section>
                <h2>Trading Settings</h2>

                <div>
                    <label htmlFor="apiKey">Trading API Key</label>

                    <div>
                        <input
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
                    <div>
                        <label htmlFor="investment">Investment Amount ($)</label>
                        <input
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

            </section>

            <section>
                <h2>Current Session</h2>
            </section>
        </div>
    );
}