import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "var(--brand-50)",
          100: "var(--brand-100)",
          200: "var(--brand-200)",
          300: "var(--brand-300)",
          400: "var(--brand-400)",
          500: "var(--brand-500)",
          600: "var(--brand-600)",
          700: "var(--brand-700)",
          800: "var(--brand-800)",
          900: "var(--brand-900)",
        },
        surface: {
          app: "var(--surface-app)",
          card: "var(--surface-card)",
          sunken: "var(--surface-sunken)",
          sidebar: "var(--surface-sidebar)",
          "sidebar-hover": "var(--surface-sidebar-hover)",
          "sidebar-active": "var(--surface-sidebar-active)",
        },
        ink: {
          strong: "var(--ink-strong)",
          base: "var(--ink-base)",
          muted: "var(--ink-muted)",
          faint: "var(--ink-faint)",
          "on-dark": "var(--ink-on-dark)",
          "on-dark-muted": "var(--ink-on-dark-muted)",
        },
        line: {
          soft: "var(--line-soft)",
          base: "var(--line-base)",
        },
        navy: {
          700: "var(--navy-700)",
          800: "var(--navy-800)",
          900: "var(--navy-900)",
        },
        domain: {
          intellect: "var(--domain-intellect)",
          body: "var(--domain-body)",
          spirit: "var(--domain-spirit)",
          social: "var(--domain-social)",
        },
        status: {
          "done-bg": "var(--status-done-bg)",
          "done-text": "var(--status-done-text)",
          "upcoming-bg": "var(--status-upcoming-bg)",
          "upcoming-text": "var(--status-upcoming-text)",
          "wait-bg": "var(--status-wait-bg)",
          "wait-text": "var(--status-wait-text)",
          "cancel-bg": "var(--status-cancel-bg)",
          "cancel-text": "var(--status-cancel-text)",
        },
      },
      boxShadow: {
        card: "var(--shadow-card)",
        raised: "var(--shadow-raised)",
        overlay: "var(--shadow-overlay)",
      },
      borderRadius: {
        card: "var(--radius-card)",
        control: "var(--radius-control)",
      },
      spacing: {
        sidebar: "var(--shell-sidebar-width)",
        topbar: "var(--shell-topbar-height)",
      },
    },
  },
  plugins: [],
};

export default config;
