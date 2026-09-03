-- Store an AI-drafted reply per tweet lead (editable before sending).
ALTER TABLE "TweetLead" ADD COLUMN "draft" TEXT;
