-- X (Twitter) listener: watched keywords + surfaced tweet leads.
CREATE TABLE "TweetKeyword" (
  "id" TEXT NOT NULL,
  "query" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TweetKeyword_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TweetKeyword_query_key" ON "TweetKeyword"("query");

CREATE TABLE "TweetLead" (
  "id" TEXT NOT NULL,
  "tweetId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "lang" TEXT,
  "authorId" TEXT,
  "authorHandle" TEXT,
  "authorName" TEXT,
  "authorAvatar" TEXT,
  "likeCount" INTEGER NOT NULL DEFAULT 0,
  "replyCount" INTEGER NOT NULL DEFAULT 0,
  "postedAt" TIMESTAMP(3),
  "matchedQuery" TEXT,
  "relevance" TEXT NOT NULL DEFAULT 'unknown',
  "aiScore" INTEGER,
  "aiReason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'new',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TweetLead_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TweetLead_tweetId_key" ON "TweetLead"("tweetId");
CREATE INDEX "TweetLead_status_idx" ON "TweetLead"("status");
CREATE INDEX "TweetLead_relevance_idx" ON "TweetLead"("relevance");
CREATE INDEX "TweetLead_createdAt_idx" ON "TweetLead"("createdAt");
