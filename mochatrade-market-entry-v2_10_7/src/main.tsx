import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Self-hosted fonts (bundled via node_modules, not fetched from a CDN at
// runtime) -- avoids a live dependency on fonts.googleapis.com, which can
// be blocked on restrictive venue/demo wifi.
// Fraunces "full" carries every axis (opsz, wght, SOFT 0-100, WONK 0-1) --
// checked against the font's fvar table, not assumed.
import "@fontsource-variable/fraunces/full.css";
// Italic, for the "trade" half of the Mochatrade wordmark.
import "@fontsource-variable/fraunces/full-italic.css";
import "@fontsource/karla/400.css";
import "@fontsource/karla/500.css";
import "@fontsource/karla/700.css";

import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
