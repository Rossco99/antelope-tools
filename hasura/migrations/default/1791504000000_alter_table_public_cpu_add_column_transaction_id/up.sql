alter table "public"."cpu" add column "transaction_id" text null;
alter table "public"."cpu" add constraint "cpu_transaction_id_key" unique ("transaction_id");
create index "cpu_created_at_idx" on "public"."cpu" ("created_at");
