#!/usr/bin/env node
// พิมพ์ชื่อแท็บ + "แถวหัวตารางอย่างเดียว" ของชีตบอร์ด YOK
// ‼️ ไม่แตะแถวข้อมูล — ชีตมีชื่อลูกค้าจริง (MASTER §12.5)
// ใช้เติม server/src/sheets/mapping.js หลังตั้ง service account เสร็จ
import { env, assertGoogleConfig } from '../src/config/env.js';
import { getSheetTabs, batchGetValues } from '../src/sheets/client.js';
import { serviceAccountEmail } from '../src/sheets/auth.js';
import { SHEET_MAP } from '../src/sheets/mapping.js';
import { resolveHeaders } from '../src/sheets/rows.js';

const MAX_SCAN = 5; // หัวตารางอาจไม่ใช่แถวแรก (มีแถว banner ข้างบน)

async function main() {
  assertGoogleConfig();
  console.log(`service account : ${serviceAccountEmail() ?? '(อ่าน key ไม่ได้)'}`);
  console.log(`sheet id        : ${env.yokSheetId}\n`);

  const tabs = await getSheetTabs(env.yokSheetId);
  console.log(`พบ ${tabs.length} แท็บ:`);
  for (const t of tabs) console.log(`  - ${t.title}  (gid=${t.gid})`);
  console.log('');

  const names = tabs.map((t) => t.title);
  const values = await batchGetValues(env.yokSheetId, names);

  for (const name of names) {
    const rows = values[name] ?? [];
    console.log(`\n=== ${name} === (${rows.length} แถวรวมหัวตาราง)`);
    if (!rows.length) {
      console.log('  (ว่าง)');
      continue;
    }
    // พิมพ์เฉพาะ 5 แถวแรกในฐานะ "ผู้สมัครเป็นหัวตาราง" — ไม่พิมพ์แถวข้อมูล
    for (let i = 0; i < Math.min(MAX_SCAN, rows.length); i += 1) {
      const cells = (rows[i] ?? []).map((c) => String(c ?? '').trim());
      const nonEmpty = cells.filter(Boolean).length;
      console.log(`  [แถว ${i}] (${nonEmpty} ช่องมีค่า) ${cells.join(' | ')}`);
    }
    const spec = SHEET_MAP[name];
    if (!spec) {
      console.log('  ⚠️ ยังไม่มีใน SHEET_MAP');
      continue;
    }
    try {
      const r = resolveHeaders(name, rows, spec);
      console.log(`  ✅ headerRow=${r.headerRowIndex} · map ได้ ${Object.keys(r.index).length} field`);
      if (r.missingOptional.length) console.log(`  🟡 optional ที่ไม่พบ: ${r.missingOptional.join(', ')}`);
      if (r.unknownHeaders.length) console.log(`  ℹ️ คอลัมน์ที่ยังไม่ได้ map: ${r.unknownHeaders.join(', ')}`);
    } catch (e) {
      console.log(`  ❌ ${e.message}`);
    }
  }
  console.log('\nเอาผลด้านบนไปเติม server/src/sheets/mapping.js แล้วเปลี่ยน headerRow เป็นเลขจริง');
}

main().catch((e) => {
  console.error('ล้มเหลว:', e.message);
  if (e.sheetAccess) console.error('→ service account ยังไม่ได้รับสิทธิ์ Viewer บนชีต');
  if (e.sheetMissing) console.error('→ YOK_SHEET_ID ผิด หรือชีตถูกลบ');
  process.exit(1);
});
