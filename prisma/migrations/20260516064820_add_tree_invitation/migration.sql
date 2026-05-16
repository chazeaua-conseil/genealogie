-- CreateTable
CREATE TABLE "TreeInvitation" (
    "id" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "TreeRole" NOT NULL DEFAULT 'EDITOR',
    "invitedById" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TreeInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TreeInvitation_email_idx" ON "TreeInvitation"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TreeInvitation_treeId_email_key" ON "TreeInvitation"("treeId", "email");

-- AddForeignKey
ALTER TABLE "TreeInvitation" ADD CONSTRAINT "TreeInvitation_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "Tree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreeInvitation" ADD CONSTRAINT "TreeInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
