import { useState } from "react";

export function TradingDashboard() {
  const [botRunning, setBotRunning] = useState(false);

  return (
    <div>
      <h1>Trading Dashboard</h1>

      <section>
        <h2>Bot Status</h2>

        <p>Status: {botRunning ? "Running" : "Stopped"}</p>

        <button onClick={() => setBotRunning(!botRunning)}>
          {botRunning ? "Stop Trading" : "Start Trading"}
        </button>
      </section>

      <section>
        <h2>Trading Settings</h2>
      </section>

      <section>
        <h2>Current Session</h2>
      </section>
    </div>
  );
}