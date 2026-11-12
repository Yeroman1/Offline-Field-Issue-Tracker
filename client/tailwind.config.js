/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#000a24',
        'primary-container': '#14213d',
        secondary: '#0051d5',
        'secondary-container': '#316bf3',
        surface: '#f8f9ff',
        'surface-container': '#e5eeff',
        'surface-container-low': '#eff4ff',
        'surface-container-high': '#dce9ff',
        'surface-container-lowest': '#ffffff',
        'on-surface': '#0b1c30',
        'on-surface-variant': '#45464d',
        error: '#ba1a1a',
        'error-container': '#ffdad6',
        'tertiary-fixed': '#71f8e4',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
