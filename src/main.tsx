import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./index.css";
import App from "./App";
import { openDb } from "./lib/db";

const root = createRoot(document.getElementById("root")!);

openDb()
  .then(() =>
    root.render(
      <StrictMode>
        <HashRouter>
          <App />
        </HashRouter>
      </StrictMode>,
    ),
  )
  .catch((e) => {
    console.error(e);
    root.render(<pre style={{ padding: 24, color: "#f87171" }}>Failed to open local database: {String(e)}</pre>);
  });
