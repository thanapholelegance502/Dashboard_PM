// ETL orchestration — DATA-LAYER §5
import { prisma } from '../db/prisma.js';
import { ensureAccessToken, ReauthorizeRequired } from '../lark/auth.js';
import { extractProject } from './extract.js';
import { transformTask } from './transform.js';
import { loadTasks } from './load.js';
import { collectOpenIds, resolveNewMembers } from './members.js';
import { recomputeMetricsAndAttention } from './postprocess.js';

let running = false; // in-process guard กันกดซ้อน (ร่วมกับ DB RUNNING check)

/**
 * @param {object} opts { trigger: 'CRON'|'MANUAL' }
 * @returns {Promise<{syncRunId:number, status:string, ...}>}
 */
export async function runSync({ trigger = 'MANUAL' } = {}) {
  // lock: กัน cron กับปุ่ม Run now ชนกัน
  if (running) {
    throw new Error('sync กำลังทำงานอยู่ (in-process lock)');
  }
  const active = await prisma.syncRun.findFirst({ where: { status: 'RUNNING' } });
  if (active) {
    throw new Error(`sync กำลังทำงานอยู่ (SyncRun #${active.id})`);
  }
  running = true;

  const run = await prisma.syncRun.create({ data: { status: 'RUNNING', trigger } });
  const runStartedAt = run.startedAt;
  let tasksFetched = 0;
  let pagesFetched = 0;
  let projectsOk = 0;
  let projectsFail = 0;
  let needReauthorize = false;
  const errors = [];

  try {
    // load section rules ครั้งเดียว (global + project override)
    const rules = await prisma.sectionRule.findMany();

    // ensure token — ถ้า reauthorize ต้องหยุดทั้ง run
    try {
      await ensureAccessToken();
    } catch (err) {
      if (err instanceof ReauthorizeRequired) {
        needReauthorize = true;
        throw err;
      }
      throw err;
    }

    const projects = await prisma.project.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    const allOpenIds = new Set();

    // ยิงทีละโปรเจกต์ (sequential — DATA-LAYER §4)
    for (const project of projects) {
      try {
        const { sectionMap, tasks, pages } = await extractProject(project.larkTasklistGuid);
        pagesFetched += pages;
        tasksFetched += tasks.length;

        const records = tasks.map((raw) =>
          transformTask(raw, { projectId: project.id, rules })
        );
        await loadTasks(project.id, records, runStartedAt);
        for (const id of collectOpenIds(records)) allOpenIds.add(id);
        projectsOk += 1;
      } catch (err) {
        if (err instanceof ReauthorizeRequired) {
          needReauthorize = true;
          throw err; // token พัง = หยุดทั้ง run ไม่มีประโยชน์ยิงต่อ
        }
        // timeout/5xx/403 ของโปรเจกต์เดียว → ข้าม mark PARTIAL (ห้ามลบข้อมูลเก่า)
        projectsFail += 1;
        errors.push(`[${project.projectCode}] ${err.message}`);
        console.error(`[sync] project ${project.projectCode} ล้มเหลว:`, err.message);
      }
    }

    // resolve member ใหม่
    try {
      await resolveNewMembers([...allOpenIds]);
    } catch (err) {
      errors.push(`resolveNewMembers: ${err.message}`);
    }

    // step 6-7: recompute metrics (clear expired override) + auto attention (02-PM §4-5, §7)
    try {
      await recomputeMetricsAndAttention();
    } catch (err) {
      errors.push(`recomputeMetricsAndAttention: ${err.message}`);
    }

    const status = projectsFail === 0 ? 'SUCCESS' : projectsOk === 0 ? 'FAILED' : 'PARTIAL';
    const updated = await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status,
        tasksFetched,
        pagesFetched,
        projectsOk,
        projectsFail,
        errorText: errors.length ? errors.join('\n') : null,
      },
    });
    return { syncRunId: run.id, ...updated };
  } catch (err) {
    await prisma.syncRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status: 'FAILED',
        tasksFetched,
        pagesFetched,
        projectsOk,
        projectsFail,
        errorText: `${needReauthorize ? '[REAUTHORIZE_REQUIRED] ' : ''}${err.message}`,
      },
    });
    throw err;
  } finally {
    running = false;
  }
}
