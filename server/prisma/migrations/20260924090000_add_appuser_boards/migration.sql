-- AlterTable
ALTER TABLE "AppUser" ADD COLUMN "boards" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- คงสิทธิ์เดิม: ก่อนมีระบบบอร์ด ทุกคนที่ login ได้เห็น PM + การเงิน → ไม่ให้ใครหลุดหลัง deploy
-- (ADMIN เห็นทุกบอร์ดอยู่แล้วโดยไม่ดูค่านี้) · Admin ตัดสิทธิ์ทีหลังได้ในแท็บผู้ใช้
UPDATE "AppUser" SET "boards" = ARRAY['PM', 'CLEVEL']::TEXT[] WHERE "role" <> 'ADMIN';
