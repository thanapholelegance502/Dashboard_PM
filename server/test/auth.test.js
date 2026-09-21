// Refresh token rotation (DATA-LAYER §2, §9)
import { describe, it, expect, vi, beforeEach } from 'vitest';

// mock prisma + lark client ก่อน import auth
const txUpdate = vi.fn(async ({ data }) => ({ accessToken: data.accessToken, ...data }));
const txQueryRaw = vi.fn(async () => [
  { id: 1, refreshToken: 'OLD_REFRESH', expiresAt: new Date(Date.now() + 60 * 1000) }, // ใกล้หมด (<5min)
]);
const txFindUnique = vi.fn();
const rootFindUnique = vi.fn();

vi.mock('../src/db/prisma.js', () => ({
  prisma: {
    oAuthToken: { findUnique: (...a) => rootFindUnique(...a) },
    $transaction: async (fn) =>
      fn({
        $queryRaw: (...a) => txQueryRaw(...a),
        oAuthToken: { update: (...a) => txUpdate(...a), findUnique: (...a) => txFindUnique(...a) },
      }),
  },
}));

const postForm = vi.fn();
vi.mock('../src/lark/client.js', () => ({
  larkPostForm: (...a) => postForm(...a),
  larkGet: vi.fn(),
  TOKEN_INVALID_CODES: new Set([99991668]),
}));

const { ensureAccessToken, ReauthorizeRequired } = await import('../src/lark/auth.js');

beforeEach(() => {
  txUpdate.mockClear();
  postForm.mockClear();
  rootFindUnique.mockReset();
});

describe('refresh rotation', () => {
  it('refresh 1 ครั้ง → refreshToken ใน DB ต้องเปลี่ยนเป็นค่าใหม่', async () => {
    rootFindUnique.mockResolvedValue({
      accessToken: 'OLD_ACCESS',
      refreshToken: 'OLD_REFRESH',
      expiresAt: new Date(Date.now() + 60 * 1000), // ใกล้หมด → ต้อง refresh
    });
    postForm.mockResolvedValue({ access_token: 'NEW_ACCESS', refresh_token: 'NEW_REFRESH', expires_in: 7200 });

    const token = await ensureAccessToken();
    expect(token).toBe('NEW_ACCESS');
    expect(txUpdate).toHaveBeenCalledTimes(1);
    const arg = txUpdate.mock.calls[0][0];
    expect(arg.data.refreshToken).toBe('NEW_REFRESH'); // หมุนแล้ว
    expect(arg.data.accessToken).toBe('NEW_ACCESS');
  });

  it('refresh ล้ม → ไม่ทับ token เดิม + โยน ReauthorizeRequired', async () => {
    rootFindUnique.mockResolvedValue({
      accessToken: 'OLD_ACCESS',
      refreshToken: 'OLD_REFRESH',
      expiresAt: new Date(Date.now() + 60 * 1000),
    });
    postForm.mockRejectedValue(new Error('network down'));

    await expect(ensureAccessToken()).rejects.toBeInstanceOf(ReauthorizeRequired);
    expect(txUpdate).not.toHaveBeenCalled(); // ห้ามทับด้วย null/ค่าพัง
  });

  it('token ยังไม่ใกล้หมด → คืนเลย ไม่ refresh', async () => {
    rootFindUnique.mockResolvedValue({
      accessToken: 'STILL_GOOD',
      refreshToken: 'R',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // อีก 1 ชม.
    });
    const token = await ensureAccessToken();
    expect(token).toBe('STILL_GOOD');
    expect(postForm).not.toHaveBeenCalled();
  });
});
