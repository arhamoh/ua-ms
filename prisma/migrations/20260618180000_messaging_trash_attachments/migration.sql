-- Soft-delete (recently deleted) + message attachments
ALTER TABLE "ConversationMember" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN "attachmentUrl" TEXT;
ALTER TABLE "Message" ADD COLUMN "attachmentName" TEXT;
ALTER TABLE "Message" ADD COLUMN "attachmentType" TEXT;
