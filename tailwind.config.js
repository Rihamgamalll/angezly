/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Cairo', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#EEF6EF',
          100: '#E1EEE4',
          200: '#C5DDCD',
          300: '#99C5AD',
          400: '#6EA98C',
          500: '#39856D',
          600: '#206754',
          700: '#185747',
          800: '#123F35',
          900: '#0C3029',
        },
        cyanx: {
          50: '#EFF8F8',
          100: '#DDEEF0',
          200: '#BFDEE1',
          300: '#91C7CB',
          400: '#62AAB1',
          500: '#3F8C94',
          600: '#2E7781',
          700: '#225E67',
        },
        edu: {
          50: '#F5F2FA',
          100: '#EEE8F7',
          200: '#DFD3EF',
          300: '#C4B0E0',
          400: '#A68CCB',
          500: '#8C71B4',
          600: '#755A9D',
          700: '#5E4685',
          800: '#49366C',
        },
        ink: {
          50: '#F3F6F1',
          100: '#E5EAE4',
          200: '#CCD8D1',
          300: '#ADBDB3',
          400: '#829A8E',
          500: '#657B70',
          600: '#4C675C',
          700: '#365549',
          800: '#25483D',
          900: '#173B33',
        },
        canvas: '#FAFAF7',
      },
      boxShadow: {
        soft: '0 2px 4px rgba(18, 63, 53, .025), 0 18px 44px -32px rgba(18, 63, 53, .24)',
        lift: '0 4px 12px rgba(18, 63, 53, .05), 0 25px 48px -25px rgba(18, 63, 53, .26)',
      },
    },
  },
  plugins: [],
};
