import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        teal: {
          DEFAULT: "#008C8C",
          dark: "#005F5F",
        },
        silver: {
          DEFAULT: "#C0C0C0",
          soft: "#F4F6F7",
        },
        charcoal: "#1F2933",
        ink: "#0D1417", // near-black, used sparingly for high-contrast headline moments
        paper: "#FBFBFA", // warm off-white card surface — deliberately not stark #FFFFFF
      },
      fontFamily: {
        // Display: high-contrast didone serif — evokes an engraved plate /
        // fine linework, not the italic-serif-luxury default. Used sparingly,
        // set upright (not italic) at restrained weights.
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "sans-serif"],
        // Utility/data face — times, prices, confirmation codes, eyebrow
        // labels. A deliberate "ticket stub" register distinct from body copy.
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        // Architectural, not pill-shaped. The old rounded-full button
        // treatment is a generic SaaS default — this system uses small,
        // consistent corner radii instead.
        card: "3px",
        control: "2px",
      },
      boxShadow: {
        // Deliberately minimal — hierarchy comes from the hairline border
        // system and whitespace, not drop shadows.
        card: "none",
      },
      letterSpacing: {
        widest2: "0.22em",
      },
    },
  },
  plugins: [],
};

export default config;
