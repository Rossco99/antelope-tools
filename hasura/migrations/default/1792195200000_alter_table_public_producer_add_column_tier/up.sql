-- live position of a producer where the chain has one, e.g. WAX: active or standby
alter table "public"."producer" add column "tier" varchar null;
