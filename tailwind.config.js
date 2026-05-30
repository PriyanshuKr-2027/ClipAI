/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: '#7c5cfc',
        'accent-2': '#00d4ff',
        'accent-teal': '#00f5c4',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"Fira Code"', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 20px rgba(124,92,252,0.35), 0 0 40px rgba(124,92,252,0.15)',
        'glow-sm': '0 0 10px rgba(124,92,252,0.35)',
      },
      backgroundImage: {
        'gradient-accent': 'linear-gradient(135deg, #7c5cfc, #9b7dff)',
        'gradient-teal': 'linear-gradient(135deg, #00d4ff, #00f5c4)',
      }
    }
  },
  plugins: [],
}
