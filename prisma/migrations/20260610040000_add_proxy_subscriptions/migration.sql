CREATE TABLE "proxy_subscriptions" (
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(128) NOT NULL,
    "url" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "update_interval_min" INTEGER NOT NULL DEFAULT 360,
    "last_sync_at" TIMESTAMP(3),
    "last_sync_status" VARCHAR(16) NOT NULL DEFAULT 'NEVER',
    "last_sync_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "proxy_subscriptions_pkey" PRIMARY KEY ("uuid")
);

CREATE UNIQUE INDEX "proxy_subscriptions_name_key" ON "proxy_subscriptions"("name");

ALTER TABLE "proxy_outbounds"
ADD COLUMN "subscription_uuid" UUID,
ADD COLUMN "source_key" VARCHAR(128);

CREATE UNIQUE INDEX "proxy_outbounds_subscription_uuid_source_key_key"
ON "proxy_outbounds"("subscription_uuid", "source_key");

CREATE INDEX "proxy_outbounds_subscription_uuid_idx"
ON "proxy_outbounds"("subscription_uuid");

ALTER TABLE "proxy_outbounds"
ADD CONSTRAINT "proxy_outbounds_subscription_uuid_fkey"
FOREIGN KEY ("subscription_uuid") REFERENCES "proxy_subscriptions"("uuid")
ON DELETE CASCADE ON UPDATE CASCADE;
