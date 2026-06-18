-- Team login vault: shared credentials (passwords stored encrypted) + access grants
CREATE TABLE "Login" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "username" TEXT,
    "passwordEnc" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Login_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoginShare" (
    "id" TEXT NOT NULL,
    "loginId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginShare_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Login_createdById_idx" ON "Login"("createdById");
CREATE UNIQUE INDEX "LoginShare_loginId_userId_key" ON "LoginShare"("loginId", "userId");
CREATE INDEX "LoginShare_userId_idx" ON "LoginShare"("userId");

ALTER TABLE "Login" ADD CONSTRAINT "Login_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LoginShare" ADD CONSTRAINT "LoginShare_loginId_fkey" FOREIGN KEY ("loginId") REFERENCES "Login"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LoginShare" ADD CONSTRAINT "LoginShare_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
