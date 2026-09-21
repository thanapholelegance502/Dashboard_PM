// Test fixtures — ไม่มีชื่อลูกค้าจริง (MASTER §12.5) ใช้ projectCode/guid เท่านั้น
import { MATCH_TYPE } from '../src/domain/enums.js';

export const AUS_SILVER_GUID = '4e5f2452-c3d5-4d68-8d3f-1da9c0aa538d';

// rule set ตาม MASTER §5 (เหมือน seed) — ใส่ id ให้ resolveSectionRule คืน matchedRuleId ได้
export const RULES = [
  { id: 1, priority: 10, matchType: MATCH_TYPE.CONTAINS, pattern: 'block', deptCode: 'NONE', bucketCode: 'BLOCKED', weight: 50, projectId: null, isActive: true },
  { id: 2, priority: 20, matchType: MATCH_TYPE.EXACT, pattern: 'Waiting for Client', deptCode: 'BA', bucketCode: 'WAITING', weight: 5, projectId: null, isActive: true },
  { id: 3, priority: 20, matchType: MATCH_TYPE.EXACT, pattern: 'PM-Planning', deptCode: 'PM', bucketCode: 'IN_PROGRESS', weight: 10, projectId: null, isActive: true },
  { id: 4, priority: 20, matchType: MATCH_TYPE.EXACT, pattern: 'BA', deptCode: 'BA', bucketCode: 'IN_PROGRESS', weight: 20, projectId: null, isActive: true },
  { id: 5, priority: 20, matchType: MATCH_TYPE.EXACT, pattern: 'UXUI', deptCode: 'UXUI', bucketCode: 'IN_PROGRESS', weight: 30, projectId: null, isActive: true },
  { id: 6, priority: 20, matchType: MATCH_TYPE.EXACT, pattern: 'Ready for Dev', deptCode: 'DEV', bucketCode: 'BACKLOG', weight: 35, projectId: null, isActive: true },
  { id: 7, priority: 20, matchType: MATCH_TYPE.EXACT, pattern: 'Dev-In Progress', deptCode: 'DEV', bucketCode: 'IN_PROGRESS', weight: 50, projectId: null, isActive: true },
  { id: 8, priority: 20, matchType: MATCH_TYPE.EXACT, pattern: 'Dev-Ready for Deploy', deptCode: 'DEV', bucketCode: 'DONE', weight: 65, projectId: null, isActive: true },
  { id: 9, priority: 20, matchType: MATCH_TYPE.EXACT, pattern: 'Ready for Test', deptCode: 'QA', bucketCode: 'BACKLOG', weight: 70, projectId: null, isActive: true },
  { id: 10, priority: 20, matchType: MATCH_TYPE.EXACT, pattern: 'Testing', deptCode: 'QA', bucketCode: 'IN_PROGRESS', weight: 75, projectId: null, isActive: true },
  { id: 11, priority: 20, matchType: MATCH_TYPE.EXACT, pattern: 'Ready for UAT', deptCode: 'QA', bucketCode: 'WAITING', weight: 80, projectId: null, isActive: true },
  { id: 12, priority: 20, matchType: MATCH_TYPE.EXACT, pattern: 'Staging UAT', deptCode: 'QA', bucketCode: 'WAITING', weight: 82, projectId: null, isActive: true },
  { id: 13, priority: 20, matchType: MATCH_TYPE.EXACT, pattern: 'UAT', deptCode: 'QA', bucketCode: 'DONE', weight: 88, projectId: null, isActive: true },
  { id: 14, priority: 20, matchType: MATCH_TYPE.EXACT, pattern: 'Ready for PROD', deptCode: 'QA', bucketCode: 'DONE', weight: 95, projectId: null, isActive: true },
  { id: 15, priority: 20, matchType: MATCH_TYPE.EXACT, pattern: 'PROD', deptCode: 'QA', bucketCode: 'DONE', weight: 100, projectId: null, isActive: true },
  { id: 16, priority: 20, matchType: MATCH_TYPE.EXACT, pattern: 'DONE', deptCode: 'QA', bucketCode: 'DONE', weight: 100, projectId: null, isActive: true },
  { id: 17, priority: 20, matchType: MATCH_TYPE.EXACT, pattern: 'Fail bug', deptCode: 'QA', bucketCode: 'DONE', weight: 60, projectId: null, isActive: true },
  { id: 18, priority: 999, matchType: MATCH_TYPE.FALLBACK, pattern: '*', deptCode: 'NONE', bucketCode: 'BACKLOG', weight: 0, projectId: null, isActive: true },
];

// การกระจายการ์ดของบอร์ด AUS_SILVER ที่ยืนยันด้วยตา 18 ก.ย. (MASTER §10)
export const AUS_SILVER_COUNTS = {
  'Waiting for Client': 4,
  'PM-Planning': 3,
  BA: 2,
  UXUI: 0,
  'Ready for Dev': 3,
  'Dev-In Progress': 70,
  'Dev-Ready for Deploy': 9,
  'Ready for Test': 41,
  Testing: 0,
  'Ready for UAT': 0,
  UAT: 0,
  'Ready for PROD': 0,
  PROD: 0,
};

/** สร้าง sectionMap + raw tasks จำนวน 132 ใบตาม distribution จริง
 *  task แนบ _sectionGuid/_sectionName เหมือนที่ extract (list ต่อ section) ทำ */
export function buildAusSilver() {
  const sectionMap = new Map();
  const tasks = [];
  let guidN = 0;
  let secN = 0;
  for (const [name, count] of Object.entries(AUS_SILVER_COUNTS)) {
    const sectionGuid = `sec_${secN++}_${name.replace(/\s+/g, '_')}`;
    sectionMap.set(sectionGuid, name);
    for (let i = 0; i < count; i++) {
      tasks.push({
        guid: `task_${guidN++}`,
        summary: `${name} #${i}`,
        _sectionGuid: sectionGuid,
        _sectionName: name,
        members: [{ id: `ou_user_${guidN % 4}`, type: 'user', role: 'assignee' }],
      });
    }
  }
  return { sectionMap, tasks };
}
