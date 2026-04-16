import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1c4e80',
          dark: '#153a62',
        },
        accent: {
          blue: '#007bff',
          blueDark: '#0056b3',
          green: '#28a745',
          greenDark: '#218838',
        },
        surface: {
          page: '#f8f9fa',
          card: '#ffffff',
          cardBorder: '#e9ecef',
          tooltipBg: '#343a40',
          tooltipText: '#f8f9fa',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'Oxygen-Sans',
          'Cantarell',
          '"Helvetica Neue"',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 6px 10px rgba(0,0,0,0.07)',
        cardHover: '0 10px 15px rgba(0,0,0,0.1)',
      },
    },
  },
  plugins: [],
} satisfies Config;
