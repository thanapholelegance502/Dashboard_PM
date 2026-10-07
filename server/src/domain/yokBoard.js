// รวมแถวจากทุกแท็บ → 6 section ของบอร์ด YOK — pure ทั้งไฟล์ (test ได้โดยไม่ต้องมี DB)
//
// ‼️ MASTER §12.2 "KPI กับ list ที่อธิบายมัน มาจาก query เดียวกัน"
//    ทุก KPI คำนวณจาก array ตัวเดียวกับที่ส่งไปให้ client ใน pass เดียวกัน
// ‼️ MASTER §12.1 ทุกแถวพก rowRef → ลิงก์กลับไปที่ cell จริงในชีตได้
import { parseSheetDate, sheetDateToDate, parseThb, parsePercent, parseText } from './yokParse.js';
import { normalizeStage, YOK_STAGES } from './yokStage.js';
import { normalizeHealth } from './yokHealth.js';
import { daysUntil } from './time.js';

const MA_EXPIRING_DAYS = 60;

function ref(tab, gid, row) {
  return { tab, gid: gid ?? null, row };
}

/** นับแบบคงลำดับ + เก็บ id ของสมาชิกไว้ด้วย → KPI กับ list มาจากชุดเดียวกัน */
function tally(items, keyOf) {
  const m = new Map();
  for (const it of items) {
    const k = keyOf(it);
    if (k == null) continue;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(it);
  }
  return m;
}

/**
 * @param {object} tabs    { [tabName]: { items, resolved } }
 * @param {Map}    gidOf   tabName → gid
 * @param {Date}   now
 */
