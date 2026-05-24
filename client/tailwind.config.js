/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0F172A',
        card: '#111827',
        sidebar: '#1E293B',
        accentBlue: '#38BDF8',
        accentPurple: '#8B5CF6',
        success: '#22C55E',
        error: '#F43F5E',
      }
    },
  },
  plugins: [],
}
