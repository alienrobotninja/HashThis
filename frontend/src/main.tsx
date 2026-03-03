import React from "react";
import ReactDOM from "react-dom/client";
import { CccProvider } from "@ckb-ccc/connector-react";
import App from "./App.tsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {/* CccProvider must wrap everything so useCcc() works in any component.
        Kept here rather than in App.tsx to leave the router tree wallet-agnostic. */}
    <CccProvider defaultNetwork="testnet">
      <App />
    </CccProvider>
  </React.StrictMode>
);
