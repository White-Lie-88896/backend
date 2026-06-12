ALTER TABLE "proxy_outbounds"
ADD COLUMN "distribution_mode" VARCHAR(16) NOT NULL DEFAULT 'INHERIT',
ADD COLUMN "target_user_ids" JSONB NOT NULL DEFAULT '[]'::jsonb,
ADD COLUMN "target_squad_uuids" JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "proxy_outbounds"
ADD CONSTRAINT "proxy_outbounds_distribution_mode_check"
CHECK ("distribution_mode" IN ('INHERIT', 'NONE', 'ALL', 'SELECTED'));
