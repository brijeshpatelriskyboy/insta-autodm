#!/bin/sh
set -eu

# Production was originally created before Prisma migration history was tracked.
# Reconcile only the legacy migrations; never baseline the current feature migration.
npx prisma migrate resolve --rolled-back 20260614033831_instagram_billing || true

for migration in \
  20260612111639_init \
  20260614033831_instagram_billing \
  20260615120000_phase2_instagram_account \
  20260617120000_ensure_instagram_tables \
  20260728120000_dm_event_private_reply \
  20260731120000_instagram_webhook_subscription \
  20260806120000_dm_event_status_skipped \
  20260806140000_dm_event_meta_error_fields \
  20260806150000_keyword_rule_media_scope \
  20260807140000_keyword_rule_media_timestamp \
  20260919193000_dm_event_duplicate_trigger_guard \
  20260919194500_auth_reset_and_consent \
  20260921103000_plan_usage_limits \
  20260922122500_repair_plan_usage_table
do
  npx prisma migrate resolve --applied "$migration" || true
done

npx prisma migrate deploy
