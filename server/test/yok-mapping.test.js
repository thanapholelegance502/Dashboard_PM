// ‼️ fixture ใช้ชื่อสมมติเท่านั้น — ห้ามมีชื่อลูกค้าจริง (MASTER §12.5)
import { describe, it, expect } from 'vitest';
import { normalizeHeader, resolveHeaders, readTab, SheetMappingError } from '../src/sheets/rows.js';

const spec = {
  headerRow: 'auto',
  fields: {
    projectId: { aliases: ['Project ID', 'Project Code'], required: true },
    client: { aliases: ['Client', 'ลูกค้า'], required: false },
    amount: { aliases: ['Amount', 'จำนวนเงิน'], required: false },
  },
};

describe('normalizeHeader', () => {
  it('กินเว้นวรรคท้าย · case · NBSP · ดอกจัน · โคลอน', () => {
    const want = 'project id';
    for (const v of ['Project ID', 'project id  ', '  PROJECT ID', 'Project ID', 'Project ID*', 'Project ID:', 'Project   ID']) {
      expect(normalizeHeader(v), JSON.stringify(v)).toBe(want);
    }
  });
  it('ค่าว่าง/null ไม่ระเบิด', () => {
    expect(normalizeHeader(null)).toBe('');
    expect(normalizeHeader(undefined)).toBe('');
  });
});

describe('resolveHeaders', () => {
  it('map ครบ + บอก header ที่ยังไม่ได้ map', () => {
    const rows = [['Project ID', 'Client', 'Amount', 'Extra Note']];
    const r = resolveHeaders('T', rows, spec);
    expect(r.headerRowIndex).toBe(0);
    expect(r.index).toEqual({ projectId: 0, client: 1, amount: 2 });
    expect(r.unknownHeaders).toEqual(['Extra Note']);
    expect(r.missingOptional).toEqual([]);
  });

  it('alias ตัวที่สองใช้ได้ — หยก rename คอลัมน์แล้วไม่พัง', () => {
    const rows = [['Project Code', 'ลูกค้า']];
    const r = resolveHeaders('T', rows, spec);
    expect(r.index.projectId).toBe(0);
    expect(r.index.client).toBe(1);
  });

  it("headerRow:'auto' หาหัวตารางใต้แถว banner ได้", () => {
    const rows = [['PROJECT PAYMENT SCHEDULE', '', ''], [], ['Project ID', 'Client', 'Amount']];
    const r = resolveHeaders('T', rows, spec);
    expect(r.headerRowIndex).toBe(2);
  });

  it('headerRow เป็นเลข → ใช้แถวนั้นตรง ๆ', () => {
    const rows = [['ขยะ'], ['Project ID', 'Client']];
    const r = resolveHeaders('T', rows, { ...spec, headerRow: 1 });
    expect(r.headerRowIndex).toBe(1);
  });

  it('optional หาย → อยู่ใน missingOptional ไม่ throw', () => {
    const r = resolveHeaders('T', [['Project ID']], spec);
    expect(r.missingOptional.sort()).toEqual(['amount', 'client']);
    expect(r.index.client).toBeUndefined();
  });

  it('‼️ required หาย → throw 503 บอก tab + field + alias + หัวที่เจอจริง', () => {
    let caught;
    try {
      resolveHeaders('Project_Billing', [['Client', 'Amount']], spec);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(SheetMappingError);
    expect(caught.status).toBe(503);
    expect(caught.message).toContain('Project_Billing');
    expect(caught.message).toContain('projectId');
    expect(caught.message).toContain('Project Code'); // alias ที่ลองแล้ว
    expect(caught.message).toContain('Client');       // หัวที่เจอจริง
    expect(caught.detail.missingRequired).toEqual(['projectId']);
  });

  it('‼️ error message ต้องไม่มีค่าในแถวข้อมูล (log ห้ามหลุดชื่อลูกค้า)', () => {
    const rows = [['Client', 'Amount'], ['LUKKHA_SECRET_NAME', 999]];
    try {
      resolveHeaders('T', rows, spec);
      throw new Error('ควร throw');
    } catch (e) {
      expect(e.message).not.toContain('LUKKHA_SECRET_NAME');
      expect(e.message).not.toContain('999');
      expect(JSON.stringify(e.detail)).not.toContain('LUKKHA_SECRET_NAME');
    }
  });

  it('แท็บว่าง → throw พร้อมชื่อแท็บ', () => {
    expect(() => resolveHeaders('MA_Tracking', [], spec)).toThrow(/MA_Tracking/);
  });
});

describe('readTab', () => {
  const rows = [
    ['Project ID', 'Client', 'Amount'],
    ['PRJ_ALPHA', 'LUKKHA_A', 1000],
    [],                                   // แถวว่างล้วน → ข้าม
    ['PRJ_BETA'],                         // แถวสั้น (batchGet ตัดช่องว่างท้าย)
    ['PRJ_GAMMA', '', 500],               // ช่องว่างกลางแถว
  ];

  it('ข้ามแถวว่าง · เติมแถวสั้นเป็น null · _row = เลขแถวจริงในชีต', () => {
    const { items } = readTab('T', rows, spec);
    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({ _row: 2, projectId: 'PRJ_ALPHA', client: 'LUKKHA_A', amount: 1000 });
    expect(items[1]).toEqual({ _row: 4, projectId: 'PRJ_BETA', client: null, amount: null });
    expect(items[2]).toEqual({ _row: 5, projectId: 'PRJ_GAMMA', client: null, amount: 500 });
  });

  it('ไม่มี undefined หลุดออกไป', () => {
    const { items } = readTab('T', rows, spec);
    for (const it of items) for (const v of Object.values(it)) expect(v).not.toBeUndefined();
  });
});
