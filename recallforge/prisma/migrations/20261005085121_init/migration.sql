-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('FREE', 'PRO');

-- CreateEnum
CREATE TYPE "AuthTokenType" AS ENUM ('EMAIL_VERIFY', 'PASSWORD_RESET');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'EXTRACTING', 'ANALYZING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "DeckStatus" AS ENUM ('GENERATING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "CardState" AS ENUM ('NEW', 'LEARNING', 'REVIEW', 'RELEARNING');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "googleId" TEXT,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "plan" "Plan" NOT NULL DEFAULT 'FREE',
    "subscriptionStatus" TEXT,
    "stripeCustomerId" TEXT,
    "onboardedAt" TIMESTAMP(3),
    "studyContext" TEXT,
    "primaryGoal" TEXT,
    "examDate" TIMESTAMP(3),
    "dailyReviewGoal" INTEGER NOT NULL DEFAULT 50,
    "targetRetention" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "defaultDeckSize" INTEGER NOT NULL DEFAULT 40,
    "defaultDifficulty" TEXT NOT NULL DEFAULT 'intermediate',
    "preferredStudyTime" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "emailReminders" BOOLEAN NOT NULL DEFAULT false,
    "notificationPrefs" JSONB NOT NULL DEFAULT '{"due":true,"mastery":true,"inactive":true,"exam":true}',
    "reducedMotion" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AuthTokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key","windowStart")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storageKey" TEXT,
    "fileType" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "pageCount" INTEGER,
    "wordCount" INTEGER,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "stage" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "errorReason" TEXT,
    "subject" TEXT,
    "course" TEXT,
    "analysis" JSONB,
    "extractionWarnings" JSONB,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "processingMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentSection" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "heading" TEXT,
    "path" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "text" TEXT NOT NULL,
    "pageOffsets" JSONB,
    "pageStart" INTEGER,
    "pageEnd" INTEGER,
    "tokenCount" INTEGER NOT NULL DEFAULT 0,
    "isReferences" BOOLEAN NOT NULL DEFAULT false,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Concept" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "sectionId" TEXT,
    "name" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "importance" INTEGER NOT NULL DEFAULT 50,
    "mentions" INTEGER NOT NULL DEFAULT 1,
    "related" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "examRelevant" BOOLEAN NOT NULL DEFAULT false,
    "pageStart" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Concept_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Folder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deck" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT,
    "folderId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "subject" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "difficulty" TEXT NOT NULL DEFAULT 'intermediate',
    "studyGoal" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "status" "DeckStatus" NOT NULL DEFAULT 'READY',
    "statusMessage" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 100,
    "generationSettings" JSONB,
    "generationReport" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastStudiedAt" TIMESTAMP(3),

    CONSTRAINT "Deck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conceptId" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "cardType" TEXT NOT NULL DEFAULT 'basic',
    "difficulty" TEXT NOT NULL DEFAULT 'intermediate',
    "topic" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "origin" TEXT NOT NULL DEFAULT 'ai',
    "sourceSectionId" TEXT,
    "sourceQuote" TEXT,
    "sourcePage" INTEGER,
    "sourceHeading" TEXT,
    "confidence" DOUBLE PRECISION,
    "confidenceLabel" TEXT,
    "needsVerification" BOOLEAN NOT NULL DEFAULT false,
    "importance" INTEGER NOT NULL DEFAULT 50,
    "suspended" BOOLEAN NOT NULL DEFAULT false,
    "embedding" vector(1536),
    "state" "CardState" NOT NULL DEFAULT 'NEW',
    "due" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "srsDifficulty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "elapsedDays" INTEGER NOT NULL DEFAULT 0,
    "scheduledDays" INTEGER NOT NULL DEFAULT 0,
    "learningSteps" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "lastReview" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardReview" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT,
    "rating" INTEGER NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationMs" INTEGER,
    "prevState" "CardState" NOT NULL,
    "state" "CardState" NOT NULL,
    "scheduledDays" INTEGER NOT NULL,
    "scheduledMins" INTEGER NOT NULL DEFAULT 0,
    "stability" DOUBLE PRECISION NOT NULL,
    "difficulty" DOUBLE PRECISION NOT NULL,
    "retrievability" DOUBLE PRECISION,
    "nextReview" TIMESTAMP(3) NOT NULL,
    "isSample" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CardReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudySession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deckId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'study',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "cardsReviewed" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,
    "accuracy" DOUBLE PRECISION,
    "isSample" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'written',
    "questionType" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "modelAnswer" TEXT NOT NULL,
    "keyPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceSectionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "userAnswer" TEXT,
    "scores" JSONB,
    "total" DOUBLE PRECISION,
    "feedback" JSONB,
    "followUp" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "ExamAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TutorMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deckId" TEXT,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "citations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'stripe',
    "providerSubscriptionId" TEXT NOT NULL,
    "priceId" TEXT,
    "plan" "Plan" NOT NULL DEFAULT 'PRO',
    "interval" TEXT,
    "status" TEXT NOT NULL,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "documents" INTEGER NOT NULL DEFAULT 0,
    "pages" INTEGER NOT NULL DEFAULT 0,
    "cardsGenerated" INTEGER NOT NULL DEFAULT 0,
    "aiRequests" INTEGER NOT NULL DEFAULT 0,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "costMicros" INTEGER NOT NULL DEFAULT 0,
    "minutesSaved" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCall" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "purpose" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "costMicros" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastError" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "props" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthToken_tokenHash_key" ON "AuthToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthToken_userId_type_idx" ON "AuthToken"("userId", "type");

