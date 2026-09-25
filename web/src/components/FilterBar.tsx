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

const STATUS_OPTS: { v: string; label: string }[] = [
  { v: '', label: 'ทั้งหมด' },
  { v: 'ON_TRACK', label: 'On Track' },
  { v: 'AT_RISK', label: 'At Risk' },
  { v: 'DELAYED', label: 'Delayed' },
  { v: 'DONE', label: 'Done' },
  { v: 'WAITING', label: 'Waiting' },
];

export default function FilterBar({ projects, filters, onChange }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  return (
    <div className="no-print flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-ink-2">สถานะ:</span>
        <div className="seg max-w-full overflow-x-auto">
          {STATUS_OPTS.map((o) => (
            <button key={o.v} onClick={() => set({ status: o.v })} className={`seg-opt shrink-0 ${filters.status === o.v ? 'seg-opt-on' : ''}`}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2">
        <span className="text-ink-2">โปรเจกต์:</span>
        <select className="field-input py-1" value={filters.projectCode} onChange={(e) => set({ projectCode: e.target.value })}>
          <option value="">ทั้งหมด</option>
          {projects.map((p) => (
            <option key={p.code} value={p.code}>
              {p.displayName}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-2">
        <span className="text-ink-2">มุมมอง:</span>
        <div className="seg">
          <button className={`seg-opt ${filters.view === 'project' ? 'seg-opt-on' : ''}`} onClick={() => set({ view: 'project' })}>
            ตามโปรเจกต์
          </button>
          <button className="seg-opt" title="รอ tag PM เจ้าของแต่ละโปรเจกต์ (blocked-on B7)" disabled>
            ตาม PM
          </button>
        </div>
      </div>

      {(filters.status || filters.projectCode) && (
        <button className="btn-ghost btn-sm" onClick={() => set({ status: '', projectCode: '' })}>
          รีเซ็ต
        </button>
      )}
    </div>
  );
}
