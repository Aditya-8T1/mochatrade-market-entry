import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Self-hosted fonts (bundled via node_modules, not fetched from a CDN at
// runtime) -- avoids a live dependency on fonts.googleapis.com, which can
// be blocked on restrictive venue/demo wifi. See tailwind.config.js for the
// matching font-family fallback stacks.
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";

import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
