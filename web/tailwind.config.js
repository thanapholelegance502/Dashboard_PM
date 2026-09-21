/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // design token §11 — สื่อความหมาย ใช้ร่วมทุกแผนก
        ontrack: '#16a34a', // เขียว
        atrisk: '#f59e0b', // เหลือง-ส้ม
        delayed: '#dc2626', // แดง = ปัญหาเท่านั้น
        doing: '#2563eb', // น้ำเงิน
        waiting: '#9ca3af', // เทา
      },
      fontFamily: {
        sans: ['Sarabun', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
