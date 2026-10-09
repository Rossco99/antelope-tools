drop index if exists "public"."cpu_created_at_idx";
alter table "public"."cpu" drop constraint if exists "cpu_transaction_id_key";
alter table "public"."cpu" drop column if exists "transaction_id";
