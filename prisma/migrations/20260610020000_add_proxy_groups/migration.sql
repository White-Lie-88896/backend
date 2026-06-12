CREATE TABLE "proxy_groups" (
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(128) NOT NULL,
    "description" TEXT,
    "mode" VARCHAR(16) NOT NULL DEFAULT 'FAILOVER',
    "outbound_uuids" JSONB NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "proxy_groups_pkey" PRIMARY KEY ("uuid")
);

CREATE UNIQUE INDEX "proxy_groups_name_key" ON "proxy_groups"("name");

ALTER TABLE "egress_rules" ADD COLUMN "proxy_group_uuid" UUID;
CREATE INDEX "egress_rules_proxy_group_uuid_idx" ON "egress_rules"("proxy_group_uuid");
ALTER TABLE "egress_rules"
ADD CONSTRAINT "egress_rules_proxy_group_uuid_fkey"
FOREIGN KEY ("proxy_group_uuid") REFERENCES "proxy_groups"("uuid")
ON DELETE SET NULL ON UPDATE CASCADE;
