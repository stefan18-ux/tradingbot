import { useState } from "react";

export function TradingDashboard() {
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [apiKey, setApiKey] = useState("");

  const handleToggleBot = () => {
    setIsBotRunning(!isBotRunning);
  };

  return (
    <div>
      <h1>Trading Dashboard</h1>

      <section>
        <h2>Bot Status</h2>

        <p>
          Status: {isBotRunning ? "Running" : "Stopped"}
        </p>

        <button onClick={handleToggleBot}>
          {isBotRunning ? "Stop Trading" : "Start Trading"}
        </button>
      </section>

      <section>
        <h2>Trading Settings</h2>

        <label htmlFor="apiKey">Trading API Key</label>
        <input
          id="apiKey"
          type="text"
          placeholder="Enter your API key"
          value={apiKey}
          onChange={(event) => {
            setApiKey(event.target.value);
          }}
          disabled={isBotRunning}
        />
      </section>

      <section>
        <h2>Current Session</h2>
      </section>
    </div>
  );
}