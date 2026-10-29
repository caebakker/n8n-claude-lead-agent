#!/usr/bin/env bash
# Imports both workflows into the running n8n container, publishes the lead agent,
# and restarts n8n so the production webhook is registered.
# Run from anywhere after: docker compose up -d

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

docker compose exec -T n8n n8n import:workflow --input=/workflows/lead-agent.json
docker compose exec -T n8n n8n import:workflow --input=/workflows/error-handler.json

mapfile -t lead_ids < <(docker compose exec -T n8n n8n list:workflow | sed 's/\r$//' | awk -F'|' '$2=="Lead enrichment and qualification" { print $1 }')

if [[ ${#lead_ids[@]} -eq 0 ]]; then
  echo "Could not find the lead agent after import." >&2
  exit 1
fi

last_index=$((${#lead_ids[@]} - 1))
for i in "${!lead_ids[@]}"; do
  if [[ "$i" -ne "$last_index" ]]; then
    docker compose exec -T n8n n8n unpublish:workflow --id="${lead_ids[$i]}" || true
  fi
done

echo "Publishing ${lead_ids[$last_index]}"
docker compose exec -T n8n n8n publish:workflow --id="${lead_ids[$last_index]}"
echo "Restarting n8n so the webhook registers."
docker compose restart n8n >/dev/null

for _ in $(seq 1 30); do
  code="$(curl --silent --max-time 5 -o /tmp/lead-agent-probe.json -w '%{http_code}' \
    --header 'content-type: application/json' \
    --data '{"company":"probe"}' \
    http://localhost:5678/webhook/lead-agent || true)"
  if [[ "$code" == "400" ]] && grep -q validation_failed /tmp/lead-agent-probe.json; then
    echo "n8n is up. Webhook: http://localhost:5678/webhook/lead-agent"
    exit 0
  fi
  sleep 2
done

echo "n8n did not become ready in time." >&2
exit 1
