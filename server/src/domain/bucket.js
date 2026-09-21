// Rule engine: section name → { deptCode, bucketCode, weight } — MASTER §5
// กติกา: match ตามลำดับ priority น้อย→มาก เจอตัวแรกที่ match แล้วหยุด
// ยกเว้น BLOCKED: เป็น overlay — ถ้า section เป็น block ให้ bucket=BLOCKED
//   แต่ dept ยังมาจาก rule ปกติถ้ามี (MASTER §5 หมายเหตุ) มิฉะนั้น NONE
import { MATCH_TYPE, BUCKET, DEPT } from './enums.js';

function ruleMatches(rule, sectionName) {
  const name = sectionName ?? '';
  switch (rule.matchType) {
    case MATCH_TYPE.EXACT:
      return name === rule.pattern;
    case MATCH_TYPE.CONTAINS:
      return name.toLowerCase().includes(String(rule.pattern).toLowerCase());
    case MATCH_TYPE.FALLBACK:
      return true;
    default:
      return false;
  }
}

function isBlockRule(rule) {
  return rule.bucketCode === BUCKET.BLOCKED;
}

/**
 * @param {string} sectionName
 * @param {Array<{matchType,pattern,deptCode,bucketCode,weight,priority,projectId,isActive}>} rules
 * @param {number|null} projectId
 * @returns {{deptCode:string, bucketCode:string, weight:number, matchedRuleId?:number, isFallback:boolean}}
 */
export function resolveSectionRule(sectionName, rules, projectId = null) {
  // 1) กรอง rule ที่ active + ใช้ได้กับ project นี้ (project-specific ชนะ global)
  const applicable = rules
    .filter((r) => r.isActive !== false)
    .filter((r) => r.projectId == null || r.projectId === projectId)
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      // project-specific มาก่อน global เมื่อ priority เท่ากัน
      return (b.projectId == null ? 0 : 1) - (a.projectId == null ? 0 : 1);
    });

  // 2) หา block overlay (priority ต่ำสุดที่เป็น block และ match)
  const blockMatch = applicable.find((r) => isBlockRule(r) && ruleMatches(r, sectionName));

  // 3) หา primary match ตัวแรก (ไม่ใช่ block) ตามลำดับ priority
  const primary = applicable.find((r) => !isBlockRule(r) && ruleMatches(r, sectionName));

  const isFallback = !primary || primary.matchType === MATCH_TYPE.FALLBACK;

  if (blockMatch) {
    return {
      deptCode: primary ? primary.deptCode : DEPT.NONE,
      bucketCode: BUCKET.BLOCKED,
      weight: blockMatch.weight,
      matchedRuleId: blockMatch.id,
      isFallback: false,
    };
  }

  if (primary) {
    return {
      deptCode: primary.deptCode,
      bucketCode: primary.bucketCode,
      weight: primary.weight,
      matchedRuleId: primary.id,
      isFallback,
    };
  }

  // ไม่ match อะไรเลย (ไม่มี fallback ใน rule set) → NONE / BACKLOG / 0
  return { deptCode: DEPT.NONE, bucketCode: BUCKET.BACKLOG, weight: 0, isFallback: true };
}
