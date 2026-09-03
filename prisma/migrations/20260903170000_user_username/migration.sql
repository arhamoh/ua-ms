-- Optional login handle: sign in with username or email.
ALTER TABLE "User" ADD COLUMN "username" TEXT;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
