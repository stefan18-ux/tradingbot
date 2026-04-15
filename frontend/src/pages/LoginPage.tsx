import { Link } from "react-router";

export function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow border border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Login Page</h1>

        <Link
          to="/dashboard"
          className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition"
        >
          Login
        </Link>
      </div>
    </div>
  );
}