-- In-platform comments on Drive files.
CREATE TABLE "DriveFileComment" (
    "id" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriveFileComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DriveFileComment_fileId_createdAt_idx" ON "DriveFileComment"("fileId", "createdAt");

ALTER TABLE "DriveFileComment" ADD CONSTRAINT "DriveFileComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
