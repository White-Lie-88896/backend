ALTER TABLE "infra_billing_nodes"
    ADD COLUMN "billing_currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    ADD COLUMN "reminder_days" INTEGER[] NOT NULL DEFAULT ARRAY[7, 3, 0]::INTEGER[];

