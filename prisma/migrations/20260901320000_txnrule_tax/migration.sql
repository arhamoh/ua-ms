-- Learn the tax treatment (none | gst | both) chosen for a recurring
-- transaction, so future imports pre-fill it.
ALTER TABLE "TxnRule" ADD COLUMN "tax" TEXT;
