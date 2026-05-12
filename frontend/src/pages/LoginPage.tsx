import { useAuth } from "../contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { TrendingUp } from "lucide-react";
import { useState } from "react";

export function LoginPage() {
  const { currentUser, loginWithGoogle, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="w-10 h-10 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Already logged in → redirect to dashboard
  if (currentUser) {
    return <Navigate to="/dashboard" replace />;
  }

  async function handleGoogleLogin() {
    setError(null);
    setIsSigningIn(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      if (err?.code === "auth/popup-closed-by-user") {
        // User closed the popup, not an error
        setIsSigningIn(false);
        return;
      }
      setError("Autentificarea a eșuat. Încearcă din nou.");
      console.error("Google login error:", err);
    } finally {
      setIsSigningIn(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 relative overflow-hidden">
      {/* Animated background orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />

      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Card */}
        <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-800 rounded-2xl shadow-2xl p-8">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="p-2.5 bg-blue-600/20 rounded-xl">
              <TrendingUp className="h-7 w-7 text-blue-400" />
            </div>
            <span className="text-2xl font-bold text-white">TradePro</span>
          </div>

          <p className="text-center text-gray-400 text-sm mb-8">
            Automated trading, simplified.
          </p>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-xs text-gray-500 uppercase tracking-wider">
              Sign in to continue
            </span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {/* Google Sign In Button */}
          <button
            id="google-login-button"
            onClick={handleGoogleLogin}
            disabled={isSigningIn}
            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl
              bg-white text-gray-800 font-semibold text-base
              hover:bg-gray-100 active:scale-[0.98]
              transition-all duration-200 ease-out
              disabled:opacity-50 disabled:cursor-not-allowed
              shadow-lg shadow-black/20"
          >
            {isSigningIn ? (
              <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            <span>{isSigningIn ? "Se conectează..." : "Continue with Google"}</span>
          </button>

          {/* Terms */}
          <p className="mt-6 text-center text-xs text-gray-600">
            By continuing, you agree to our{" "}
            <a href="#" className="text-gray-400 hover:text-white transition">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#" className="text-gray-400 hover:text-white transition">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}