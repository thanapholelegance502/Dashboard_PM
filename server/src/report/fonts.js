// ฟอนต์ IBM Plex Sans Thai ฝังเป็น data: URI — render ได้แม้ server ไม่มีเน็ต หน้าตาตรงกับเว็บ
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
let cached = null;

/** @font-face CSS (โหลดครั้งเดียว cache ไว้) */
export function embeddedFontCss() {
  if (cached != null) return cached;
  const dir = join(dirname(require.resolve('@fontsource/ibm-plex-sans-thai/package.json')), 'files');
  const faces = [];
  for (const weight of [400, 600]) {
    for (const subset of ['thai', 'latin']) {
      const b64 = readFileSync(join(dir, `ibm-plex-sans-thai-${subset}-${weight}-normal.woff2`)).toString('base64');
      faces.push(
        `@font-face{font-family:'IBM Plex Sans Thai';font-style:normal;font-weight:${weight};`
          + `src:url(data:font/woff2;base64,${b64}) format('woff2');}`,
      );
    }
  }
  cached = faces.join('');
  return cached;
}
