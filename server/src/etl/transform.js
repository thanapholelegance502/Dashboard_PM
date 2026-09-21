// TRANSFORM — แปลง raw Lark task → task record (pure, testได้ไม่ต้องต่อ DB/network)
import { resolveSectionRule } from '../domain/bucket.js';

// Lark timestamp: created_at/updated_at/completed_at + due.timestamp = ms string
function msToDate(v) {
  if (v == null || v === '0' || v === 0) return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return null;
  return new Date(n);
}

function extractAssignees(task) {
  const members = task.members ?? [];
  return members
    .filter((m) => (m.role ? m.role === 'assignee' : true) && (m.type ? m.type === 'user' : true))
    .map((m) => m.id)
    .filter(Boolean);
}

/**
 * @param {object} rawTask การ์ดดิบจาก Lark (แนบ _sectionGuid/_sectionName จาก extract)
 * @param {object} ctx { projectId, rules, sectionGuid?, sectionName? }
 *   ctx.sectionName/_sectionGuid override ได้ ไม่งั้นอ่านจาก rawTask._section*
 * @returns {object} record พร้อม upsert ลง Task
 */
export function transformTask(rawTask, ctx) {
  const { projectId, rules } = ctx;
  const sectionGuid = ctx.sectionGuid ?? rawTask._sectionGuid ?? '';
  const sectionName = ctx.sectionName ?? rawTask._sectionName ?? '';

  const rule = resolveSectionRule(sectionName, rules, projectId);

  return {
    larkTaskGuid: rawTask.guid,
    projectId,
    sectionGuid,
    sectionName,
    title: rawTask.summary ?? '(no title)',
    larkUrl: rawTask.url ?? null,
    assigneeOpenIds: extractAssignees(rawTask),
    creatorOpenId: rawTask.creator?.id ?? null,
    dueAt: msToDate(rawTask.due?.timestamp), // due.timestamp = ms (endpoint section/tasks)
    completedAt: msToDate(rawTask.completed_at),
    larkCreatedAt: msToDate(rawTask.created_at),
    larkUpdatedAt: msToDate(rawTask.updated_at),
    customFields: rawTask.custom_fields ?? null,
    deptCode: rule.deptCode,
    bucketCode: rule.bucketCode,
    sectionWeight: rule.weight,
    _isFallback: rule.isFallback, // ใช้ต่อในหน้า Admin เตือน section ที่ยังไม่ map
  };
}
