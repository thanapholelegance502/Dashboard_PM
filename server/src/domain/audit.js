// AuditLog helper — ทุก mutation จากหน้า Admin + override ต้องเรียก (MASTER §12.6)
import { prisma } from '../db/prisma.js';

/**
 * @param {object} a { appUserId, entity, entityId, action, before?, after?, reason? }
 *   entity: Project | SectionRule | AttentionItem | Member | PaymentInstallment | AppUser
 *   action: CREATE | UPDATE | DELETE | OVERRIDE
 */
export async function writeAudit(a, tx = prisma) {
  return tx.auditLog.create({
    data: {
      appUserId: a.appUserId ?? null,
      entity: a.entity,
      entityId: String(a.entityId),
      action: a.action,
      before: a.before ?? undefined,
      after: a.after ?? undefined,
      reason: a.reason ?? null,
    },
  });
}
