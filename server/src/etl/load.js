// LOAD — upsert Task + soft-delete การ์ดที่หายจาก Lark (DATA-LAYER §5)
import { prisma } from '../db/prisma.js';

/**
 * upsert task records ของ 1 project แล้ว soft-delete การ์ดที่ไม่เจอรอบนี้
 * @param {number} projectId
 * @param {object[]} records ผลจาก transformTask
 * @param {Date} runStartedAt เวลาเริ่ม sync รอบนี้ (ใช้เทียบ lastSeenAt)
 */
export async function loadTasks(projectId, records, runStartedAt) {
  const now = new Date();
  for (const r of records) {
    const data = {
      projectId: r.projectId,
      sectionGuid: r.sectionGuid,
      sectionName: r.sectionName,
      title: r.title,
      larkUrl: r.larkUrl,
      assigneeOpenIds: r.assigneeOpenIds,
      creatorOpenId: r.creatorOpenId,
      dueAt: r.dueAt,
      completedAt: r.completedAt,
      larkCreatedAt: r.larkCreatedAt,
      larkUpdatedAt: r.larkUpdatedAt,
      customFields: r.customFields ?? undefined,
      deptCode: r.deptCode,
      bucketCode: r.bucketCode,
      sectionWeight: r.sectionWeight,
      lastSeenAt: now,
      isDeleted: false, // เจอในรอบนี้ = ฟื้นถ้าเคยถูก soft-delete
    };
    await prisma.task.upsert({
      where: { larkTaskGuid: r.larkTaskGuid },
      create: { larkTaskGuid: r.larkTaskGuid, ...data },
      update: data,
    });
  }

  // soft-delete: การ์ดของ project นี้ที่ lastSeenAt เก่ากว่ารอบนี้ = หายจาก Lark
  // ห้าม hard delete (ต้องเทียบ snapshot ย้อนหลังได้ — DATA-LAYER §5, MASTER §12.4)
  const softDeleted = await prisma.task.updateMany({
    where: { projectId, isDeleted: false, lastSeenAt: { lt: runStartedAt } },
    data: { isDeleted: true },
  });
  return { upserted: records.length, softDeleted: softDeleted.count };
}
