// Finance aggregation — หน้า Finance (C-level) §6.4
// pure function: ไม่แตะ Prisma → unit test ได้ใน test:ci (ไม่ต้องมี DB)
//
// ‼️ MASTER §12.2 "KPI กับ list ที่อธิบายมัน มาจาก query เดียวกัน"
// bucket ของแต่ละงวดถูกติดป้ายใน if/else if อันเดียวกับที่บวก cashflow[k] →
// ยอดบนการ์ดกับรายการใน drawer แตกกันไม่ได้ (server/test/finance.test.js พิสูจน์)
import { daysUntil } from './time.js';
import { PROJECT_STATUS } from './enums.js';

/** ช่วงเวลาของงวดที่ยังไม่จ่าย — key เดียวกับที่ UI ใช้ */
export const CASHFLOW_BUCKETS = Object.freeze([
  'overdue',
  'd0_30',
  'd31_60',
  'd61_90',
  'd90plus',
  'noDate',
]);

/**
 * งวดนี้เลยกำหนดชำระมากี่วัน — null ถ้าจ่ายแล้ว / ไม่มีวันครบกำหนด / ยังไม่ถึงกำหนด
 * นิยาม "เลยกำหนด" ของทั้งระบบอยู่ที่นี่ที่เดียว (หน้า Finance + CEO Attention ใช้ร่วมกัน)
 */
export function overdueDaysOf(installment, now = new Date()) {
  if (installment.status === 'PAID') return null;
  const d = daysUntil(installment.dueDate, now);
  return d != null && d < 0 ? -d : null;
}

function emptyBucket() {
  return { count: 0, amount: 0 };
}

/**
 * @param projects     Project[] (active, เรียง sortOrder แล้ว)
 * @param installments PaymentInstallment[] (ทุกโครงการ เรียง projectId/sortOrder/id)
 * @param statusOf     Map<projectId, PROJECT_STATUS> — status ที่ resolve แล้ว
 */
export function computeFinance({ projects, installments, statusOf, now = new Date() }) {
  const byProject = new Map();
  for (const i of installments) {
    if (!byProject.has(i.projectId)) byProject.set(i.projectId, []);
    byProject.get(i.projectId).push(i);
  }

  const totals = { budget: 0, billed: 0, outstanding: 0, planned: 0, unplanned: 0, overPlanned: 0, overPlannedCount: 0, noBudgetCount: 0 };
  const cashflow = Object.fromEntries(CASHFLOW_BUCKETS.map((k) => [k, emptyBucket()]));
  const revenueAtRisk = { amount: 0, items: [] };
  const overdueInstallments = [];
  const items = []; // flat — ป้อน drill-down ทั้ง 3 แบบ

  const projectRows = projects.map((p) => {
    const inst = byProject.get(p.id) ?? [];
    const billed = inst.filter((i) => i.status === 'PAID').reduce((a, i) => a + i.amount, 0);
    const planned = inst.reduce((a, i) => a + i.amount, 0);
    const outstanding = planned - billed;
    // §12.11 budget null = ยังไม่ใส่มูลค่างาน ไม่ใช่ ฿0 → เทียบขาด/เกินไม่ได้ นับแยกไว้เตือนบน KPI
    const hasBudget = p.budget != null;
    if (!hasBudget) totals.noBudgetCount++;
    // ตั้งงวดขาด/เกิน แยกกันคนละยอด ไม่ให้ตัวติดลบกลบยอดของโครงการอื่น
    const unplanned = hasBudget ? Math.max(0, p.budget - planned) : 0;
    const overPlanned = hasBudget ? Math.max(0, planned - p.budget) : 0;

    totals.budget += p.budget ?? 0;
    totals.billed += billed;
    totals.planned += planned;
    totals.outstanding += outstanding;
    totals.unplanned += unplanned;
    totals.overPlanned += overPlanned;
    if (overPlanned > 0) totals.overPlannedCount++;

    const status = statusOf.get(p.id);
    for (const i of inst) {
      const atRisk = i.status !== 'PAID' && status === PROJECT_STATUS.DELAYED;
      const d = daysUntil(i.dueDate, now);
      let bucket;
      let overdueDays = null;

      if (i.status === 'PAID') {
        bucket = 'paid'; // ไม่เข้า cashflow ใด ๆ แต่ drawer ต้องเห็น ("งวดไหนจ่ายแล้ว")
      } else {
        if (d == null) bucket = 'noDate';
        else if (d < 0) {
          bucket = 'overdue';
          overdueDays = -d;
        } else if (d <= 30) bucket = 'd0_30';
        else if (d <= 60) bucket = 'd31_60';
        else if (d <= 90) bucket = 'd61_90';
        else bucket = 'd90plus';

        cashflow[bucket].count++;
        cashflow[bucket].amount += i.amount;

        if (bucket === 'overdue') {
          overdueInstallments.push({ id: i.id, code: p.projectCode, name: i.name, amount: i.amount, dueDate: i.dueDate, overdueDays });
        }
        // revenue at risk — งวดที่ผูกกับ project DELAYED (ตั้งใจนับซ้ำกับ cashflow)
        if (atRisk) {
          revenueAtRisk.amount += i.amount;
          revenueAtRisk.items.push({ id: i.id, code: p.projectCode, name: i.name, amount: i.amount, dueDate: i.dueDate });
        }
      }

      items.push({
        id: i.id,
        code: p.projectCode,
        name: i.name,
        amount: i.amount,
        dueDate: i.dueDate,
        status: i.status,
        paidAt: i.paidAt ?? null,
        sortOrder: i.sortOrder ?? 0,
        bucket,
        overdueDays,
        atRisk,
      });
    }

    return {
      code: p.projectCode,
      displayName: p.displayName,
      status,
      budget: p.budget,
      billed,
      outstanding,
      planned,
      unplanned,
      overPlanned,
      burnPct: p.budget && p.budget > 0 ? Math.round((billed / p.budget) * 100) : null,
    };
  });

  totals.burnPct = totals.budget > 0 ? Math.round((totals.billed / totals.budget) * 100) : null;
  overdueInstallments.sort((a, b) => b.overdueDays - a.overdueDays);

  return { totals, projects: projectRows, cashflow, revenueAtRisk, overdueInstallments, installments: items };
}
