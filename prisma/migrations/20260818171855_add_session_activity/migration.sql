-- CreateTable
CREATE TABLE "SessionActivity" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "pingedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionActivity_userId_pingedAt_idx" ON "SessionActivity"("userId", "pingedAt");

-- CreateIndex
CREATE INDEX "SessionActivity_sessionId_idx" ON "SessionActivity"("sessionId");

-- AddForeignKey
ALTER TABLE "SessionActivity" ADD CONSTRAINT "SessionActivity_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionActivity" ADD CONSTRAINT "SessionActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
