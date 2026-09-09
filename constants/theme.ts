/**
 * Pulse Pocket Theme
 * Dark terminal / ticker aesthetic matching usepulse-two.vercel.app
 */

export const colors = {
  background: "#000000",
  surface: "#0a0a0a",
  surfaceElevated: "#111111",
  border: "#1a1a1a",
  borderSubtle: "#222222",

  // Accents from Pulse
  accent: "#00ff9d",        // primary green
  accentDim: "#00cc7a",
  accentMuted: "rgba(0, 255, 157, 0.15)",

  text: {
    primary: "#ffffff",
    secondary: "#a0a0a0",
    tertiary: "#666666",
    muted: "#444444",
  },

  // Signal colors
  positive: "#00ff9d",
  negative: "#ff4d4d",
  warning: "#ffb800",

  // Ticker / grid feel
  grid: "rgba(255, 255, 255, 0.03)",
  glow: "rgba(0, 255, 157, 0.25)",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const typography = {
  // Monospace-ish feel for the terminal aesthetic
  mono: "System",
  sans: "System",
} as const;
