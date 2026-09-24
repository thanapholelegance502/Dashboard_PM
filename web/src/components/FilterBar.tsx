import type { ProjectRow } from '../lib/types';

export interface Filters {
  status: string;
  projectCode: string;
  view: 'project' | 'pm';
}

interface Props {
  projects: ProjectRow[];
  filters: Filters;
  onChange: (f: Filters) => void;
}

export default function FilterBar({ projects, filters, onChange }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-white p-3 text-sm shadow-sm ring-1 ring-slate-200 no-print">
      <label className="flex items-center gap-1">
        <span className="text-slate-500">สถานะ:</span>
        <select
          className="rounded border border-slate-300 px-2 py-1"
          value={filters.status}
          onChange={(e) => set({ status: e.target.value })}
        >
          <option value="">ทั้งหมด</option>
          <option value="ON_TRACK">On Track</option>
          <option value="AT_RISK">At Risk</option>
          <option value="DELAYED">Delayed</option>
          <option value="DONE">Done</option>
          <option value="WAITING">Waiting</option>
        </select>
      </label>

      <label className="flex items-center gap-1">
        <span className="text-slate-500">โปรเจกต์:</span>
        <select
          className="rounded border border-slate-300 px-2 py-1"
          value={filters.projectCode}
          onChange={(e) => set({ projectCode: e.target.value })}
        >
          <option value="">ทั้งหมด</option>
          {projects.map((p) => (
            <option key={p.code} value={p.code}>
              {p.displayName}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-1">
        <span className="text-slate-500">มุมมอง:</span>
        <div className="flex overflow-hidden rounded border border-slate-300">
          <button
            className={`px-2 py-1 ${filters.view === 'project' ? 'bg-doing text-white' : 'bg-white'}`}
            onClick={() => set({ view: 'project' })}
          >
            ตามโปรเจกต์
          </button>
          <button
            className="cursor-not-allowed px-2 py-1 text-slate-300"
            title="รอ tag PM เจ้าของแต่ละโปรเจกต์ (blocked-on B7)"
            disabled
          >
            ตาม PM
          </button>
        </div>
      </div>

      {(filters.status || filters.projectCode) && (
        <button className="text-xs text-doing hover:underline" onClick={() => set({ status: '', projectCode: '' })}>
          รีเซ็ต
        </button>
      )}
    </div>
  );
}
