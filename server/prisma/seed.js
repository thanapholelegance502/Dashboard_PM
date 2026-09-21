// Seed section_rule (MASTER §5) + projects (DATA-LAYER §8)
// ห้ามใส่ชื่อลูกค้าจริง — displayName = projectCode ไปก่อน (MASTER §1.13)
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// MASTER §5 — priority น้อย→มาก, เจอตัวแรก match แล้วหยุด
// ⚠️ weight ของ Ready for UAT→WAITING / Ready for PROD→DONE ยังรอข้าวยืนยัน (B3/B4)
const rules = [
  { priority: 10, matchType: 'CONTAINS', pattern: 'block', deptCode: 'NONE', bucketCode: 'BLOCKED', weight: 50 },
  { priority: 20, matchType: 'EXACT', pattern: 'Waiting for Client', deptCode: 'BA', bucketCode: 'WAITING', weight: 5 },
  { priority: 20, matchType: 'EXACT', pattern: 'PM-Planning', deptCode: 'PM', bucketCode: 'IN_PROGRESS', weight: 10 },
  { priority: 20, matchType: 'EXACT', pattern: 'BA', deptCode: 'BA', bucketCode: 'IN_PROGRESS', weight: 20 },
  { priority: 20, matchType: 'EXACT', pattern: 'UXUI', deptCode: 'UXUI', bucketCode: 'IN_PROGRESS', weight: 30 },
  { priority: 20, matchType: 'EXACT', pattern: 'Ready for Dev', deptCode: 'DEV', bucketCode: 'BACKLOG', weight: 35 },
  { priority: 20, matchType: 'EXACT', pattern: 'Dev-In Progress', deptCode: 'DEV', bucketCode: 'IN_PROGRESS', weight: 50 },
  { priority: 20, matchType: 'EXACT', pattern: 'Dev-Ready for Deploy', deptCode: 'DEV', bucketCode: 'DONE', weight: 65 },
  { priority: 20, matchType: 'EXACT', pattern: 'Ready for Test', deptCode: 'QA', bucketCode: 'BACKLOG', weight: 70 },
  { priority: 20, matchType: 'EXACT', pattern: 'Testing', deptCode: 'QA', bucketCode: 'IN_PROGRESS', weight: 75 },
  { priority: 20, matchType: 'EXACT', pattern: 'Ready for UAT', deptCode: 'QA', bucketCode: 'WAITING', weight: 80 },
  { priority: 20, matchType: 'EXACT', pattern: 'Staging UAT', deptCode: 'QA', bucketCode: 'WAITING', weight: 82 },
  { priority: 20, matchType: 'EXACT', pattern: 'UAT', deptCode: 'QA', bucketCode: 'DONE', weight: 88 },
  { priority: 20, matchType: 'EXACT', pattern: 'Ready for PROD', deptCode: 'QA', bucketCode: 'DONE', weight: 95 },
  { priority: 20, matchType: 'EXACT', pattern: 'PROD', deptCode: 'QA', bucketCode: 'DONE', weight: 100 },
  { priority: 20, matchType: 'EXACT', pattern: 'DONE', deptCode: 'QA', bucketCode: 'DONE', weight: 100 },
  { priority: 20, matchType: 'EXACT', pattern: 'Fail bug', deptCode: 'QA', bucketCode: 'DONE', weight: 60 },
  { priority: 999, matchType: 'FALLBACK', pattern: '*', deptCode: 'NONE', bucketCode: 'BACKLOG', weight: 0 },
];

// DATA-LAYER §8 — displayName = code, ข้าวไปแก้ชื่อจริงในหน้า Admin
const projects = [
  { projectCode: 'AUS_SILVER', larkTasklistGuid: '4e5f2452-c3d5-4d68-8d3f-1da9c0aa538d', displayName: 'AUS_SILVER', sortOrder: 1 },
  { projectCode: 'MYGOLD_BSEA', larkTasklistGuid: 'ae094be3-95d1-4195-9e93-4149d78097c0', displayName: 'MYGOLD_BSEA', sortOrder: 2 },
  { projectCode: 'LKN', larkTasklistGuid: '73d89c8c-d920-41e0-84fa-3febc83dcc33', displayName: 'LKN', sortOrder: 3 },
];

