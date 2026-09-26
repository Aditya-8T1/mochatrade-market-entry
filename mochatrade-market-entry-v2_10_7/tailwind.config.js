/** @type {import('tailwindcss').Config} */
// v2.9.0 "magazine-lite" palette. This is the ONLY palette: the old dark
// ink/line/paper/signal tokens are gone. Verdict and risk colours are text
// colours meant to sit on their matching *-tint background.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      white: "#FFFFFF",
      canvas: "#FBF8F2", // page background
      surface: { DEFAULT: "#FFFFFF", 2: "#F4EFE6" },
      ink: { DEFAULT: "#1C1A17", 2: "#4A453E" },
      muted: "#6B645A",
      rule: "#E4DDD0",
      coral: { DEFAULT: "#E0663A", strong: "#B8471F" }, // coral = decorative only; coral-strong = fills + links
      highlight: { DEFAULT: "#FFD9C4", now: "#CDEBD7" },
      now: { DEFAULT: "#1E7A4C", tint: "#DDF2E4" },
      next: { DEFAULT: "#1F5FA8", tint: "#DDEBFB" },
      later: { DEFAULT: "#9A4A16", tint: "#FDE9D6" },
      short: { DEFAULT: "#8A5A00", tint: "#FBEFD2" },
      no: { DEFAULT: "#B42318", tint: "#FDE4E1" },
      plum: "#7A4FB0",
      teal: "#4A7A8C",
    },
    fontFamily: {
      display: ["'Fraunces Variable'", "Georgia", "'Times New Roman'", "serif"],
      sans: ["Karla", "system-ui", "-apple-system", "'Segoe UI'", "sans-serif"],
    },
    extend: {
      borderRadius: { btn: "14px", card: "20px", chip: "10px" },
      borderWidth: { 1.5: "1.5px" },
      // Elevation scale, warm-tinted (ink #1C1A17). 0 resting -> 3 floating.
      boxShadow: {
        card: "0 1px 2px rgba(28,26,23,0.05), 0 2px 8px -2px rgba(28,26,23,0.06)",
        lift: "0 2px 4px rgba(28,26,23,0.05), 0 14px 28px -10px rgba(28,26,23,0.18)",
        float: "0 2px 6px rgba(28,26,23,0.06), 0 28px 56px -16px rgba(28,26,23,0.28)",
        btn: "inset 0 1px 0 rgba(255,255,255,0.18), 0 1px 2px rgba(28,26,23,0.12), 0 6px 16px -6px rgba(184,71,31,0.55)",
        "btn-hover": "inset 0 1px 0 rgba(255,255,255,0.18), 0 2px 4px rgba(28,26,23,0.12), 0 12px 24px -8px rgba(184,71,31,0.6)",
        "btn-quiet": "0 1px 2px rgba(28,26,23,0.08)",
        header: "0 1px 0 #E4DDD0, 0 8px 24px -12px rgba(28,26,23,0.18)",
      },
      maxWidth: { page: "1280px" },
    },
  },
  plugins: [],
};
