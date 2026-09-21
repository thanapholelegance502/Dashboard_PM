// Pagination — บั๊กหลักของ Genspark (DATA-LAYER §9)
import { describe, it, expect } from 'vitest';
import { fetchAllTasks, fetchSections } from '../src/lark/tasks.js';

function makeGet(pages) {
  let call = 0;
  return async () => {
    const p = pages[call++];
    return { code: 0, data: p };
  };
}

const oneSection = new Map([['sec1', 'Testing']]);

describe('fetchAllTasks pagination (list ต่อ section)', () => {
  it('วนครบ 3 หน้า (100/100/81) → 281 ใบ, pages=3', async () => {
    const mk = (n, token, hasMore, prefix) => ({
      items: Array.from({ length: n }, (_, i) => ({ guid: `${prefix}_${i}` })),
      page_token: token,
      has_more: hasMore,
    });
    const get = makeGet([mk(100, 'p2', true, 'a'), mk(100, 'p3', true, 'b'), mk(81, undefined, false, 'c')]);
    const { tasks, pages } = await fetchAllTasks(oneSection, get);
    expect(tasks.length).toBe(281);
    expect(pages).toBe(3);
  });

  it('ห้ามหยุดเพราะ items สั้น: หน้า1 คืน 40 ใบ + has_more:true → ต้องยิงหน้า2', async () => {
    const get = makeGet([
      { items: Array.from({ length: 40 }, (_, i) => ({ guid: `a${i}` })), page_token: 'p2', has_more: true },
      { items: Array.from({ length: 5 }, (_, i) => ({ guid: `b${i}` })), page_token: undefined, has_more: false },
    ]);
    const { tasks, pages } = await fetchAllTasks(oneSection, get);
    expect(tasks.length).toBe(45);
    expect(pages).toBe(2);
  });

  it('หยุดเมื่อ has_more=false แม้มี page_token ติดมา', async () => {
    const get = makeGet([{ items: [{ guid: 'x' }], page_token: 'leftover', has_more: false }]);
    const { tasks, pages } = await fetchAllTasks(oneSection, get);
    expect(tasks.length).toBe(1);
    expect(pages).toBe(1);
  });

  it('วนหลาย section + dedup การ์ดที่ซ้ำข้าม section', async () => {
    const sections = new Map([['s1', 'A'], ['s2', 'B']]);
    const get = makeGet([
      { items: [{ guid: 'dup' }, { guid: 'x1' }], has_more: false },
      { items: [{ guid: 'dup' }, { guid: 'x2' }], has_more: false }, // dup ซ้ำ → นับครั้งเดียว
    ]);
    const { tasks } = await fetchAllTasks(sections, get);
    expect(tasks.map((t) => t.guid).sort()).toEqual(['dup', 'x1', 'x2']);
  });

  it('แนบ _sectionGuid/_sectionName ให้แต่ละการ์ด', async () => {
    const get = makeGet([{ items: [{ guid: 'x' }], has_more: false }]);
    const { tasks } = await fetchAllTasks(oneSection, get);
    expect(tasks[0]._sectionName).toBe('Testing');
    expect(tasks[0]._sectionGuid).toBe('sec1');
  });
});

describe('fetchSections', () => {
  it('map guid → name', async () => {
    const get = makeGet([
      { items: [{ guid: 's1', name: 'Testing' }, { guid: 's2', name: 'BA' }], has_more: false },
    ]);
    const m = await fetchSections('guid', get);
    expect(m.get('s1')).toBe('Testing');
    expect(m.get('s2')).toBe('BA');
  });
});
