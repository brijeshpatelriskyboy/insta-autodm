-- Scope keyword rules to a specific Instagram media ID (or global).
-- mediaScopeKey is always non-null so uniqueness works for global + per-post rules.

ALTER TABLE "keyword_rules" ADD COLUMN "instagramMediaId" TEXT;
ALTER TABLE "keyword_rules" ADD COLUMN "mediaScopeKey" TEXT NOT NULL DEFAULT '__GLOBAL__';
ALTER TABLE "keyword_rules" ADD COLUMN "mediaType" TEXT;
ALTER TABLE "keyword_rules" ADD COLUMN "mediaThumbnailUrl" TEXT;
ALTER TABLE "keyword_rules" ADD COLUMN "mediaCaption" TEXT;
ALTER TABLE "keyword_rules" ADD COLUMN "mediaPermalink" TEXT;

-- Existing rules become global.
UPDATE "keyword_rules" SET "mediaScopeKey" = '__GLOBAL__' WHERE "mediaScopeKey" IS NULL OR "mediaScopeKey" = '';

-- Replace old unique (userId, keyword) with (userId, keyword, mediaScopeKey).
DROP INDEX IF EXISTS "keyword_rules_userId_keyword_key";
CREATE UNIQUE INDEX "keyword_rules_userId_keyword_mediaScopeKey_key"
  ON "keyword_rules"("userId", "keyword", "mediaScopeKey");

CREATE INDEX "keyword_rules_userId_keyword_idx" ON "keyword_rules"("userId", "keyword");
