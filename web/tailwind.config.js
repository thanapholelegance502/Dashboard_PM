/** @type {import('tailwindcss').Config} */
// Elegance PMO design system v0.1 (Claude Design · docs/DESIGN-BRIEF.md)
// พื้นกลางอุ่น · แบรนด์กรมท่าเข้ม · แดง = ปัญหาเท่านั้น
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F6F5F2', // พื้นหลังหน้า
        surface: '#FFFFFF', // การ์ด
        'surface-2': '#F1EFEA', // segmented, skeleton
        line: '#E2DFD8', // เส้นขอบการ์ด
        'line-strong': '#D6D2C9', // เส้นขอบ input / ปุ่มรอง
        hair: '#EFEDE8', // เส้นคั่นหัวการ์ด
        'hair-2': '#F3F1EC', // เส้นคั่นแถว
        ink: { DEFAULT: '#1B1D22', 2: '#4A4E57', 3: '#7A7F88' },
        brand: {
          50: '#EEF2F8',
          100: '#DCE4F0',
          300: '#A8B7CC',
          700: '#22406B', // action, link
          800: '#16304F', // hover
          900: '#16263F', // sidebar
        },
        // status (semantic) — fg / bg / border
        ok: { DEFAULT: '#2F8A5B', bg: '#E8F4EC', bd: '#BFDFCB' },
        risk: { DEFAULT: '#9A6A0C', dot: '#C98A12', bg: '#FBF3E0', bd: '#EBD9A8' },
        late: { DEFAULT: '#B42F26', bg: '#FBEAE8', bd: '#F0C9C4' },
        done: { DEFAULT: '#3E6394', bg: '#EAF0F7', bd: '#C6D4E6' },
        wait: { DEFAULT: '#5E636C', bg: '#F1EFEA', bd: '#DAD6CE' },
        // ชื่อเดิม (design token §11) — ชี้ไปสีชุดใหม่
        ontrack: '#2F8A5B',
        atrisk: '#C98A12',
        delayed: '#B42F26',
        doing: '#22406B',
        waiting: '#5E636C',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans Thai"', 'Sarabun', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(27 29 34 / 0.04)',
        panel: '0 12px 32px rgb(27 29 34 / 0.14)',
        hover: '0 2px 8px rgb(34 64 107 / 0.10)',
      },
      keyframes: {
        shimmer: { '0%': { backgroundPosition: '-400px 0' }, '100%': { backgroundPosition: '400px 0' } },
      },
      animation: { shimmer: 'shimmer 1.4s linear infinite' },
    },
  },
  plugins: [],
};
