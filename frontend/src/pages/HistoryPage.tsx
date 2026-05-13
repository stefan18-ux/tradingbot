import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";

interface Trade {
  id: number;
  time: string;
  action: "Buy" | "Sell";
  amount: number;
  price: number;
}

interface Session {
  id: string;
  date: string;
  duration: string;
  totalProfit: number;
  totalLoss: number;
  netProfitLoss: number;
  trades: Trade[];
  isCurrent?: boolean;
  startTimestamp?: string | null;
  stopTimestamp?: string | null;
}

interface BackendSession {
  id: number;
  user_id: number;
  start_timestamp: string | null;
  stop_timestamp: string | null;
  pnl: string | null;
  status: "ACTIVE" | "STOPPED" | "COMPLETED" | "FAILED";
}

interface SessionsResponse {
  sessions: BackendSession[];
  total: number;
  limit: number;
  offset: number;
}

export function HistoryPage() {
  const { dbUserId } = useAuth();

  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(
    null
  );
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timerTick, setTimerTick] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTimerTick((previousTick) => previousTick + 1);
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const fetchSessions = async () => {
      if (!dbUserId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await apiFetch(`/api/sessions?user_id=${dbUserId}`);

        if (!response.ok) {
          throw new Error("Failed to fetch sessions");
        }

        const data: SessionsResponse = await response.json();

        const mappedSessions: Session[] = data.sessions.map((session) => {
          const pnl = Number(session.pnl || 0);

          return {
            id: String(session.id),
            date: formatDate(session.start_timestamp),
            duration: "00:00:00",
            totalProfit: pnl > 0 ? pnl : 0,
            totalLoss: pnl < 0 ? Math.abs(pnl) : 0,
            netProfitLoss: pnl,
            isCurrent: session.status === "ACTIVE",
            startTimestamp: session.start_timestamp,
            stopTimestamp: session.stop_timestamp,
            trades: [],
          };
        });

        setSessions(mappedSessions);

        if (mappedSessions.length > 0) {
          setExpandedSessionId(mappedSessions[0].id);
        }
      } catch (err) {
        console.error("Error fetching history sessions:", err);
        setError("Could not load trading history.");
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [dbUserId]);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;

    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const getSessionDuration = (session: Session) => {
    timerTick;

    if (!session.startTimestamp) {
      return session.duration;
    }

    const start = new Date(
      session.startTimestamp.endsWith("Z")
        ? session.startTimestamp
        : `${session.startTimestamp}Z`
    );

    const end = session.stopTimestamp
      ? new Date(
          session.stopTimestamp.endsWith("Z")
            ? session.stopTimestamp
            : `${session.stopTimestamp}Z`
        )
      : new Date();

    const diffInSeconds = Math.max(
      0,
      Math.floor((end.getTime() - start.getTime()) / 1000)
    );

    return formatDuration(diffInSeconds);
  };

  const toggleSession = (sessionId: string) => {
    setExpandedSessionId((currentId) =>
      currentId === sessionId ? null : sessionId
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Trading History</h1>

      {loading && <p className="text-gray-600">Loading sessions...</p>}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && sessions.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <p className="text-gray-600">No trading sessions found yet.</p>
        </div>
      )}

      {!loading && !error && sessions.length > 0 && (
        <div className="space-y-4">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
            >
              <div
                onClick={() => toggleSession(session.id)}
                className={`cursor-pointer p-6 transition hover:bg-gray-50 ${
                  session.isCurrent ? "bg-blue-50" : ""
                }`}
              >
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold text-gray-900">
                      {session.isCurrent
                        ? `Current Session — ${getSessionDuration(session)}`
                        : session.date}
                    </h2>

                    {session.isCurrent && (
                      <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
                        Active
                      </span>
                    )}
                  </div>

                  {expandedSessionId === session.id ? (
                    <ChevronUp className="h-6 w-6 shrink-0 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-6 w-6 shrink-0 text-gray-500" />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div>
                    <p className="mb-1 text-sm text-gray-600">Duration</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {getSessionDuration(session)}
                    </p>
                  </div>

                  <div>
                    <p className="mb-1 text-sm text-gray-600">Total Profit</p>
                    <p className="text-lg font-semibold text-green-600">
                      ${session.totalProfit.toFixed(2)}
                    </p>
                  </div>

                  <div>
                    <p className="mb-1 text-sm text-gray-600">Total Loss</p>
                    <p className="text-lg font-semibold text-red-600">
                      ${session.totalLoss.toFixed(2)}
                    </p>
                  </div>

                  <div>
                    <p className="mb-1 text-sm text-gray-600">
                      Net Profit/Loss
                    </p>
                    <div
                      className={`flex items-center gap-1 text-lg font-bold ${
                        session.netProfitLoss >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {session.netProfitLoss >= 0 ? (
                        <TrendingUp className="h-5 w-5" />
                      ) : (
                        <TrendingDown className="h-5 w-5" />
                      )}
                      ${Math.abs(session.netProfitLoss).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              {expandedSessionId === session.id && (
                <div className="border-t border-gray-200 bg-gray-50 p-6">
                  <h3 className="mb-4 text-lg font-semibold text-gray-900">
                    Trades
                  </h3>

                  {session.trades.length === 0 ? (
                    <p className="text-sm text-gray-600">
                      Trades will be loaded in the next step.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full overflow-hidden rounded-lg bg-white">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-100">
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                              Time
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                              Buy/Sell
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                              Amount
                            </th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                              Price
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          {session.trades.map((trade) => (
                            <tr
                              key={trade.id}
                              className="border-b border-gray-100 transition hover:bg-gray-50"
                            >
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {trade.time}
                              </td>

                              <td className="px-4 py-3">
                                <span
                                  className={`rounded-full px-3 py-1 text-sm font-semibold ${
                                    trade.action === "Buy"
                                      ? "bg-green-100 text-green-700"
                                      : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {trade.action}
                                </span>
                              </td>

                              <td className="px-4 py-3 text-sm text-gray-600">
                                {trade.amount}
                              </td>

                              <td className="px-4 py-3 text-sm text-gray-600">
                                ${trade.price.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) {
    return "Unknown date";
  }

  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}