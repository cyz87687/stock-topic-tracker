/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        up: '#ef4444',
        down: '#22c55e',
        strong: '#ef4444',
        medium: '#f97316',
        neutral: '#eab308',
        weak: '#9ca3af',
        'bg-primary': '#0f172a',
        'bg-card': '#1e293b',
        'bg-hover': '#334155',
      },
    },
  },
  plugins: [],
}
