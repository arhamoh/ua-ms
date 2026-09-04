-- Remember each client's and project's Google Drive folder.
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "driveFolderId" TEXT;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "driveFolderId" TEXT;
