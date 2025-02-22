import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import App from "./App.tsx";

// Import Inter font - you'll need to install @fontsource/inter
import "@fontsource/inter";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div className="flex h-screen">
      <main
        className="flex-1 overflow-auto"
        style={{ backgroundColor: "#1C1E2E" }}
      >
        <App />
      </main>
    </div>
  </StrictMode>
);
