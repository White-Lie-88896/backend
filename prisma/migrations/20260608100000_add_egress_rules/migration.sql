-- CreateTable
CREATE TABLE "egress_rules" (
    "uuid" UUID NOT NULL DEFAULT gen_random_uuid(),
    "view_position" SERIAL NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "description" TEXT,
    "pattern" TEXT NOT NULL,
    "action" VARCHAR(32) NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "egress_rules_pkey" PRIMARY KEY ("uuid")
);
