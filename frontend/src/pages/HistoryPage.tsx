import { TrendingDown, TrendingUp } from "lucide-react";

interface Session {
  id: string;
  date: string;
  duration: string;
  totalProfit: number;
  totalLoss: number;
  netProfitLoss: number;
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
  },
  {
    id: "2",
    date: "March 3, 2026",
    duration: "04:15:30",
    totalProfit: 892.3,
    totalLoss: 445.8,
    netProfitLoss: 446.5,
  },
  {
    id: "3",
    date: "March 2, 2026",
    duration: "08:00:00",
    totalProfit: 1250.5,
    totalLoss: 680.2,
    netProfitLoss: 570.3,
  },
];

export function HistoryPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Trading History</h1>

      <div className="space-y-4">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`rounded-xl border border-gray-200 bg-white p-6 shadow-sm ${
              session.isCurrent ? "bg-blue-50" : ""
            }`}
          >
            <div className="mb-4 flex items-center gap-3">
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
        ))}
      </div>
    </div>
  );
}