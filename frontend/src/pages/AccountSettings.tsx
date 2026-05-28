import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { User, Shield, Save, LogOut, Trash2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { apiFetch } from "../lib/api";

export function AccountSettings() {
  const navigate = useNavigate();
  const { currentUser, dbUserId, logout } = useAuth();
  
  const [profile, setProfile] = useState({
    name: "",
    email: "",
  });

  const [security, setSecurity] = useState({
    apiKey: "",
    alpacaSecret: "",
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Load Firebase user data
  useEffect(() => {
    if (currentUser) {
      setProfile((prev) => ({
        ...prev,
        name: currentUser.displayName || "",
        email: currentUser.email || "",
      }));
    }
  }, [currentUser]);

  // Load Backend user data
  useEffect(() => {
    async function loadBackendData() {
      if (!dbUserId) return;
      try {
        const res = await apiFetch(`/api/users/${dbUserId}`);
        if (res.ok) {
          const data = await res.json();
          setSecurity((prev) => ({
            ...prev,
            apiKey: data.api_key || "",
            // alpaca_secret is not returned by default for security, so we leave it empty
          }));
        }
      } catch (err) {
        console.error("Failed to load user settings:", err);
      }
    }
    loadBackendData();
  }, [dbUserId]);

  const handleSecurityChange = (field: string, value: string) => {
    setSecurity({ ...security, [field]: value });
  };

  const handleSaveChanges = async () => {
    if (!dbUserId) return;
    
    setSaving(true);
    setMessage("");
    setError("");
    
    try {
      const updateData: any = {};
      if (security.apiKey) updateData.api_key = security.apiKey;
      if (security.alpacaSecret) updateData.alpaca_secret = security.alpacaSecret;

      // Make API call to update backend user
      const res = await apiFetch(`/api/users/${dbUserId}`, {
        method: "PUT",
        body: JSON.stringify(updateData)
      });

      if (res.ok) {
        setMessage("Settings saved successfully!");
        // Clear secret field after save
        setSecurity((prev) => ({ ...prev, alpacaSecret: "" }));
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to save settings.");
      }
    } catch (err) {
      console.error(err);
      setError("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const handleDeleteAccount = () => {
    alert("Account deletion must be performed by an admin. Please contact support.");
  };

  // Get initials for avatar
  const getInitials = () => {
    if (profile.name) {
      return profile.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (profile.email) {
      return profile.email[0].toUpperCase();
    }
    return "?";
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>

      {message && (
        <div className="bg-green-100 border border-green-300 text-green-800 p-3 rounded-lg">
          {message}
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 border border-red-300 text-red-800 p-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div className="flex items-center gap-3 mb-6">
          <User className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">
            Profile Information
          </h2>
        </div>

        <div className="flex items-center gap-6 mb-6">
          {currentUser?.photoURL ? (
            <img 
              src={currentUser.photoURL} 
              alt="Avatar" 
              className="w-20 h-20 rounded-full object-cover" 
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center text-white text-3xl font-bold">
              {getInitials()}
            </div>
          )}
          <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-semibold" disabled>
            Change Picture (Managed by Google)
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={profile.name}
              readOnly
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none cursor-not-allowed text-gray-500"
              title="Managed by Google"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={profile.email}
              readOnly
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none cursor-not-allowed text-gray-500"
              title="Managed by Google"
            />
          </div>
        </div>
      </div>

      {/* Security Section */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">
            Trading API Settings
          </h2>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Alpaca API Key
            </label>
            <input
              type="password"
              value={security.apiKey}
              onChange={(e) => handleSecurityChange("apiKey", e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your Alpaca API Key"
            />
            <p className="text-sm text-gray-500 mt-1">
              Your API key is used to connect to your broker.
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Alpaca API Secret
            </label>
            <input
              type="password"
              value={security.alpacaSecret}
              onChange={(e) =>
                handleSecurityChange("alpacaSecret", e.target.value)
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your Alpaca API Secret (Leave blank to keep current)"
            />
            <p className="text-sm text-gray-500 mt-1">
              Your API secret is encrypted and stored securely. We do not display it after saving for security reasons.
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleSaveChanges}
          disabled={saving}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white transition ${
            saving ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          <Save className="h-5 w-5" />
          {saving ? "Saving..." : "Save Changes"}
        </button>

        <div className="flex gap-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition font-semibold"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>

          <button
            onClick={handleDeleteAccount}
            className="flex items-center gap-2 bg-red-100 text-red-700 px-6 py-3 rounded-lg hover:bg-red-200 transition font-semibold"
          >
            <Trash2 className="h-5 w-5" />
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}
