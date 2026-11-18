// จัดบอร์ดเข้ากลุ่ม (หัวเมนู + หน้าแรก) — ที่เดียวให้ sidebar กับ Landing ใช้ร่วม
// ‼️ กัน bug "เมนูหายช่วง deploy": web ใหม่ขึ้นก่อน server เก่า ~2 นาที → /auth/me ยังไม่ส่ง boardGroups
//    → ถ้า groups ว่าง ให้ fallback บอร์ดทั้งหมดไว้ใต้หัว "บอร์ด" (ไม่ปล่อยเมนูว่างเปล่า)
import type { BoardGroup, BoardInfo } from './types';

export const FALLBACK_GROUP_LABEL = 'บอร์ด';

export interface GroupedBoards {
  key: string;
  label: string;
  boards: BoardInfo[];
}

/**
 * boards = บอร์ดที่ผ่านเงื่อนไข visibility ของหน้านั้นมาแล้ว (แต่ละหน้า filter เอง)
 * คืนเฉพาะกลุ่มที่มีบอร์ด "จริง" (soon ไม่นับว่าทำให้กลุ่มมีของ — เหมือนพฤติกรรมเดิม)
 */
export function groupBoards(groups: BoardGroup[], boards: BoardInfo[]): GroupedBoards[] {
  const useFallback = !groups?.length;
  const gs: Array<{ key: string; label: string }> = useFallback
    ? [{ key: '__all__', label: FALLBACK_GROUP_LABEL }]
    : groups;
  return gs
    .map((g) => ({ ...g, boards: boards.filter((b) => useFallback || b.group === g.key) }))
    .filter((g) => g.boards.some((b) => b.kind !== 'soon'));
}
