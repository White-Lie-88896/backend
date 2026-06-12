ALTER TABLE "infra_billing_nodes"
ADD COLUMN "billing_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "billing_cycle" VARCHAR(16) NOT NULL DEFAULT 'MONTHLY';

ALTER TABLE "infra_billing_nodes"
ADD CONSTRAINT "infra_billing_nodes_billing_cycle_check"
CHECK ("billing_cycle" IN ('MONTHLY', 'YEARLY'));
