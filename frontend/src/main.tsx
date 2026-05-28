
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

if (window.location.hostname === "127.0.0.1") {
  window.location.replace(
    window.location.href.replace("127.0.0.1", "localhost")
  );
} else {
  createRoot(document.getElementById("root")!).render(<App />);
}