export function computeYokBoard({ tabs, gidOf = new Map(), now = new Date() }) {
  const warnings = [];
  const g = (t) => gidOf.get(t) ?? null;
  const rowsOf = (t) => tabs[t]?.items ?? [];

  const addWarn = (tab, kind, detail) => warnings.push({ tab, kind, ...detail });

  // แท็บที่ map ไม่ได้/ไม่ได้ดึงมา — บอกให้รู้ว่าหายไป ไม่ใช่เงียบ ๆ แล้วโชว์ 0
  for (const [t, v] of Object.entries(tabs)) {
    if (v?.resolved?.missingOptional?.length) {
      addWarn(t, 'missingOptional', { fields: v.resolved.missingOptional });
    }
    if (v?.resolved?.unknownHeaders?.length) {
      addWarn(t, 'unknownHeaders', { headers: v.resolved.unknownHeaders });
    }
  }

  // ── Weekly Update ────────────────────────────────────────
  const weeklyItems = rowsOf('Weekly_Update').map((r) => ({
    rowRef: ref('Weekly_Update', g('Weekly_Update'), r._row),
    projectId: parseText(r.projectId),
    projectName: parseText(r.projectName),
    week: parseText(r.week),
    weekStart: parseSheetDate(r.weekStart),
    weekEnd: parseSheetDate(r.weekEnd),
    summary: parseText(r.summary),
    risk: parseText(r.risk),
  }));
  // ใหม่สุดขึ้นก่อน — ไม่มีวันที่ไปท้าย
  weeklyItems.sort((a, b) => (b.weekStart ?? '').localeCompare(a.weekStart ?? ''));

  // ── Executive Action ─────────────────────────────────────
  const actionItems = rowsOf('Executive_Action').map((r) => {
    const neededBy = parseSheetDate(r.neededBy);
    const statusText = parseText(r.status);
    const done = statusText != null && /done|complete|closed|เสร็จ|ปิด/i.test(statusText);
    return {
      rowRef: ref('Executive_Action', g('Executive_Action'), r._row),
      projectId: parseText(r.projectId),
      topic: parseText(r.topic),
      owner: parseText(r.owner),
      neededBy,
      overdueDays: !done && neededBy ? Math.max(0, -(daysUntil(sheetDateToDate(neededBy), now) ?? 0)) || null : null,
      status: statusText,
      done,
    };
  });
  const openActions = actionItems.filter((a) => !a.done);
  actionItems.sort((a, b) => (a.neededBy ?? '9999').localeCompare(b.neededBy ?? '9999'));

  // ── Milestone ────────────────────────────────────────────
  const milestoneItems = rowsOf('Milestone').map((r) => {
    const dueDate = parseSheetDate(r.dueDate);
    return {
      rowRef: ref('Milestone', g('Milestone'), r._row),
      projectId: parseText(r.projectId),
      name: parseText(r.name),
      dueDate,
      inDays: dueDate ? daysUntil(sheetDateToDate(dueDate), now) : null,
      status: parseText(r.status),
    };
  });
  milestoneItems.sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999'));

  // ── Project Billing ──────────────────────────────────────
  const billingItems = rowsOf('Project_Billing').map((r) => {
    const dueDate = parseSheetDate(r.dueDate);
    const statusText = parseText(r.status);
    const paid = statusText != null && /paid|received|เก็บแล้ว|ชำระแล้ว/i.test(statusText);
    const d = dueDate ? daysUntil(sheetDateToDate(dueDate), now) : null;
    return {
      rowRef: ref('Project_Billing', g('Project_Billing'), r._row),
      projectId: parseText(r.projectId),
      projectName: parseText(r.projectName),
      installment: parseText(r.installment),
      amount: parseThb(r.amount), // null = ไม่ได้กรอก ไม่ใช่ ฿0
      dueDate,
      status: statusText,
      paid,
      overdueDays: !paid && d != null && d < 0 ? -d : null,
    };
  });
  const billedItems = billingItems.filter((b) => b.paid);
  const outstandingItems = billingItems.filter((b) => !b.paid);
  const overdueBilling = outstandingItems.filter((b) => b.overdueDays != null);
  const sum = (arr) => arr.reduce((a, b) => a + (b.amount ?? 0), 0);
  const noAmount = billingItems.filter((b) => b.amount == null).length;
  if (noAmount) addWarn('Project_Billing', 'missingAmount', { count: noAmount });

  // ── MA Tracking ──────────────────────────────────────────
  const maItems = rowsOf('MA_Tracking').map((r) => {
    const endDate = parseSheetDate(r.endDate);
    return {
      rowRef: ref('MA_Tracking', g('MA_Tracking'), r._row),
      projectId: parseText(r.projectId),
      projectName: parseText(r.projectName),
      client: parseText(r.client),
      startDate: parseSheetDate(r.startDate),
      endDate,
      daysLeft: endDate ? daysUntil(sheetDateToDate(endDate), now) : null,
      value: parseThb(r.value),
    };
  });
  maItems.sort((a, b) => (a.endDate ?? '9999').localeCompare(b.endDate ?? '9999'));
  const maExpiring = maItems.filter((m) => m.daysLeft != null && m.daysLeft >= 0 && m.daysLeft <= MA_EXPIRING_DAYS);
  const maExpired = maItems.filter((m) => m.daysLeft != null && m.daysLeft < 0);

  // ── Pending Kickoff ──────────────────────────────────────
  const pendingItems = rowsOf('Pending_Kickoff').map((r) => ({
    rowRef: ref('Pending_Kickoff', g('Pending_Kickoff'), r._row),
    projectId: parseText(r.projectId),
    projectName: parseText(r.projectName),
    client: parseText(r.client),
    value: parseThb(r.value),
    note: parseText(r.note),
  }));

  // ── Projects ─────────────────────────────────────────────
  // 🔴 ยังไม่มีแท็บรายโครงการ (เว็บหยกอ่านจาก Config!J ซึ่งยังไม่ยืนยันว่าคืออะไร)
  //    ระหว่างนี้ประกอบ roster จาก projectId ที่ปรากฏในแท็บอื่น — ได้รายชื่อ แต่ยังไม่มี stage/health
  const roster = new Map();
  const seed = (id, name, src) => {
    if (!id) return;
    if (!roster.has(id)) roster.set(id, { projectId: id, projectName: null, stage: null, health: null, progressPct: null, sources: [] });
    const p = roster.get(id);
    if (name && !p.projectName) p.projectName = name;
    if (!p.sources.includes(src)) p.sources.push(src);
  };
  for (const w of weeklyItems) seed(w.projectId, w.projectName, 'Weekly_Update');
  for (const b of billingItems) seed(b.projectId, b.projectName, 'Project_Billing');
  for (const m of maItems) seed(m.projectId, m.projectName, 'MA_Tracking');
  for (const m of milestoneItems) seed(m.projectId, null, 'Milestone');
  for (const a of actionItems) seed(a.projectId, null, 'Executive_Action');
  // ‼️ Pending_Kickoff ไม่เข้า roster โดยตั้งใจ — ยังไม่ kickoff คนละลิสต์กับโครงการที่เดินอยู่
  //    (เว็บหยกก็แยกสองลิสต์) นับรวมจะทำให้ KPI "จำนวนโครงการ" ไม่ตรงกับของหยก
  const projectItems = [...roster.values()].sort((a, b) => a.projectId.localeCompare(b.projectId));

  // stage/health เติมได้เมื่อรู้แท็บรายโครงการแล้ว — ตอนนี้ยังว่าง จึงไม่ยืนยันตัวเลข
  const byHealth = tally(projectItems, (p) => p.health);
  const byStage = tally(projectItems, (p) => p.stage);
  const projectsIncomplete = projectItems.every((p) => p.stage == null && p.health == null);
  if (projectsIncomplete && projectItems.length) {
    addWarn('Config', 'projectDetailPending', { note: 'ยังไม่ได้เชื่อมแท็บรายโครงการ — stage/health ยังว่าง' });
  }

  return {
    warnings,
    sections: {
      overview: {
        kpis: {
          projects: projectItems.length,
          openActions: openActions.length,
          overdueBilling: overdueBilling.length,
          maExpiring: maExpiring.length,
        },
        byHealth: [...byHealth].map(([k, v]) => ({ key: k, count: v.length })),
        byStage: YOK_STAGES.map((s) => ({ key: s, count: byStage.get(s)?.length ?? 0 })),
        projectsIncomplete,
      },
      weeklyUpdate: { items: weeklyItems },
      executiveAction: { items: actionItems, openCount: openActions.length },
      billing: {
        totals: {
          planned: sum(billingItems),
          billed: sum(billedItems),
          outstanding: sum(outstandingItems),
          overdue: sum(overdueBilling),
        },
        counts: {
          all: billingItems.length,
          billed: billedItems.length,
          outstanding: outstandingItems.length,
          overdue: overdueBilling.length,
        },
        items: billingItems,
      },
      maTracking: {
        items: maItems,
        expiringCount: maExpiring.length,
        expiredCount: maExpired.length,
        expiringWithinDays: MA_EXPIRING_DAYS,
      },
      projects: { items: projectItems, milestones: milestoneItems, pendingKickoff: pendingItems },
    },
  };
}
