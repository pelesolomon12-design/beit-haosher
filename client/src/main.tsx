import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// הסר מסך טעינה לאחר שה-React נטען
setTimeout(() => (window as any).__hideSplash?.(), 800);
