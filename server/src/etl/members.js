// resolveNewMembers — open_id ที่ยังไม่มีใน Member → เรียก users/batch (DATA-LAYER §3.3, §5)
import { prisma } from '../db/prisma.js';
import { fetchUsersByOpenId } from '../lark/contacts.js';
import { DEPT } from '../domain/enums.js';

/** เก็บ open_id ทั้งหมดจาก records (assignee + creator) */
export function collectOpenIds(records) {
  const set = new Set();
  for (const r of records) {
    for (const id of r.assigneeOpenIds ?? []) set.add(id);
    if (r.creatorOpenId) set.add(r.creatorOpenId);
  }
  return [...set];
}

/**
 * หา open_id ที่ยังไม่มีใน Member แล้วดึงชื่อมา upsert
 * deptCode default = NONE ให้ข้าว tag ในหน้า Admin ทีหลัง (blocked-on B5)
 */
export async function resolveNewMembers(openIds) {
  if (openIds.length === 0) return { added: 0 };
  const existing = await prisma.member.findMany({
    where: { larkOpenId: { in: openIds } },
    select: { larkOpenId: true },
  });
  const known = new Set(existing.map((m) => m.larkOpenId));
  const missing = openIds.filter((id) => !known.has(id));
  if (missing.length === 0) return { added: 0 };

  const users = await fetchUsersByOpenId(missing);
  let added = 0;
  for (const u of users) {
    if (!u.open_id) continue;
    await prisma.member.upsert({
      where: { larkOpenId: u.open_id },
      create: {
        larkOpenId: u.open_id,
        displayName: u.name ?? u.open_id,
        nickname: u.nickname ?? null,
        deptCode: DEPT.NONE, // ให้ข้าว tag แผนกในหน้า Admin (B5)
      },
      update: { displayName: u.name ?? u.open_id, nickname: u.nickname ?? null },
    });
    added += 1;
  }
  return { added };
}
