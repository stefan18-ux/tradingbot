import { Outlet, Link, useNavigate } from "react-router-dom";
import {
  TrendingUp,
  LayoutDashboard,
  LogOut,
  ChevronDown,
  Settings,
  History,
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

export function DashboardLayout() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  // Get initials from user display name or email
  const getInitials = () => {
    if (currentUser?.displayName) {
      return currentUser.displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (currentUser?.email) {
      return currentUser.email[0].toUpperCase();
    }
    return "?";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navbar */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* LEFT SIDE */}
            <div className="flex items-center gap-8">
              <Link to="/dashboard" className="flex items-center">
                <TrendingUp className="h-8 w-8 text-blue-600" />
                <span className="ml-2 text-xl font-bold text-gray-900">
                  TradePro
                </span>
              </Link>

              <div className="hidden md:flex space-x-6">
                <Link
                  to="/dashboard"
                  className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition"
                >
                  <LayoutDashboard className="h-5 w-5" />
                  Dashboard
                </Link>

                <Link
                  to="/dashboard/history"
                  className="flex items-center gap-2 text-gray-700 hover:text-blue-600 transition"
                >
                  <History className="h-5 w-5" />
                  History
                </Link>
              </div>
            </div>

            {/* RIGHT SIDE */}
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 hover:bg-gray-100 px-3 py-2 rounded-lg transition"
              >
                {currentUser?.photoURL ? (
                  <img
                    src={currentUser.photoURL}
                    alt="Avatar"
                    className="w-8 h-8 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    {getInitials()}
                  </div>
                )}
                <ChevronDown className="h-4 w-4 text-gray-600" />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  <Link
                    to="/account"
                    className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 transition w-full text-left"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <Settings className="h-4 w-4" />
                    Account Settings
                  </Link>
                  <hr className="my-1 border-gray-200" />
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 transition w-full text-left"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </nav>

      {/* CONTENT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}