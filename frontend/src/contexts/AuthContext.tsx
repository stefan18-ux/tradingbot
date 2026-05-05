import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { auth, googleProvider } from "../firebase";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Ensure user exists in backend after Firebase auth
  async function ensureBackendUser(user: User) {
    try {
      // Check if user already exists
      const checkRes = await fetch(
        `${API_BASE}/api/users/firebase/${user.uid}`
      );
      if (checkRes.status === 404) {
        // Create user in backend
        await fetch(`${API_BASE}/api/users`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ firebase_uid: user.uid }),
        });
      }
    } catch (err) {
      console.error("Failed to sync user with backend:", err);
    }
  }

  async function loginWithGoogle() {
    const result = await signInWithPopup(auth, googleProvider);
    await ensureBackendUser(result.user);
  }

  async function logout() {
    await signOut(auth);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, loading, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
