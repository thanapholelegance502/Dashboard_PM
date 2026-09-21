-- CreateTable
CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "projectCode" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "larkTasklistGuid" TEXT NOT NULL,
    "pmUserId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "targetUat" TIMESTAMP(3),
    "targetGolive" TIMESTAMP(3),
    "forecastUat" TIMESTAMP(3),
    "forecastGolive" TIMESTAMP(3),
    "actualUat" TIMESTAMP(3),
    "actualGolive" TIMESTAMP(3),
    "statusOverride" TEXT,
    "statusOverrideReason" TEXT,
    "statusOverrideBy" INTEGER,
    "statusOverrideAt" TIMESTAMP(3),
    "progressOverride" INTEGER,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SectionRule" (
    "id" SERIAL NOT NULL,
    "matchType" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "deptCode" TEXT NOT NULL,
    "bucketCode" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 20,
    "projectId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SectionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" SERIAL NOT NULL,
    "larkOpenId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "nickname" TEXT,
    "deptCode" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" SERIAL NOT NULL,
    "larkTaskGuid" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "sectionGuid" TEXT NOT NULL,
    "sectionName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "larkUrl" TEXT,
    "assigneeOpenIds" JSONB NOT NULL,
    "creatorOpenId" TEXT,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "larkCreatedAt" TIMESTAMP(3),
    "larkUpdatedAt" TIMESTAMP(3),
    "customFields" JSONB,
    "deptCode" TEXT NOT NULL,
    "bucketCode" TEXT NOT NULL,
    "sectionWeight" INTEGER NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskStateSnapshot" (
    "id" SERIAL NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "larkTaskGuid" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "deptCode" TEXT NOT NULL,
    "bucketCode" TEXT NOT NULL,
    "sectionName" TEXT NOT NULL,

    CONSTRAINT "TaskStateSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyAggregate" (
    "id" SERIAL NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "projectId" INTEGER NOT NULL,
    "deptCode" TEXT NOT NULL,
    "bucketCode" TEXT NOT NULL,
    "taskCount" INTEGER NOT NULL,
    "progressPct" INTEGER,

    CONSTRAINT "DailyAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttentionItem" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "impactText" TEXT NOT NULL,
    "neededBy" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "AttentionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" SERIAL NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "tasksFetched" INTEGER NOT NULL DEFAULT 0,
    "pagesFetched" INTEGER NOT NULL DEFAULT 0,
    "projectsOk" INTEGER NOT NULL DEFAULT 0,
    "projectsFail" INTEGER NOT NULL DEFAULT 0,
    "errorText" TEXT,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthToken" (
    "id" SERIAL NOT NULL,
    "provider" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppUser" (
    "id" SERIAL NOT NULL,
    "larkOpenId" TEXT,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "appUserId" INTEGER,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_projectCode_key" ON "Project"("projectCode");

-- CreateIndex
CREATE UNIQUE INDEX "Project_larkTasklistGuid_key" ON "Project"("larkTasklistGuid");

-- CreateIndex
CREATE UNIQUE INDEX "Member_larkOpenId_key" ON "Member"("larkOpenId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_larkTaskGuid_key" ON "Task"("larkTaskGuid");

-- CreateIndex
CREATE INDEX "Task_projectId_deptCode_bucketCode_idx" ON "Task"("projectId", "deptCode", "bucketCode");

-- CreateIndex
CREATE INDEX "TaskStateSnapshot_snapshotDate_projectId_deptCode_idx" ON "TaskStateSnapshot"("snapshotDate", "projectId", "deptCode");

-- CreateIndex
CREATE UNIQUE INDEX "TaskStateSnapshot_snapshotDate_larkTaskGuid_key" ON "TaskStateSnapshot"("snapshotDate", "larkTaskGuid");

-- CreateIndex
CREATE UNIQUE INDEX "DailyAggregate_snapshotDate_projectId_deptCode_bucketCode_key" ON "DailyAggregate"("snapshotDate", "projectId", "deptCode", "bucketCode");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthToken_provider_key" ON "OAuthToken"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_larkOpenId_key" ON "AppUser"("larkOpenId");

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_email_key" ON "AppUser"("email");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttentionItem" ADD CONSTRAINT "AttentionItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
