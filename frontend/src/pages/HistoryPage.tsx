import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

interface Trade {
  time: string;
  asset: string;
  action: "Buy" | "Sell";
  amount: number;
  entryPrice: number;
  exitPrice: number;
  profitLoss: number;
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
}

const sessions: Session[] = [
  {
    id: "1",
    date: "March 4, 2026",
    duration: "02:10:45",
    totalProfit: 538.6,
    totalLoss: 200.4,
    netProfitLoss: 338.2,
    isCurrent: true,
    trades: [
      {
        time: "14:32:15",
        asset: "BTC",
        action: "Buy",
        amount: 0.05,
        entryPrice: 45230,
        exitPrice: 45480,
        profitLoss: 125.5,
      },
      {
        time: "14:45:22",
        asset: "BTC",
        action: "Sell",
        amount: 0.03,
        entryPrice: 45450,
        exitPrice: 45340,
        profitLoss: -32.8,
      },
      {
        time: "15:01:08",
        asset: "BTC",
        action: "Buy",
        amount: 0.08,
        entryPrice: 45180,
        exitPrice: 45420,
        profitLoss: 245.2,
      },
    ],
  },
  {
    id: "2",
    date: "March 3, 2026",
    duration: "04:15:30",
    totalProfit: 892.3,
    totalLoss: 445.8,
    netProfitLoss: 446.5,
    trades: [
      {
        time: "09:15:42",
        asset: "BTC",
        action: "Buy",
        amount: 0.1,
        entryPrice: 44800,
        exitPrice: 45150,
        profitLoss: 350.0,
      },
      {
        time: "10:22:18",
        asset: "ETH",
        action: "Buy",
        amount: 2.5,
        entryPrice: 2850,
        exitPrice: 2920,
        profitLoss: 175.0,
      },
      {
        time: "11:05:33",
        asset: "BTC",
        action: "Sell",
        amount: 0.06,
        entryPrice: 45200,
        exitPrice: 44950,
        profitLoss: -150.0,
      },
      {
        time: "12:40:55",
        asset: "BTC",
        action: "Buy",
        amount: 0.12,
        entryPrice: 44900,
        exitPrice: 45180,
        profitLoss: 336.0,
      },
    ],
  },
  {
    id: "3",
    date: "March 2, 2026",
    duration: "08:00:00",
    totalProfit: 1250.5,
    totalLoss: 680.2,
    netProfitLoss: 570.3,
    trades: [
      {
        time: "08:00:12",
        asset: "BTC",
        action: "Buy",
        amount: 0.15,
        entryPrice: 44500,
        exitPrice: 45100,
        profitLoss: 900.0,
      },
      {
        time: "10:30:45",
        asset: "ETH",
        action: "Buy",
        amount: 3.0,
        entryPrice: 2800,
        exitPrice: 2750,
        profitLoss: -150.0,
      },
      {
        time: "13:15:20",
        asset: "BTC",
        action: "Sell",
        amount: 0.08,
        entryPrice: 45200,
        exitPrice: 44850,
        profitLoss: -280.0,
      },
      {
        time: "15:45:38",
        asset: "SOL",
        action: "Buy",
        amount: 50,
        entryPrice: 98.5,
        exitPrice: 101.5,
        profitLoss: 150.0,
      },
    ],
  },
];

export function HistoryPage() {
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>("1");

  const toggleSession = (sessionId: string) => {
    setExpandedSessionId((currentId) =>
      currentId === sessionId ? null : sessionId
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Trading History</h1>

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
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold text-gray-900">
                    {session.isCurrent
                      ? `Current Session — ${session.duration}`
                      : session.date}
                  </h2>

                  {session.isCurrent && (
                    <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
                      Active
                    </span>
                  )}
                </div>

                {expandedSessionId === session.id ? (
                  <ChevronUp className="h-6 w-6 text-gray-500" />
                ) : (
                  <ChevronDown className="h-6 w-6 text-gray-500" />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div>
                  <p className="mb-1 text-sm text-gray-600">Duration</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {session.duration}
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
                  <p className="mb-1 text-sm text-gray-600">Net Profit/Loss</p>
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

                <div className="overflow-x-auto">
                  <table className="w-full overflow-hidden rounded-lg bg-white">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-100">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Time
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Asset
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Buy/Sell
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Amount
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Entry Price
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Exit Price
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Profit/Loss
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {session.trades.map((trade) => (
                        <tr
                          key={`${trade.time}-${trade.asset}-${trade.action}`}
                          className="border-b border-gray-100 transition hover:bg-gray-50"
                        >
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {trade.time}
                          </td>

                          <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                            {trade.asset}
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
                            ${trade.entryPrice.toLocaleString()}
                          </td>

                          <td className="px-4 py-3 text-sm text-gray-600">
                            ${trade.exitPrice.toLocaleString()}
                          </td>

                          <td className="px-4 py-3">
                            <div
                              className={`flex items-center gap-1 font-semibold ${
                                trade.profitLoss >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {trade.profitLoss >= 0 ? (
                                <TrendingUp className="h-4 w-4" />
                              ) : (
                                <TrendingDown className="h-4 w-4" />
                              )}
                              ${Math.abs(trade.profitLoss).toFixed(2)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}