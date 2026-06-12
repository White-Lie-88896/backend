ALTER TABLE "proxy_subscriptions"
ADD COLUMN "distribution_mode" VARCHAR(16) NOT NULL DEFAULT 'NONE',
ADD COLUMN "target_user_ids" JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN "target_squad_uuids" JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "proxy_subscriptions"
ADD CONSTRAINT "proxy_subscriptions_distribution_mode_check"
CHECK ("distribution_mode" IN ('NONE', 'ALL', 'SELECTED'));
