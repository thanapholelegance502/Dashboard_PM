// ตรงกับ response ของ backend (server/src/api/routes/pm.js, admin.js)

export type ProjectStatus = 'ON_TRACK' | 'AT_RISK' | 'DELAYED' | 'DONE';

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
  forecastUat: string | null;
  actualUat: string | null;
  targetGolive: string | null;
  forecastGolive: string | null;
  actualGolive: string | null;
  slipDays: number | null;
  hasTargetGolive: boolean;
  counts: Counts;
}

export interface Kpis {
  total: number;
  onTrack: number;
  atRisk: number;
  delayed: number;
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
  forecastUat: string | null;
  targetGolive: string | null;
  forecastGolive: string | null;
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
export interface FinanceProjectRow {
  code: string;
  displayName: string;
  status: ProjectStatus;
  budget: number | null;
  billed: number;
  outstanding: number;
  planned: number;
  burnPct: number | null;
}
export interface FinanceResult {
  asOf: string;
  totals: { budget: number; billed: number; outstanding: number; planned: number; unplanned: number; burnPct: number | null };
  projects: FinanceProjectRow[];
  cashflow: { overdue: FinanceBucket; d0_30: FinanceBucket; d31_60: FinanceBucket; d61_90: FinanceBucket; d90plus: FinanceBucket; noDate: FinanceBucket };
  revenueAtRisk: { amount: number; items: Array<{ code: string; name: string; amount: number; dueDate: string | null }> };
  overdueInstallments: Array<{ code: string; name: string; amount: number; dueDate: string | null; overdueDays: number }>;
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
