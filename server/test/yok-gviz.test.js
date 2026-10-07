import { describe, it, expect } from 'vitest';
import { parseGvizBody, gvizTableToRows } from '../src/sheets/gvizClient.js';

const wrap = (obj) => `/*O_o*/\ngoogle.visualization.Query.setResponse(${JSON.stringify(obj)});`;

describe('parseGvizBody', () => {
  it('แกะ wrapper /*O_o*/...setResponse(...) ออกได้', () => {
    const body = parseGvizBody(wrap({ status: 'ok', table: { cols: [], rows: [] } }));
    expect(body.status).toBe('ok');
  });

  it('ตอบกลับไม่ใช่ JSON (เช่นหน้า login) → sheetAccess', () => {
    let caught;
    try { parseGvizBody('<!DOCTYPE html><html>Sign in</html>'); } catch (e) { caught = e; }
    expect(caught.sheetAccess).toBe(true);
  });

  it('‼️ ชีตถูกปิด → accessDenied ต้องติดธง sheetAccess (ไม่ใช่ error ทั่วไป)', () => {
    const payload = { status: 'error', errors: [{ reason: 'accessDenied', message: 'Access denied', detailed_message: '<b>ไม่มีสิทธิ์</b>' }] };
    let caught;
    try { parseGvizBody(wrap(payload)); } catch (e) { caught = e; }
    expect(caught.sheetAccess).toBe(true);
    expect(caught.sheetTabMissing).toBeUndefined();
    expect(caught.message).not.toContain('<b>'); // ตัด html ออกแล้ว
  });

  it('แท็บไม่มี → sheetTabMissing (ทั้งรอบไม่ควรพัง)', () => {
    const payload = { status: 'error', errors: [{ reason: 'invalid_query', message: 'invalid_query: sheet not found' }] };
    let caught;
    try { parseGvizBody(wrap(payload)); } catch (e) { caught = e; }
    expect(caught.sheetTabMissing).toBe(true);
    expect(caught.sheetAccess).toBeUndefined();
  });

  it('JSON เสีย → sheetAccess ไม่ใช่ crash', () => {
    expect(() => parseGvizBody('/*O_o*/ setResponse({broken)')).toThrow();
  });
});

describe('gvizTableToRows', () => {
  it('cell { v } → ค่าดิบ · null/ว่าง → ""', () => {
    const table = {
      cols: [{ label: '' }, { label: '' }],
      rows: [
        { c: [{ v: 'PRJ_ALPHA' }, { v: 1000 }] },
        { c: [{ v: null }, null] },
      ],
    };
    expect(gvizTableToRows(table)).toEqual([['PRJ_ALPHA', 1000], ['', '']]);
  });

  it('ถ้า gviz ยัดหัวตารางไว้ใน cols[].label → ดันขึ้นเป็นแถวแรก', () => {
    const table = {
      cols: [{ label: 'Project ID' }, { label: 'Amount' }],
      rows: [{ c: [{ v: 'PRJ_ALPHA' }, { v: 1000 }] }],
    };
    expect(gvizTableToRows(table)).toEqual([['Project ID', 'Amount'], ['PRJ_ALPHA', 1000]]);
  });

  it('วันที่มาเป็น string Date(y,m,d) — ส่งต่อให้ parser ไม่แปลงเอง', () => {
    const table = { cols: [{ label: '' }], rows: [{ c: [{ v: 'Date(2026,8,28)', f: '28/9/2026' }] }] };
    expect(gvizTableToRows(table)).toEqual([['Date(2026,8,28)']]);
  });

  it('table ว่าง/undefined ไม่ระเบิด', () => {
    expect(gvizTableToRows(undefined)).toEqual([]);
    expect(gvizTableToRows({ cols: [], rows: [] })).toEqual([]);
  });
});
