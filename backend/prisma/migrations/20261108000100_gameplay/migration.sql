-- CreateTable
CREATE TABLE "PlayerProfile" (
    "userId" UUID NOT NULL,
    "outfit" TEXT NOT NULL DEFAULT 'ember',

    CONSTRAINT "PlayerProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "finishedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityPlayer" (
    "activityId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "acceptedAtMs" INTEGER[] NOT NULL,

    CONSTRAINT "ActivityPlayer_pkey" PRIMARY KEY ("activityId","userId")
);

-- CreateTable
CREATE TABLE "Reward" (
    "userId" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "xp" INTEGER NOT NULL,
    "crystals" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("userId","source")
);

-- CreateIndex
CREATE INDEX "ActivityPlayer_userId_idx" ON "ActivityPlayer"("userId");

-- AddForeignKey
ALTER TABLE "PlayerProfile" ADD CONSTRAINT "PlayerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityPlayer" ADD CONSTRAINT "ActivityPlayer_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityPlayer" ADD CONSTRAINT "ActivityPlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Activity" ADD CHECK ("kind" IN ('solo','battle') AND "finishedAt" >= "startedAt");
ALTER TABLE "ActivityPlayer" ADD CHECK ("score" >= 0 AND "score" = cardinality("acceptedAtMs") AND "outcome" IN ('solo','win','loss','draw'));
ALTER TABLE "Reward" ADD CHECK ("xp" >= 0 AND "crystals" >= 0);
ALTER TABLE "PlayerProfile" ADD CHECK ("outfit" IN ('ember','tide','violet'));
