ALTER TABLE "egress_rules"
ADD COLUMN "valid_from" TIMESTAMP(3),
ADD COLUMN "expires_at" TIMESTAMP(3);

CREATE INDEX "egress_rules_valid_from_expires_at_idx"
ON "egress_rules"("valid_from", "expires_at");

ALTER TABLE "proxy_outbounds"
ADD COLUMN "health_status" VARCHAR(16) NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "last_latency_ms" INTEGER,
ADD COLUMN "last_health_message" TEXT,
ADD COLUMN "last_health_check_at" TIMESTAMP(3);
