import { describe, it, expect } from 'vitest';
import { transformTask } from '../src/etl/transform.js';
import { RULES } from './fixtures.js';

const ctx = (over = {}) => ({ projectId: 1, rules: RULES, ...over });

// การ์ดที่ extract แนบ _sectionGuid/_sectionName มาแล้ว (list ต่อ section)
const raw = (over = {}) => ({ guid: 't', summary: 'card', ...over });

describe('transformTask', () => {
  it('map section → dept/bucket/weight', () => {
    const r = transformTask(raw({ _sectionGuid: 's1', _sectionName: 'Testing' }), ctx());
    expect(r).toMatchObject({ sectionName: 'Testing', deptCode: 'QA', bucketCode: 'IN_PROGRESS', sectionWeight: 75 });
  });

  it('ctx.sectionName override ค่าใน raw', () => {
    const r = transformTask(raw({ _sectionName: 'Testing' }), ctx({ sectionName: 'Ready for Test' }));
    expect(r.sectionName).toBe('Ready for Test');
    expect(r.bucketCode).toBe('BACKLOG');
  });

  it('parse timestamp: due.timestamp + created/completed = ms', () => {
    const r = transformTask(
      raw({
        _sectionName: 'Testing',
        due: { timestamp: '1700000000000', is_all_day: true },
        created_at: '1700000000000',
        completed_at: '0',
      }),
      ctx()
    );
    expect(r.dueAt.getTime()).toBe(1700000000000);
    expect(r.larkCreatedAt.getTime()).toBe(1700000000000);
    expect(r.completedAt).toBeNull();
  });

  it('section ที่ไม่มี rule → dept=NONE + _isFallback=true', () => {
    const r = transformTask(raw({ _sectionName: 'Mystery' }), ctx());
    expect(r.deptCode).toBe('NONE');
    expect(r._isFallback).toBe(true);
  });

  it('assignee เอาเฉพาะ role=assignee', () => {
    const r = transformTask(
      raw({
        _sectionName: 'Testing',
        members: [
          { id: 'ou_1', type: 'user', role: 'assignee' },
          { id: 'ou_2', type: 'user', role: 'follower' },
        ],
      }),
      ctx()
    );
    expect(r.assigneeOpenIds).toEqual(['ou_1']);
  });
});
