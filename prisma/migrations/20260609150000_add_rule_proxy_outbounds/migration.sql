CREATE TABLE "proxy_outbounds" (
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(128) NOT NULL,
    "description" TEXT,
    "config" JSONB NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "proxy_outbounds_pkey" PRIMARY KEY ("uuid")
);

CREATE UNIQUE INDEX "proxy_outbounds_name_key" ON "proxy_outbounds"("name");

ALTER TABLE "egress_rules"
ADD COLUMN "proxy_outbound_uuid" UUID;

CREATE INDEX "egress_rules_proxy_outbound_uuid_idx"
ON "egress_rules"("proxy_outbound_uuid");

ALTER TABLE "egress_rules"
ADD CONSTRAINT "egress_rules_proxy_outbound_uuid_fkey"
FOREIGN KEY ("proxy_outbound_uuid")
REFERENCES "proxy_outbounds"("uuid")
ON DELETE SET NULL
ON UPDATE CASCADE;

UPDATE "egress_rules"
SET "action" = 'DIRECT'
WHERE "action" = 'ALLOW';
