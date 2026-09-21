// Auto AttentionItem — 02-PM-DASHBOARD §7 (source=AUTO gen/resolve ทุกรอบ sync)
import { PROJECT_STATUS } from './enums.js';
import { BUCKET } from './enums.js';

const BLOCKED_STALE_DAYS = 3;
const OVERDUE_RATIO = 0.2;

/**
 * คำนวณ auto attention ที่ "ควรเปิดอยู่" แล้วเทียบกับของเดิม
 * @param {object} project
 * @param {object} metrics ผลจาก computeProjectMetrics
 * @param {object[]} tasks Task[] ของ project (ใช้ดู blocked stale)
 * @param {object[]} existingAutoOpen AttentionItem source=AUTO status=OPEN ของ project นี้
 * @param {Date} now
 * @returns {{ toCreate: object[], toResolveIds: number[] }}
 */
export function computeAutoAttention(project, metrics, tasks, existingAutoOpen, now = new Date()) {
  const desired = new Map(); // autoKey → { title, issueType, impactText }

  // โปรเจกต์ DONE (go-live แล้ว) → ไม่ต้องเตือนอะไร resolve auto ทั้งหมด
  if (metrics.status === PROJECT_STATUS.DONE) {
    return { toCreate: [], toResolveIds: existingAutoOpen.map((i) => i.id) };
  }

  // 1) โปรเจกต์ DELAYED
  if (metrics.status === PROJECT_STATUS.DELAYED) {
    const slip = metrics.slipDays != null && metrics.slipDays < 0 ? Math.abs(metrics.slipDays) : null;
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
  if (staleBlocked > 0) {
    desired.set('BLOCKED_STALE', {
      title: `งานติดปัญหาค้างเกิน ${BLOCKED_STALE_DAYS} วัน`,
      issueType: 'RISK',
      impactText: `${staleBlocked} ใบ ต้องปลดบล็อก`,
    });
  }

  // 3) overdue > 20% ของงานค้าง
  if (metrics.counts.open > 0 && metrics.counts.overdue / metrics.counts.open > OVERDUE_RATIO) {
    const pct = Math.round((metrics.counts.overdue / metrics.counts.open) * 100);
    desired.set('OVERDUE', {
      title: 'งานเกินกำหนดจำนวนมาก',
      issueType: 'RISK',
      impactText: `เกินกำหนด ${metrics.counts.overdue}/${metrics.counts.open} ใบ (${pct}%)`,
    });
  }

  const existingKeys = new Set(existingAutoOpen.map((i) => i.autoKey));
  const toCreate = [];
  for (const [autoKey, item] of desired) {
    if (!existingKeys.has(autoKey)) {
      toCreate.push({ ...item, autoKey, projectId: project.id, source: 'AUTO', status: 'OPEN' });
    }
  }
  // เงื่อนไขหายไป → auto-resolve (§7 AUTO item ที่เงื่อนไขหายไปแล้ว auto-resolve)
  const toResolveIds = existingAutoOpen.filter((i) => !desired.has(i.autoKey)).map((i) => i.id);

  return { toCreate, toResolveIds };
}

function isStale(updatedAt, now, days) {
  if (!updatedAt) return true; // ไม่รู้เวลา = ถือว่าค้าง (ปลอดภัยฝั่งเตือน)
  const t = updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
  if (Number.isNaN(t.getTime())) return true;
  return now.getTime() - t.getTime() > days * 24 * 60 * 60 * 1000;
}
