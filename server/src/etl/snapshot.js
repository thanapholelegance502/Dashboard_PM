// writeSnapshot — รันต่อท้าย sync รอบ 17:00 (DATA-LAYER §5, MASTER §8)
// เขียน TaskStateSnapshot (ทุกการ์ด) + DailyAggregate (สรุป) · upsert = กดซ้ำวันเดิมได้ ไม่เละ
import { prisma } from '../db/prisma.js';
import { snapshotDateBkk } from '../domain/time.js';
import { computeWeightedProgress } from '../domain/progress.js';

export async function writeSnapshot(now = new Date()) {
  const snapshotDate = snapshotDateBkk(now);
  const tasks = await prisma.task.findMany({ where: { isDeleted: false } });

  // 1) TaskStateSnapshot ต่อการ์ด
  for (const t of tasks) {
    await prisma.taskStateSnapshot.upsert({
      where: { snapshotDate_larkTaskGuid: { snapshotDate, larkTaskGuid: t.larkTaskGuid } },
      create: {
        snapshotDate,
        larkTaskGuid: t.larkTaskGuid,
        projectId: t.projectId,
        deptCode: t.deptCode,
        bucketCode: t.bucketCode,
        sectionName: t.sectionName,
      },
      update: {
        projectId: t.projectId,
        deptCode: t.deptCode,
        bucketCode: t.bucketCode,
        sectionName: t.sectionName,
      },
    });
  }

  // 2) DailyAggregate สรุป count ต่อ (project, dept, bucket) + progressPct ต่อ project
  const byKey = new Map(); // `${projectId}|${dept}|${bucket}` → count
  const byProject = new Map(); // projectId → task[]
  for (const t of tasks) {
    const k = `${t.projectId}|${t.deptCode}|${t.bucketCode}`;
    byKey.set(k, (byKey.get(k) ?? 0) + 1);
    if (!byProject.has(t.projectId)) byProject.set(t.projectId, []);
    byProject.get(t.projectId).push(t);
  }
  const projProgress = new Map();
  for (const [pid, arr] of byProject) projProgress.set(pid, computeWeightedProgress(arr));

  for (const [k, count] of byKey) {
    const [projectIdStr, deptCode, bucketCode] = k.split('|');
    const projectId = Number(projectIdStr);
    await prisma.dailyAggregate.upsert({
      where: {
        snapshotDate_projectId_deptCode_bucketCode: { snapshotDate, projectId, deptCode, bucketCode },
      },
      create: {
        snapshotDate,
        projectId,
        deptCode,
        bucketCode,
        taskCount: count,
        progressPct: projProgress.get(projectId) ?? null,
      },
      update: { taskCount: count, progressPct: projProgress.get(projectId) ?? null },
    });
  }

  return { snapshotDate, cards: tasks.length, aggregates: byKey.size };
}
