#!/usr/bin/env bash
# Posts the fictional sample leads to a local n8n webhook.
# Usage: ./scripts/curl-examples.sh
# Override the target with WEBHOOK_URL.

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
URL="${WEBHOOK_URL:-http://localhost:5678/webhook/lead-agent}"

echo "POST ${URL}"
first=1
for file in "$ROOT"/samples/leads/*.json; do
  echo
  echo "== $(basename "$file")"
  if [[ "$first" -eq 1 ]]; then
    curl --silent --show-error \
      --header 'content-type: application/json' \
      --header 'x-reset-store: true' \
      --data @"$file" \
      "$URL"
    first=0
  else
    curl --silent --show-error \
      --header 'content-type: application/json' \
      --data @"$file" \
      "$URL"
  fi
  echo
done
