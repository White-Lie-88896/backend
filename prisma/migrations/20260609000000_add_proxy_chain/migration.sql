-- AlterTable: add proxy_chain_config column to nodes
ALTER TABLE "nodes" ADD COLUMN "proxy_chain_config" JSONB;
