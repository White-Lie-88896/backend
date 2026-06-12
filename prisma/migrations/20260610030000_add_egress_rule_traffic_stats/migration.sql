CREATE TABLE "egress_rule_traffic_stats" (
    "rule_uuid" UUID NOT NULL,
    "node_uuid" UUID NOT NULL,
    "uplink_bytes" BIGINT NOT NULL DEFAULT 0,
    "downlink_bytes" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "egress_rule_traffic_stats_pkey" PRIMARY KEY ("rule_uuid", "node_uuid")
);

CREATE INDEX "egress_rule_traffic_stats_node_uuid_idx"
ON "egress_rule_traffic_stats"("node_uuid");

ALTER TABLE "egress_rule_traffic_stats"
ADD CONSTRAINT "egress_rule_traffic_stats_rule_uuid_fkey"
FOREIGN KEY ("rule_uuid") REFERENCES "egress_rules"("uuid")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "egress_rule_traffic_stats"
ADD CONSTRAINT "egress_rule_traffic_stats_node_uuid_fkey"
FOREIGN KEY ("node_uuid") REFERENCES "nodes"("uuid")
ON DELETE CASCADE ON UPDATE CASCADE;
