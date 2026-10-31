/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ice: {
          DEFAULT: '#A0C4FF',
          light: '#E2EDFF',
          glow: '#C0D8FF',
          dim: '#7094D4',
          border: 'rgba(170, 195, 255, 0.55)',
          borderFocus: 'rgba(190, 215, 255, 0.85)',
        },
        navy: {
          950: '#020408',
          900: '#050810',
          850: '#070B16',
          800: '#0A1128',
          pill: 'rgba(5, 8, 16, 0.85)',
        },
        obsidian: {
          950: '#020408',
          900: '#000000',
          850: '#050810',
          800: '#0A1128',
        },
        surface: {
          card: '#080808',
          hover: '#141414',
          border: '#1F2937',
          borderLight: '#374151',
        },
        cyber: {
          cyan: '#A0C4FF',
          cyanGlow: '#C0D8FF',
          violet: '#7094D4',
          violetGlow: '#A0C4FF',
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
