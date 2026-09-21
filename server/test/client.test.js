// Host guard — ทุก request ต้องไป open-sg.larksuite.com (DATA-LAYER §1, §9)
import { describe, it, expect } from 'vitest';
import { lark } from '../src/lark/client.js';

describe('lark client host', () => {
  it('baseURL ชี้ open-sg (สิงคโปร์)', () => {
    expect(lark.defaults.baseURL).toContain('open-sg.larksuite.com');
  });
});