// Per-project section rules — section แต่ละบอร์ดตั้งชื่อคนละแบบ (blocked-on B1)
// dept = ข้าวยืนยัน 18 ก.ย. · bucket/weight = อนุมานจาก §5 stage (⚠️ = ยังรอข้าวเคาะ)
// priority 15 = มาก่อน global exact(20) · en-dash/emoji ใช้ CONTAINS กัน byte พลาด
const projectRules = {
  AUS_SILVER: [
    { matchType: 'EXACT', pattern: 'Dev - In Progress', deptCode: 'DEV', bucketCode: 'IN_PROGRESS', weight: 50 },
    { matchType: 'EXACT', pattern: 'Dev - Ready for Deploy', deptCode: 'DEV', bucketCode: 'DONE', weight: 65 },
    { matchType: 'EXACT', pattern: 'PM - Planning', deptCode: 'PM', bucketCode: 'IN_PROGRESS', weight: 10 },
    { matchType: 'EXACT', pattern: 'BA - Requirement & Analysis', deptCode: 'BA', bucketCode: 'IN_PROGRESS', weight: 20 },
  ],
  MYGOLD_BSEA: [
    { matchType: 'EXACT', pattern: 'Staging & UAT', deptCode: 'QA', bucketCode: 'WAITING', weight: 82 },
    { matchType: 'EXACT', pattern: 'waiting review', deptCode: 'PM', bucketCode: 'WAITING', weight: 10 }, // ⚠️ bucket/weight
    { matchType: 'CONTAINS', pattern: 'Rq check BA', deptCode: 'BA', bucketCode: 'DONE', weight: 25 }, // ⚠️ weight (en-dash)
    { matchType: 'CONTAINS', pattern: 'InProgress & Doing', deptCode: 'DEV', bucketCode: 'IN_PROGRESS', weight: 50 }, // emoji
    { matchType: 'EXACT', pattern: 'Failed & Bug', deptCode: 'DEV', bucketCode: 'IN_PROGRESS', weight: 50 }, // ⚠️ fail→dev แก้
    { matchType: 'EXACT', pattern: 'Cancel', deptCode: 'QA', bucketCode: 'DONE', weight: 100 }, // ⚠️ dept ข้าวไม่ระบุ + นับ progress?
    { matchType: 'EXACT', pattern: 'Test Success waiting production', deptCode: 'QA', bucketCode: 'DONE', weight: 95 }, // ⚠️⚠️ 144ใบ ข้าวยังไม่เคาะ dept/weight
  ],
  LKN: [
    { matchType: 'CONTAINS', pattern: 'Passed', deptCode: 'QA', bucketCode: 'DONE', weight: 95 }, // ⚠️⚠️ 200ใบ weight เดา (emoji ✅)
    { matchType: 'EXACT', pattern: 'TODO', deptCode: 'DEV', bucketCode: 'BACKLOG', weight: 35 },
    { matchType: 'EXACT', pattern: 'In Progress', deptCode: 'DEV', bucketCode: 'IN_PROGRESS', weight: 50 },
    { matchType: 'CONTAINS', pattern: 'Failed', deptCode: 'DEV', bucketCode: 'IN_PROGRESS', weight: 50 }, // ⚠️ (emoji 🔴)
    { matchType: 'EXACT', pattern: 'ข้อมูล', deptCode: 'PM', bucketCode: 'BACKLOG', weight: 10 }, // ⚠️ bucket/weight
  ],
  TCG_CL: [
    { matchType: 'EXACT', pattern: 'Pass', deptCode: 'QA', bucketCode: 'DONE', weight: 95 }, // ข้าวยืนยัน DONE (87 ใบ)
    { matchType: 'EXACT', pattern: 'Fail/Bug', deptCode: 'DEV', bucketCode: 'IN_PROGRESS', weight: 50 },
    { matchType: 'EXACT', pattern: 'Feedback - Customer', deptCode: 'PM', bucketCode: 'WAITING', weight: 10 },
    { matchType: 'EXACT', pattern: 'To Do', deptCode: 'DEV', bucketCode: 'BACKLOG', weight: 35 },
    { matchType: 'EXACT', pattern: 'In Progress', deptCode: 'DEV', bucketCode: 'IN_PROGRESS', weight: 50 },
  ],
  CPC_YSG: [
    { matchType: 'EXACT', pattern: 'BA-Requirement&Analysis', deptCode: 'BA', bucketCode: 'IN_PROGRESS', weight: 20 },
  ],
};

async function main() {
  // section rules — ล้าง global rules เดิม (projectId=null) แล้วใส่ใหม่ ไม่แตะ override รายโปรเจกต์
  await prisma.sectionRule.deleteMany({ where: { projectId: null } });
  for (const r of rules) {
    await prisma.sectionRule.create({ data: { ...r, projectId: null, isActive: true } });
  }
  console.log(`[seed] section_rule: ${rules.length} rows`);

  for (const p of projects) {
    await prisma.project.upsert({
      where: { projectCode: p.projectCode },
      create: p,
      update: { larkTasklistGuid: p.larkTasklistGuid, sortOrder: p.sortOrder },
    });
  }
  console.log(`[seed] project: ${projects.length} rows`);

  // per-project section rules (B1) — reset ของเดิมก่อน กันซ้ำ
  await prisma.sectionRule.deleteMany({ where: { projectId: { not: null } } });
  let pr = 0;
  for (const [code, list] of Object.entries(projectRules)) {
    const proj = await prisma.project.findUnique({ where: { projectCode: code } });
    if (!proj) continue; // project ยังไม่มี (เพิ่มผ่าน Admin ทีหลัง) → ข้าม rule ไปก่อน
    for (const r of list) {
      await prisma.sectionRule.create({
        data: { ...r, priority: 15, projectId: proj.id, isActive: true },
      });
      pr += 1;
    }
  }
  console.log(`[seed] project section_rule: ${pr} rows`);

  // dev admin (dev auth ใช้)
  await prisma.appUser.upsert({
    where: { email: 'dev@local' },
    create: { email: 'dev@local', displayName: 'Dev Admin', role: 'ADMIN' },
    update: {},
  });
  console.log('[seed] dev admin ok');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
