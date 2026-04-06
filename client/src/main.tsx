import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Fire a lightweight ping immediately so the Railway server wakes up before the user signs in
fetch("/api/health", { method: "GET" }).catch(() => {});

createRoot(document.getElementById("root")!).render(<App />);
