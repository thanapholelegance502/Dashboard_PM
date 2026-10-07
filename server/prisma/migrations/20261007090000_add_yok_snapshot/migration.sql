-- ผลกวาด Google Sheet ของบอร์ด YOK (cron 09:00/17:00)
CREATE TABLE "YokSnapshot" (
    "id" SERIAL NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "errorText" TEXT,
    "payload" JSONB,
    "rowCounts" JSONB,
    "durationMs" INTEGER,

    CONSTRAINT "YokSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "YokSnapshot_fetchedAt_idx" ON "YokSnapshot"("fetchedAt");
CREATE INDEX "YokSnapshot_ok_fetchedAt_idx" ON "YokSnapshot"("ok", "fetchedAt");
