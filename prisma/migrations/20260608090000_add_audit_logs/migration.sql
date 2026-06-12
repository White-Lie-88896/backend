CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_type" VARCHAR(32) NOT NULL,
    "actor_id" UUID,
    "actor_name" VARCHAR(128),
    "action" VARCHAR(128) NOT NULL,
    "resource_type" VARCHAR(64),
    "resource_id" UUID,
    "ip" VARCHAR(64),
    "user_agent" TEXT,
    "result" VARCHAR(32) NOT NULL,
    "message" TEXT,
    "metadata" JSONB,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" DESC);
CREATE INDEX "audit_logs_actor_type_created_at_idx" ON "audit_logs"("actor_type", "created_at" DESC);
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at" DESC);
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");
CREATE INDEX "audit_logs_result_created_at_idx" ON "audit_logs"("result", "created_at" DESC);
