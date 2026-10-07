// ตรงกับ response ของ backend (server/src/api/routes/pm.js, admin.js)

// WAITING = รอเริ่ม — PM ตั้งผ่าน override เท่านั้น (auto ไม่คืนค่านี้)
export type ProjectStatus = 'ON_TRACK' | 'AT_RISK' | 'DELAYED' | 'DONE' | 'WAITING';

export interface Counts {
  open: number;
  done: number;
  blocked: number;
  overdue: number;
  total: number;
}

export interface ProjectRow {
  code: string;
  displayName: string;
  pmUserId: number | null;
  progressPct: number | null;
  progressSource: 'AUTO' | 'OVERRIDE';
  progressComputed: number | null;
  status: ProjectStatus;
  statusSource: 'AUTO' | 'OVERRIDE';
  statusAuto: ProjectStatus;
  statusReasons: string[];
  startDate: string | null;
  targetUat: string | null;
  actualUat: string | null;
  targetGolive: string | null;
  actualGolive: string | null;
  slipDays: number | null; // ช้ากว่า target Go-Live กี่วัน (บวก = ช้า) · null = ยังไม่ถึง/ไม่มี target
  hasTargetGolive: boolean;
  counts: Counts;
}

export interface Kpis {
  total: number;
  onTrack: number;
  atRisk: number;
  delayed: number;
  waiting: number;
  uatThisMonth: number;
  goliveThisMonth: number;
}

export interface Portfolio {
  asOf: string;
  asOfSnapshot?: string | null; // as-of mode: snapshot วันที่ใช้จริง
  asOfHasData?: boolean;
  lastSyncAt: string | null;
  kpis: Kpis;
  projects: ProjectRow[];
}

export interface Milestone {
  code: string;
  displayName: string;
  type: 'UAT' | 'GO_LIVE';
  date: string;
  inDays: number;
}

export interface AttentionItem {
  id: number;
  title: string;
  issueType: string;
  impactText: string;
  neededBy: string | null;
  status: string;
  source: 'MANUAL' | 'AUTO';
  autoKey: string | null;
  project: { projectCode: string; displayName: string };
}

export interface TrendResponse {
  weeksCollected: number;
  needForFullTrend: number;
  series: Array<Record<string, number | string>>;
}

export interface DrilldownItem {
  larkTaskGuid: string;
  title: string;
  sectionName: string;
  deptCode: string;
  bucketCode: string;
  assigneeOpenIds: string[];
  dueAt: string | null;
  overdue: boolean;
  larkUrl: string;
}

export interface DrilldownResult {
  code: string;
  total: number;
  byDept: Record<string, number>;
  bySection: Record<string, number>;
  items: DrilldownItem[];
}

export interface AdminProject {
  id: number;
  projectCode: string;
  displayName: string;
  larkTasklistGuid: string;
  startDate: string | null;
  targetUat: string | null;
  targetGolive: string | null;
  actualUat: string | null;
  actualGolive: string | null;
  statusOverride: string | null;
  progressOverride: number | null;
  budget: number | null;
  isActive: boolean;
}

export interface UnmappedSection {
  projectId: number;
  sectionName: string;
  cardCount: number;
}

export interface Installment {
  id: number;
  projectId: number;
  name: string;
  amount: number;
  dueDate: string | null;
  status: 'PENDING' | 'PAID';
  paidAt: string | null;
  sortOrder: number;
}

export interface BudgetResult {
  code: string;
  budget: number | null;
  installments: Installment[];
  paid: number;
  planned: number;
  burnPct: number | null;
}

export interface FinanceBucket { count: number; amount: number; }

/** ช่วงเวลาของงวดที่ยังไม่จ่าย — ตรงกับ CASHFLOW_BUCKETS ฝั่ง server */
export type CashflowBucketKey = 'overdue' | 'd0_30' | 'd31_60' | 'd61_90' | 'd90plus' | 'noDate';
/** 'paid' ไม่เข้า cashflow ใด ๆ แต่ต้องมีใน drawer */
export type InstallmentBucket = CashflowBucketKey | 'paid';

/** งวดแบน ๆ ทุกโครงการ — ป้อน drill-down หน้า Finance (ยอดเดียวกับที่ใช้คิด KPI) */
export interface FinanceInstallment {
  id: number;
  code: string;
  name: string;
  amount: number;
  dueDate: string | null;
  status: 'PENDING' | 'PAID';
  paidAt: string | null;
  sortOrder: number;
  bucket: InstallmentBucket;
  overdueDays: number | null;
  atRisk: boolean;
}

export interface FinanceProjectRow {
  code: string;
  displayName: string;
  status: ProjectStatus;
  budget: number | null;
  billed: number;
  outstanding: number;
  planned: number;
  unplanned: number;
  overPlanned: number;
  burnPct: number | null;
}
export interface FinanceResult {
  asOf: string;
  totals: {
    budget: number; billed: number; outstanding: number; planned: number;
    unplanned: number; overPlanned: number; overPlannedCount: number; noBudgetCount: number;
    burnPct: number | null;
  };
  projects: FinanceProjectRow[];
  cashflow: Record<CashflowBucketKey, FinanceBucket>;
  revenueAtRisk: { amount: number; items: Array<{ id: number; code: string; name: string; amount: number; dueDate: string | null }> };
  overdueInstallments: Array<{ id: number; code: string; name: string; amount: number; dueDate: string | null; overdueDays: number }>;
  installments: FinanceInstallment[];
}

