#!/bin/sh
set -e

while true; do
  hour=$(date +%H)
  minute=$(date +%M)
  now_min=$((hour * 60 + minute))
  target=$((8 * 60))
  if [ "$now_min" -lt "$target" ]; then
    sleep_sec=$(((target - now_min) * 60))
  else
    sleep_sec=$((((24 * 60 - now_min) + target) * 60))
  fi
  sleep "$sleep_sec"
  python -m app.scripts.run_billing || true
done
