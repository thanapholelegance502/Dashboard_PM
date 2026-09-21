import { describe, it, expect } from 'vitest';
import { resolveSectionRule } from '../src/domain/bucket.js';
import { RULES } from './fixtures.js';

describe('resolveSectionRule (MASTER §5)', () => {
  it('exact match', () => {
    const r = resolveSectionRule('Ready for Test', RULES);
    expect(r).toMatchObject({ deptCode: 'QA', bucketCode: 'BACKLOG', weight: 70 });
    expect(r.isFallback).toBe(false);
  });

  it('Fail bug = DONE ในมุม tester แต่ weight ต่ำ (60)', () => {
    const r = resolveSectionRule('Fail bug', RULES);
    expect(r).toMatchObject({ deptCode: 'QA', bucketCode: 'DONE', weight: 60 });
  });

  it('section ที่ไม่ match → fallback NONE/BACKLOG/0', () => {
    const r = resolveSectionRule('Some New Section', RULES);
    expect(r).toMatchObject({ deptCode: 'NONE', bucketCode: 'BACKLOG', weight: 0 });
    expect(r.isFallback).toBe(true);
  });

  it('BLOCKED เป็น overlay: bucket=BLOCKED เสมอเมื่อชื่อมีคำว่า block (case-insensitive)', () => {
    const r = resolveSectionRule('Blocked', RULES);
    expect(r.bucketCode).toBe('BLOCKED');
    expect(r.weight).toBe(50);
  });

  it('project-specific rule ชนะ global เมื่อ priority เท่ากัน', () => {
    const rules = [
      ...RULES,
      { id: 99, priority: 20, matchType: 'EXACT', pattern: 'Testing', deptCode: 'QA', bucketCode: 'IN_PROGRESS', weight: 77, projectId: 5, isActive: true },
    ];
    const r = resolveSectionRule('Testing', rules, 5);
    expect(r.weight).toBe(77); // override
    const g = resolveSectionRule('Testing', rules, 6);
    expect(g.weight).toBe(75); // global
  });
});
