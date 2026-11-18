// donut สถานะโครงการเป็น SVG (สร้างฝั่ง server — Chromium ไม่ต้องรัน JS/Recharts)
const STATUS_COLOR = {
  WAITING: '#5E636C',
  ON_TRACK: '#2F8A5B',
  AT_RISK: '#C98A12',
  DELAYED: '#B42F26',
  DONE: '#3E6394',
};

/** breakdown = [{status, count}] → SVG string · สีเดียวกับ web/src/lib/theme.ts */
export function donutSvg(breakdown, { size = 132, stroke = 22 } = {}) {
  const total = breakdown.reduce((a, b) => a + b.count, 0);
  const r = (size - stroke) / 2;
  const c = size / 2;
  const ring = `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#F1EFEA" stroke-width="${stroke}"/>`;
  const label = `<text x="${c}" y="${c + 2}" text-anchor="middle" font-size="26" font-weight="600" fill="#1B1D22">${total}</text>`
    + `<text x="${c}" y="${c + 20}" text-anchor="middle" font-size="10" fill="#7A7F88">โครงการ</text>`;
  if (total === 0) return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${ring}${label}</svg>`;

  const circ = 2 * Math.PI * r;
  let offset = 0;
  const arcs = breakdown
    .filter((b) => b.count > 0)
    .map((b) => {
      const len = (b.count / total) * circ;
      const arc = `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${STATUS_COLOR[b.status] ?? '#7A7F88'}" `
        + `stroke-width="${stroke}" stroke-dasharray="${len.toFixed(3)} ${(circ - len).toFixed(3)}" `
        + `stroke-dashoffset="${(-offset).toFixed(3)}" transform="rotate(-90 ${c} ${c})"/>`;
      offset += len;
      return arc;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${ring}${arcs}${label}</svg>`;
}

export { STATUS_COLOR };
