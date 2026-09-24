import type {
  Portfolio, Milestone, TrendResponse, AttentionItem, DrilldownResult,
  AdminProject, UnmappedSection, SectionRule, BudgetResult, Installment, FinanceResult, AppUserRow,
} from './types';

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const b = await res.json();
      msg = b.error ?? msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

const qs = (params: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

// ── PM ──────────────────────────────────────────────
export const getPortfolio = (f: { pm?: string; status?: string; projectCode?: string; asOf?: string } = {}) =>
  req<Portfolio>(`/pm/portfolio${qs(f)}`);
export const getMilestones = (days?: number) => req<{ items: Milestone[] }>(`/pm/milestones${qs({ days })}`);
export const getTrend = (weeks = 12) => req<TrendResponse>(`/pm/trend${qs({ weeks })}`);
export const getAttention = (status = 'OPEN') => req<{ items: AttentionItem[] }>(`/pm/attention${qs({ status })}`);
export const getDrilldown = (code: string, f: { dept?: string; bucket?: string; overdue?: string } = {}) =>
  req<DrilldownResult>(`/pm/projects/${code}/tasks${qs(f)}`);

// ── Auth ────────────────────────────────────────────
export interface Me { id: number; email: string; displayName: string; role: string }
export const getMe = () => req<Me>(`/auth/me`);
export const logout = () => req<{ ok: boolean }>(`/auth/logout`, { method: 'POST' });
export const loginUrl = '/api/auth/login';

// ── Sync ────────────────────────────────────────────
export const runSyncNow = () => req<unknown>(`/sync/run`, { method: 'POST' });

// ── Admin ───────────────────────────────────────────
export const getAdminProjects = () => req<AdminProject[]>(`/admin/projects`);
export const createProject = (data: { projectCode: string; displayName?: string; larkTasklistGuid: string }) =>
  req<AdminProject>(`/admin/projects`, { method: 'POST', body: JSON.stringify(data) });
export const patchProject = (code: string, data: Partial<AdminProject>) =>
  req<AdminProject>(`/admin/projects/${code}`, { method: 'PATCH', body: JSON.stringify(data) });
export const testConnection = (code: string) =>
  req<{ ok: boolean; sections?: number; cards?: number; error?: string }>(
    `/admin/projects/${code}/test-connection`, { method: 'POST' });
export const statusOverride = (code: string, status: string, reason: string) =>
  req<AdminProject>(`/admin/projects/${code}/status-override`, { method: 'POST', body: JSON.stringify({ status, reason }) });
export const progressOverride = (code: string, progress: number, reason: string) =>
  req<AdminProject>(`/admin/projects/${code}/progress-override`, { method: 'POST', body: JSON.stringify({ progress, reason }) });
export const getUnmappedSections = () => req<UnmappedSection[]>(`/meta/unmapped-sections`);
export const getSectionRules = () => req<SectionRule[]>(`/admin/section-rules`);
export const createSectionRule = (data: Partial<SectionRule>) =>
  req<SectionRule>(`/admin/section-rules`, { method: 'POST', body: JSON.stringify(data) });
export const patchSectionRule = (id: number, data: Partial<SectionRule>) =>
  req<SectionRule>(`/admin/section-rules/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteSectionRule = (id: number) =>
  req<{ ok: boolean }>(`/admin/section-rules/${id}`, { method: 'DELETE' });
export const recompute = () =>
  req<{ total: number; changed: number; unmapped: number }>(`/admin/recompute`, { method: 'POST' });

// ── Budget + งวดการเงิน (req2) ──────────────────────
export const getBudget = (code: string) => req<BudgetResult>(`/pm/projects/${code}/budget`);
export const getFinance = () => req<FinanceResult>(`/pm/finance`);
export const createInstallment = (code: string, data: { name: string; amount: number; dueDate?: string | null }) =>
  req<Installment>(`/admin/projects/${code}/installments`, { method: 'POST', body: JSON.stringify(data) });
export const patchInstallment = (id: number, data: Partial<Installment>) =>
  req<Installment>(`/admin/installments/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteInstallment = (id: number) =>
  req<{ ok: boolean }>(`/admin/installments/${id}`, { method: 'DELETE' });

// ── ผู้ใช้ (ADMIN เท่านั้น) ─────────────────────────
export const getUsers = () => req<AppUserRow[]>(`/admin/users`);
export const createUser = (data: { email: string; displayName?: string; role: AppUserRow['role'] }) =>
  req<AppUserRow>(`/admin/users`, { method: 'POST', body: JSON.stringify(data) });
export const patchUser = (id: number, data: Partial<Pick<AppUserRow, 'role' | 'isActive' | 'displayName'>>) =>
  req<AppUserRow>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
