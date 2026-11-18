-- โน้ตรายสัปดาห์ (บอร์ด KHAW) — 1 แถวต่อ ISO week · ไปอยู่หน้า 1 ของ PDF
CREATE TABLE "WeeklyNote" (
    "weekKey" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "issues" TEXT NOT NULL DEFAULT '',
    "outOfScope" TEXT NOT NULL DEFAULT '',
    "updatedBy" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyNote_pkey" PRIMARY KEY ("weekKey")
);

-- PDF ที่ปิดสัปดาห์แล้ว — ดึงย้อนหลังได้ตรงตัว · เก็บเสมอทุกศุกร์ (ไม่ผูกกับการส่งเมล)
CREATE TABLE "WeeklyReportArchive" (
    "weekKey" TEXT NOT NULL,
    "pdf" BYTEA NOT NULL,
    "dataAsOf" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyReportArchive_pkey" PRIMARY KEY ("weekKey")
);
