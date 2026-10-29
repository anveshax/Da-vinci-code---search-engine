/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#06090e',
          900: '#0B0F17',
          850: '#101622',
          800: '#141c2b',
        },
        surface: {
          card: '#111827',
          hover: '#1F2937',
          border: '#1F2937',
          borderLight: '#374151',
        },
        cyber: {
          cyan: '#06B6D4',
          cyanGlow: '#22D3EE',
          violet: '#8B5CF6',
          violetGlow: '#A78BFA',
          emerald: '#10B981',
          rose: '#F43F5E',
          amber: '#F59E0B',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
