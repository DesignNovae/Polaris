import type { Config } from "tailwindcss";

const config: Config = {
  // Class-based dark mode driven by <html data-theme="dark"> - set by the
  // ThemeProvider. Lets us use `dark:` utility prefixes for components
  // that need tone-specific dark overrides.
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surface + text tokens swap via CSS variables so the dark theme
        // (set on <html data-theme="dark">) re-themes every utility class
        // automatically. Brand colors (polaris/nova/aurora) stay fixed.
        bg: {
          DEFAULT: "rgb(var(--c-paper) / <alpha-value>)",
          soft:    "rgb(var(--c-paper-soft) / <alpha-value>)",
          card:    "rgb(var(--c-paper-card) / <alpha-value>)",
        },
        paper: {
          DEFAULT: "rgb(var(--c-paper) / <alpha-value>)",
          soft:    "rgb(var(--c-paper-soft) / <alpha-value>)",
          deep:    "rgb(var(--c-paper-deep) / <alpha-value>)",
          card:    "rgb(var(--c-paper-card) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--c-ink) / <alpha-value>)",
          dim:     "rgb(var(--c-ink-dim) / <alpha-value>)",
          muted:   "rgb(var(--c-ink-muted) / <alpha-value>)",
          faint:   "rgb(var(--c-ink-faint) / <alpha-value>)",
        },
        polaris: {
          50: "#FDF8F3",
          100: "#F9EDE0",
          200: "#F0D8BF",
          300: "#E3BC94",
          400: "#C47D4E",
          500: "#8B5E3C",
          600: "#744D30",
          700: "#5C3D26",
          800: "#4A311F",
          900: "#3A2718",
        },
        nova: {
          50:  "#FDF4E9",
          100: "#FBE9D6",
          200: "#F2D9BE",
          300: "#EAC397", // solid bright shade for dark-mode text
          400: "#D89466",
          500: "#C47D4E",
          600: "#B06A3B",
          700: "#8C4F29",
        },
        aurora: {
          50:  "#E3EEE6",
          100: "#D3E6D8",
          200: "#B7D4BE", // SOLID - was rgba(.4) which had no contrast on dark
          300: "#8FB89A", // solid bright for dark-mode text
          400: "#6B9E7B",
          500: "#5B8C6D",
          600: "#4A7458",
          700: "#365A41",
        },
        // Supporting accent for the app shell (hard-deadline / alert states).
        rose: {
          50:  "#F5DDE3",
          100: "#EFC8D2",
          200: "#E5B0BF",
          300: "#D58FA4", // solid bright for dark-mode text
          400: "#C36F89",
          500: "#B8546A",
          600: "#A24159",
          700: "#7E3145",
        },
        // Flat signal accents from the prototype.
        signal: {
          rose: "#B8546A",
          sky: "#5E8CA8",
          gold: "#C49A3B",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
        serif: ["var(--font-libre)", "Georgia", "Cambria", "serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
      backgroundImage: {
        "paper-radial": "radial-gradient(ellipse at top, rgba(139,94,60,0.06), transparent 60%), radial-gradient(ellipse at bottom right, rgba(196,125,78,0.05), transparent 60%)",
        "polaris-gradient": "linear-gradient(135deg, #8B5E3C 0%, #C47D4E 50%, #5B8C6D 100%)",
      },
      animation: {
        twinkle: "twinkle 4s ease-in-out infinite",
        float: "float 6s ease-in-out infinite",
      },
      keyframes: {
        twinkle: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
      },
      // App shell: 14-col grid for the workload heatmap / calendar gutter.
      gridTemplateColumns: {
        "14": "repeat(14, minmax(0, 1fr))",
      },
      boxShadow: {
        card: "0 1px 0 rgba(139,94,60,0.04), 0 0 0 1px rgba(139,94,60,0.08)",
        pop: "0 24px 60px -20px rgba(139,94,60,0.25), 0 0 0 1px rgba(139,94,60,0.10)",
        inset: "inset 0 0 0 1px rgba(139,94,60,0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
