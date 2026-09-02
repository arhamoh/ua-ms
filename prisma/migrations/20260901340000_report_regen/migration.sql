-- Let generated finance-report attachments be regenerated with live data:
-- the PDF+CSV pair share reportKey, reportSpec stores the report parameters.
ALTER TABLE "TaskAttachment" ADD COLUMN "reportKey" TEXT;
ALTER TABLE "TaskAttachment" ADD COLUMN "reportSpec" JSONB;
