// EXTRACT — ดึง sections + tasks ของ 1 tasklist (DATA-LAYER §5)
import { fetchSections, fetchAllTasks } from '../lark/tasks.js';

export async function extractProject(guid) {
  const sectionMap = await fetchSections(guid);
  const { tasks, pages } = await fetchAllTasks(sectionMap); // list ต่อ section
  return { sectionMap, tasks, pages };
}
