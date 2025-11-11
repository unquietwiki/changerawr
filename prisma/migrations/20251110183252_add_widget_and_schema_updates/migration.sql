-- CreateTable
CREATE TABLE IF NOT EXISTS "Widget" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "customCSS" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Widget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Widget_projectId_idx" ON "Widget"("projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Widget_projectId_isActive_idx" ON "Widget"("projectId", "isActive");

-- AddForeignKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Widget_projectId_fkey'
    ) THEN
        ALTER TABLE "Widget" ADD CONSTRAINT "Widget_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Add excerpt column to ChangelogEntry if not exists
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ChangelogEntry' AND column_name = 'excerpt'
    ) THEN
        ALTER TABLE "ChangelogEntry" ADD COLUMN "excerpt" TEXT;
    END IF;
END $$;

-- Add metadata column to ChangelogRequest if not exists
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ChangelogRequest' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE "ChangelogRequest" ADD COLUMN "metadata" JSONB;
    END IF;
END $$;

-- Add adminOnlyApiKeyCreation column to SystemConfig if not exists
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'SystemConfig' AND column_name = 'adminOnlyApiKeyCreation'
    ) THEN
        ALTER TABLE "SystemConfig" ADD COLUMN "adminOnlyApiKeyCreation" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- Add ApiKey columns if not exist
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ApiKey' AND column_name = 'isGlobal'
    ) THEN
        ALTER TABLE "ApiKey" ADD COLUMN "isGlobal" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ApiKey' AND column_name = 'projectId'
    ) THEN
        ALTER TABLE "ApiKey" ADD COLUMN "projectId" TEXT;
    END IF;
END $$;

-- CreateIndex for ApiKey projectId
CREATE INDEX IF NOT EXISTS "ApiKey_projectId_idx" ON "ApiKey"("projectId");

-- AddForeignKey for ApiKey
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ApiKey_projectId_fkey'
    ) THEN
        ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