export interface SectionRule {
  id: number;
  matchType: string;
  pattern: string;
  deptCode: string;
  bucketCode: string;
  weight: number;
  priority: number;
  projectId: number | null;
  isActive: boolean;
}

// ผู้ใช้ที่เข้าระบบได้ (whitelist SSO) — แท็บ "ผู้ใช้" ในหน้าตั้งค่า
export interface AppUserRow {
  id: number;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'PM' | 'VIEWER';
  isActive: boolean;
  linked: boolean; // login ด้วย Lark แล้วอย่างน้อย 1 ครั้ง
  boards: string[]; // บอร์ดที่ติ๊กให้ (ADMIN เห็นทุกบอร์ดโดยไม่ดูค่านี้)
}

// ทะเบียนบอร์ดแผนก — มาจาก server/src/domain/boards.js ผ่าน /api/auth/me
export interface BoardInfo {
  code: string;
  name: string;
  desc: string;
  path?: string;
  kind: 'internal' | 'external' | 'soon'; // external = แอปทีมแผนกที่ nginx วางไว้ใต้ path (เปิดเต็มหน้า)
}

// ── บอร์ด YOK (อ่าน Google Sheet ฝั่ง server) ─────────────
export type YokHealth = 'NOT_START' | 'ON_TRACK' | 'AT_RISK' | 'DELAYED' | 'BLOCKED' | 'COMPLETED';
/** ชี้กลับไปที่ cell จริงในชีต (§12.1) */
export interface YokRowRef { tab: string; gid: number | null; row: number }
export interface YokWarning { tab: string; kind: string; [k: string]: unknown }

export interface YokWeeklyRow { rowRef: YokRowRef; weekStart: string | null; summary: string | null }
export interface YokActionRow { rowRef: YokRowRef; projectId: string | null; topic: string | null; options: string | null; owner: string | null; impact: string | null; neededBy: string | null; decidedAt: string | null; overdueDays: number | null; status: string | null; note: string | null; done: boolean }
export interface YokMilestoneRow { rowRef: YokRowRef; projectId: string | null; projectName: string | null; name: string | null; dueDate: string | null; doneDate: string | null; inDays: number | null; status: string | null; owner: string | null }
/** 1 แถว = 1 โครงการ (ชีตคำนวณเก็บแล้ว/ค้างเก็บมาให้แล้ว) */
export interface YokBillingRow { rowRef: YokRowRef; projectId: string | null; projectName: string | null; client: string | null; systemCount: string | null; amountExVat: number | null; amountIncVat: number | null; installments: number | null; billed: number | null; outstanding: number | null; quotationNo: string | null; fullyPaid: boolean }
/** 1 แถว = 1 งวดชำระ */
export interface YokScheduleRow { rowRef: YokRowRef; projectId: string | null; installmentNo: number | null; amountExVat: number | null; vat: number | null; amountIncVat: number | null; dueDate: string | null; invoiceDate: string | null; paidDate: string | null; paid: boolean; overdueDays: number | null }
export interface YokMaRow { rowRef: YokRowRef; projectId: string | null; projectName: string | null; startDate: string | null; endDate: string | null; duration: string | null; daysLeft: number | null; maType: string | null; projectValue: number | null; value: number | null; payStatus: string | null; note: string | null }
export interface YokPendingRow { rowRef: YokRowRef; projectName: string | null; client: string | null; note: string | null }
export interface YokProjectRow { projectId: string; projectName: string | null; stage: string | null; health: YokHealth | null; progressPct: number | null; sources: string[] }

export interface YokDashboard {
  asOf: string;
  source?: string;
  ageSec: number;
  stale: boolean;
  staleReason?: string;
  degraded?: boolean;
  sheetUrl: string;
  tabs: string[];
  warnings: YokWarning[];
  sections: {
    overview: {
      kpis: { projects: number; openActions: number; outstandingProjects: number; overdueInstallments: number; maExpiring: number };
      byHealth: Array<{ key: YokHealth; count: number }>;
      byStage: Array<{ key: string; count: number }>;
      projectsIncomplete: boolean;
    };
    weeklyUpdate: { items: YokWeeklyRow[] };
    executiveAction: { items: YokActionRow[]; openCount: number };
    billing: {
      totals: { exVat: number; incVat: number; billed: number; outstanding: number };
      counts: { all: number; fullyPaid: number; withOutstanding: number; installments: number; overdueInstallments: number };
      overdueAmount: number;
      items: YokBillingRow[];
      schedule: YokScheduleRow[];
    };
    maTracking: { items: YokMaRow[]; expiringCount: number; expiredCount: number; expiringWithinDays: number };
    projects: { items: YokProjectRow[]; milestones: YokMilestoneRow[]; pendingKickoff: YokPendingRow[] };
  };
}