-- CreateIndex
CREATE INDEX "Document_userId_createdAt_idx" ON "Document"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentSection_documentId_order_idx" ON "DocumentSection"("documentId", "order");

-- CreateIndex
CREATE INDEX "Concept_documentId_importance_idx" ON "Concept"("documentId", "importance");

-- CreateIndex
CREATE INDEX "Concept_documentId_normalized_idx" ON "Concept"("documentId", "normalized");

-- CreateIndex
CREATE INDEX "Folder_userId_idx" ON "Folder"("userId");

-- CreateIndex
CREATE INDEX "Deck_userId_archived_idx" ON "Deck"("userId", "archived");

-- CreateIndex
CREATE INDEX "Card_userId_due_idx" ON "Card"("userId", "due");

-- CreateIndex
CREATE INDEX "Card_deckId_due_idx" ON "Card"("deckId", "due");

-- CreateIndex
CREATE INDEX "Card_deckId_state_idx" ON "Card"("deckId", "state");

-- CreateIndex
CREATE INDEX "CardReview_userId_reviewedAt_idx" ON "CardReview"("userId", "reviewedAt");

-- CreateIndex
CREATE INDEX "CardReview_cardId_reviewedAt_idx" ON "CardReview"("cardId", "reviewedAt");

-- CreateIndex
CREATE INDEX "StudySession_userId_startedAt_idx" ON "StudySession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "ExamAttempt_userId_deckId_createdAt_idx" ON "ExamAttempt"("userId", "deckId", "createdAt");

-- CreateIndex
CREATE INDEX "TutorMessage_userId_threadId_createdAt_idx" ON "TutorMessage"("userId", "threadId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_providerSubscriptionId_key" ON "Subscription"("providerSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Usage_userId_periodStart_key" ON "Usage"("userId", "periodStart");

-- CreateIndex
CREATE INDEX "AiCall_createdAt_idx" ON "AiCall"("createdAt");

-- CreateIndex
CREATE INDEX "AiCall_userId_createdAt_idx" ON "AiCall"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Job_status_runAt_idx" ON "Job"("status", "runAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key" ON "Notification"("userId", "dedupeKey");

-- CreateIndex
CREATE INDEX "ProductEvent_name_createdAt_idx" ON "ProductEvent"("name", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthToken" ADD CONSTRAINT "AuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentSection" ADD CONSTRAINT "DocumentSection_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Concept" ADD CONSTRAINT "Concept_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Concept" ADD CONSTRAINT "Concept_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "DocumentSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deck" ADD CONSTRAINT "Deck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deck" ADD CONSTRAINT "Deck_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deck" ADD CONSTRAINT "Deck_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "Concept"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_sourceSectionId_fkey" FOREIGN KEY ("sourceSectionId") REFERENCES "DocumentSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardReview" ADD CONSTRAINT "CardReview_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardReview" ADD CONSTRAINT "CardReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardReview" ADD CONSTRAINT "CardReview_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamAttempt" ADD CONSTRAINT "ExamAttempt_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TutorMessage" ADD CONSTRAINT "TutorMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usage" ADD CONSTRAINT "Usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCall" ADD CONSTRAINT "AiCall_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Vector similarity indexes (cosine) for RAG retrieval and semantic deduplication.
CREATE INDEX "DocumentSection_embedding_idx" ON "DocumentSection" USING hnsw ("embedding" vector_cosine_ops);
CREATE INDEX "Card_embedding_idx" ON "Card" USING hnsw ("embedding" vector_cosine_ops);

-- Keyword search fallback.
CREATE INDEX "Card_fts_idx" ON "Card" USING gin (to_tsvector('simple', "question" || ' ' || "answer"));
CREATE INDEX "Concept_name_fts_idx" ON "Concept" USING gin (to_tsvector('simple', "name" || ' ' || "summary"));
