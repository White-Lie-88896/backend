ALTER TABLE "egress_rule_traffic_stats"
ADD COLUMN "hit_count" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN "last_hit_at" TIMESTAMP(3);

CREATE TABLE "proxy_access_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
    "node_uuid" UUID,
    "node_name" VARCHAR(128),
    "user_id" BIGINT,
    "user_uuid" UUID,
    "username" VARCHAR(128),
    "target_host" VARCHAR(255) NOT NULL,
    "target_ip" VARCHAR(64),
    "target_port" INTEGER,
    "protocol" VARCHAR(32),
    "network" VARCHAR(16),
    "inbound_tag" VARCHAR(128),
    "outbound_tag" VARCHAR(128),
    "rule_uuid" UUID,
    "rule_name" VARCHAR(128),
    "rule_action" VARCHAR(32),
    "uplink_bytes" BIGINT NOT NULL DEFAULT 0,
    "downlink_bytes" BIGINT NOT NULL DEFAULT 0,
    "total_bytes" BIGINT NOT NULL DEFAULT 0,
    "session_id" VARCHAR(128),
    "metadata" JSONB,

    CONSTRAINT "proxy_access_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "proxy_access_logs_occurred_at_idx"
ON "proxy_access_logs"("occurred_at" DESC);

CREATE INDEX "proxy_access_logs_user_id_occurred_at_idx"
ON "proxy_access_logs"("user_id", "occurred_at" DESC);

CREATE INDEX "proxy_access_logs_user_uuid_occurred_at_idx"
ON "proxy_access_logs"("user_uuid", "occurred_at" DESC);

CREATE INDEX "proxy_access_logs_node_uuid_occurred_at_idx"
ON "proxy_access_logs"("node_uuid", "occurred_at" DESC);

CREATE INDEX "proxy_access_logs_target_host_occurred_at_idx"
ON "proxy_access_logs"("target_host", "occurred_at" DESC);

CREATE INDEX "proxy_access_logs_rule_uuid_occurred_at_idx"
ON "proxy_access_logs"("rule_uuid", "occurred_at" DESC);

CREATE INDEX "proxy_access_logs_target_port_occurred_at_idx"
ON "proxy_access_logs"("target_port", "occurred_at" DESC);

CREATE TABLE "proxy_access_audit_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "retention_days" INTEGER NOT NULL DEFAULT 30,
    "hide_usernames" BOOLEAN NOT NULL DEFAULT false,
    "aggregate_only" BOOLEAN NOT NULL DEFAULT false,
    "distinct_domain_window_minutes" INTEGER NOT NULL DEFAULT 10,
    "distinct_domain_threshold" INTEGER NOT NULL DEFAULT 50,
    "high_risk_ports" INTEGER[] NOT NULL DEFAULT ARRAY[22, 23, 25, 465, 587, 3389, 5900, 6379, 9200, 11211]::INTEGER[],
    "node_spike_multiplier" INTEGER NOT NULL DEFAULT 3,
    "node_spike_min_bytes" BIGINT NOT NULL DEFAULT 1073741824,
    "blacklisted_hosts" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "blacklisted_ips" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT now(),

    CONSTRAINT "proxy_access_audit_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "proxy_access_audit_settings" ("id")
VALUES (1)
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE "proxy_access_alerts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT now(),
    "type" VARCHAR(64) NOT NULL,
    "severity" VARCHAR(16) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    "message" TEXT NOT NULL,
    "user_id" BIGINT,
    "user_uuid" UUID,
    "username" VARCHAR(128),
    "node_uuid" UUID,
    "node_name" VARCHAR(128),
    "target_host" VARCHAR(255),
    "target_ip" VARCHAR(64),
    "target_port" INTEGER,
    "metadata" JSONB,

    CONSTRAINT "proxy_access_alerts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "proxy_access_alerts_status_created_at_idx"
ON "proxy_access_alerts"("status", "created_at" DESC);

CREATE INDEX "proxy_access_alerts_type_created_at_idx"
ON "proxy_access_alerts"("type", "created_at" DESC);

CREATE INDEX "proxy_access_alerts_severity_created_at_idx"
ON "proxy_access_alerts"("severity", "created_at" DESC);

CREATE INDEX "proxy_access_alerts_user_id_created_at_idx"
ON "proxy_access_alerts"("user_id", "created_at" DESC);

CREATE INDEX "proxy_access_alerts_node_uuid_created_at_idx"
ON "proxy_access_alerts"("node_uuid", "created_at" DESC);
