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
interface AuthContextType {
  currentUser: User | null;
  dbUserId: number | null;
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
  const [dbUserId, setDbUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Ensure user exists in backend after Firebase auth
  async function ensureBackendUser(user: User) {
    try {
      // Get the Firebase ID token (JWT) to send to backend
      const idToken = await user.getIdToken();

      // Check if user already exists
      const checkRes = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || "http://localhost:5000"}/api/users/firebase/${user.uid}`
      );

      if (checkRes.status === 404) {
        // Create user in backend (this endpoint doesn't require auth)
        const createRes = await fetch(
          `${import.meta.env.VITE_API_BASE_URL || "http://localhost:5000"}/api/users`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ firebase_uid: user.uid }),
          }
        );
        const createdUser = await createRes.json();
        setDbUserId(createdUser.id);
      } else {
        const existingUser = await checkRes.json();
        setDbUserId(existingUser.id);
      }

      // Store the token so it's accessible for debugging if needed
      console.log("[AUTH] Firebase JWT obtained, length:", idToken.length);
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
    setDbUserId(null);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await ensureBackendUser(user);
      } else {
        setDbUserId(null);
      }
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, dbUserId, loading, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
