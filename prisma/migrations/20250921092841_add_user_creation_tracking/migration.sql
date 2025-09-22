-- AlterTable
ALTER TABLE "USER" ADD COLUMN     "created_by_method" TEXT NOT NULL DEFAULT 'self_signup',
ADD COLUMN     "created_by_user_id" TEXT;

-- CreateIndex
CREATE INDEX "idx_users_created_by_method" ON "USER"("created_by_method");

-- CreateIndex
CREATE INDEX "idx_users_created_by_user_id" ON "USER"("created_by_user_id");

-- AddForeignKey
ALTER TABLE "USER" ADD CONSTRAINT "USER_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "USER"("id") ON DELETE SET NULL ON UPDATE CASCADE;
