/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#07090C",
          900: "#0A0E13",
          800: "#0E141B",
          700: "#111823",
          600: "#16202C",
          500: "#1C2733",
        },
        line: {
          soft: "#1E2833",
          DEFAULT: "#28333F",
          strong: "#3A4756",
        },
        paper: {
          DEFAULT: "#E7ECF2",
          dim: "#9AA7B4",
          faint: "#7C8A98",
        },
        signal: {
          cyan: "#22D3EE",
          cyanDim: "#0E7490",
          green: "#34D399",
          greenDim: "#0D6B4F",
          amber: "#F5A623",
          amberDim: "#8A5A10",
          red: "#F4635A",
          redDim: "#7A2A26",
          violet: "#9B8CFF",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 0 0 rgba(255,255,255,0.02) inset, 0 20px 40px -24px rgba(0,0,0,0.6)",
        glow: "0 0 0 1px rgba(34,211,238,0.4), 0 0 24px -4px rgba(34,211,238,0.35)",
      },
      keyframes: {
        sweep: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        sweep: "sweep 2.4s linear infinite",
        rise: "rise 0.45s cubic-bezier(0.16,1,0.3,1) both",
        blink: "blink 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
