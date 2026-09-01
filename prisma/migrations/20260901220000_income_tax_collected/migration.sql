-- GST/QST collected, stored per income record (payments + other income).
ALTER TABLE "Payment" ADD COLUMN "gst" DOUBLE PRECISION;
ALTER TABLE "Payment" ADD COLUMN "qst" DOUBLE PRECISION;
ALTER TABLE "OtherIncome" ADD COLUMN "gst" DOUBLE PRECISION;
ALTER TABLE "OtherIncome" ADD COLUMN "qst" DOUBLE PRECISION;
