// Auto AttentionItem — 02-PM-DASHBOARD §7 (source=AUTO gen/resolve ทุกรอบ sync)
import { PROJECT_STATUS } from './enums.js';
import { BUCKET } from './enums.js';
import { overdueDaysOf } from './finance.js';

const BLOCKED_STALE_DAYS = 3;
const OVERDUE_RATIO = 0.2;
const PAYMENT_OVERDUE_DAYS = 3; // งวดเลยกำหนดตั้งแต่ 3 วันขึ้นไป → เด้ง CEO (C-4)

/**
 * คำนวณ auto attention ที่ "ควรเปิดอยู่" แล้วเทียบกับของเดิม
 * @param {object} project
 * @param {object} metrics ผลจาก computeProjectMetrics
 * @param {object[]} tasks Task[] ของ project (ใช้ดู blocked stale)
 * @param {object[]} existingAutoOpen AttentionItem source=AUTO status=OPEN ของ project นี้
 * @param {Date} now
 * @param {object[]} installments PaymentInstallment[] ของ project นี้ (C-4)
 * @returns {{ toCreate: object[], toUpdate: object[], toResolveIds: number[] }}
 */
export function computeAutoAttention(project, metrics, tasks, existingAutoOpen, now = new Date(), installments = []) {
  const desired = new Map(); // autoKey → { title, issueType, impactText, neededBy? }

  // เรื่องความคืบหน้างาน — โปรเจกต์ DONE (go-live แล้ว) ไม่ต้องเตือน
  // เรื่องเงิน (ข้อ 4) เตือนต่อแม้ DONE: ส่งมอบแล้วเงินยังไม่เข้า = ตอนที่ต้องตามที่สุด
  const workRules = metrics.status !== PROJECT_STATUS.DONE;

  // 1) โปรเจกต์ DELAYED
  if (workRules && metrics.status === PROJECT_STATUS.DELAYED) {
    const slip = metrics.slipDays != null && metrics.slipDays > 0 ? metrics.slipDays : null;
    desired.set('DELAYED', {
      title: 'โปรเจกต์ล่าช้า — ต้องตัดสินใจขยาย timeline หรือเพิ่มทรัพยากร',
      issueType: 'DECISION',
      impactText: slip ? `Go-Live ช้า ${slip} วัน` : 'เลยกำหนด Go-Live',
    });
  }

  // 2) การ์ด BLOCKED ค้าง > 3 วัน (proxy = larkUpdatedAt ไม่ขยับเกิน 3 วัน)
  const staleBlocked = tasks.filter(
    (t) => !t.isDeleted && t.bucketCode === BUCKET.BLOCKED && isStale(t.larkUpdatedAt, now, BLOCKED_STALE_DAYS)
  ).length;
  if (workRules && staleBlocked > 0) {
    desired.set('BLOCKED_STALE', {
      title: `งานติดปัญหาค้างเกิน ${BLOCKED_STALE_DAYS} วัน`,
      issueType: 'RISK',
      impactText: `${staleBlocked} ใบ ต้องปลดบล็อก`,
    });
  }

  // 3) overdue > 20% ของงานค้าง
  if (workRules && metrics.counts.open > 0 && metrics.counts.overdue / metrics.counts.open > OVERDUE_RATIO) {
    const pct = Math.round((metrics.counts.overdue / metrics.counts.open) * 100);
    desired.set('OVERDUE', {
      title: 'งานเกินกำหนดจำนวนมาก',
      issueType: 'RISK',
      impactText: `เกินกำหนด ${metrics.counts.overdue}/${metrics.counts.open} ใบ (${pct}%)`,
    });
  }

  // 4) งวดค้างเก็บเลยกำหนด (C-4) — นิยาม "เลยกำหนด" ใช้ตัวเดียวกับหน้า Finance
  const latePayments = installments
    .map((i) => ({ amount: i.amount, dueDate: i.dueDate, days: overdueDaysOf(i, now) }))
    .filter((x) => x.days != null && x.days >= PAYMENT_OVERDUE_DAYS);
  if (latePayments.length > 0) {
    const amount = latePayments.reduce((a, x) => a + x.amount, 0);
    const maxDays = Math.max(...latePayments.map((x) => x.days));
    // ครบกำหนดเก่าสุด → เรียงความเร่งด่วนในหน้า PM (เรียงตาม neededBy)
    const oldest = latePayments.reduce((a, x) => (new Date(x.dueDate) < new Date(a.dueDate) ? x : a));
    desired.set('PAYMENT_OVERDUE', {
      title: 'งวดค้างเก็บเลยกำหนดชำระ',
      issueType: 'DECISION',
      impactText: `${latePayments.length} งวด · ฿${new Intl.NumberFormat('en-US').format(amount)} · เลยกำหนดสูงสุด ${maxDays} วัน`,
      neededBy: new Date(oldest.dueDate),
    });
  }

  const existingKeys = new Set(existingAutoOpen.map((i) => i.autoKey));
  const toCreate = [];
  // เปิดอยู่แล้วแต่ตัวเลขขยับ (เลยกำหนดเพิ่มทุกวัน · จำนวนใบ blocked เปลี่ยน)
  // → อัพเดตข้อความ ไม่งั้นค้างโชว์เลขเก่าจนกว่าเงื่อนไขจะหายไป
  const toUpdate = [];
  for (const [autoKey, item] of desired) {
    if (!existingKeys.has(autoKey)) {
      toCreate.push({ ...item, autoKey, projectId: project.id, source: 'AUTO', status: 'OPEN' });
      continue;
    }
    const cur = existingAutoOpen.find((i) => i.autoKey === autoKey);
    const nextBy = item.neededBy ? item.neededBy.getTime() : null;
    const curBy = cur.neededBy ? new Date(cur.neededBy).getTime() : null;
    if (cur.impactText !== item.impactText || curBy !== nextBy) {
      toUpdate.push({ id: cur.id, impactText: item.impactText, neededBy: item.neededBy ?? null });
    }
  }
  // เงื่อนไขหายไป → auto-resolve (§7 AUTO item ที่เงื่อนไขหายไปแล้ว auto-resolve)
  const toResolveIds = existingAutoOpen.filter((i) => !desired.has(i.autoKey)).map((i) => i.id);

  return { toCreate, toUpdate, toResolveIds };
}

function isStale(updatedAt, now, days) {
  if (!updatedAt) return true; // ไม่รู้เวลา = ถือว่าค้าง (ปลอดภัยฝั่งเตือน)
  const t = updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
  if (Number.isNaN(t.getTime())) return true;
  return now.getTime() - t.getTime() > days * 24 * 60 * 60 * 1000;
}
