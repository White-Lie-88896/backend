-- AlterTable: add target_users column to egress_rules
ALTER TABLE "egress_rules" ADD COLUMN "target_users" JSONB DEFAULT '[]'::jsonb;
