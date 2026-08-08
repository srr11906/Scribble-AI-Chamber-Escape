/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        chamber: {
          bg: '#05070B',
          surface: '#0B1117',
          cyan: '#00F5FF',
          red: '#FF2E63',
          green: '#00FFA3',
          text: '#EAFBFF',
          secondary: '#8FA7B5',
        }
      },
      boxShadow: {
        'cyan-glow': '0 0 10px rgba(0, 245, 255, 0.4), 0 0 20px rgba(0, 245, 255, 0.2)',
        'red-glow': '0 0 10px rgba(255, 46, 99, 0.4), 0 0 20px rgba(255, 46, 99, 0.2)',
        'green-glow': '0 0 10px rgba(0, 255, 163, 0.4), 0 0 20px rgba(0, 255, 163, 0.2)',
        'hologram': '0 0 15px rgba(0, 245, 255, 0.3), inset 0 0 15px rgba(0, 245, 255, 0.1)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 15s linear infinite',
        'scanline': 'scanline 8s linear infinite',
        'glitch': 'glitch 1s linear infinite',
      },
      keyframes: {
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        glitch: {
          '0%, 100%': { transform: 'translate(0)' },
          '20%': { transform: 'translate(-2px, 2px)' },
          '40%': { transform: 'translate(-2px, -2px)' },
          '60%': { transform: 'translate(2px, 2px)' },
          '80%': { transform: 'translate(2px, -2px)' },
        }
      }
    },
  },
  plugins: [],
}
