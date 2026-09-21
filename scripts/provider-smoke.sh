#!/usr/bin/env bash
set -euo pipefail

base="${PROVIDER_SMOKE_BASE:-http://127.0.0.1:3000}"
workspace="${PROVIDER_SMOKE_WORKSPACE:-provider-smoke-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}}"
header="X-Open-Lovable-Workspace: ${workspace}"

cleanup() {
  curl --silent --show-error     -X POST     -H "${header}"     "${base}/api/kill-sandbox"     >/tmp/provider-smoke-kill.json     2>/tmp/provider-smoke-kill.err || true
}
trap cleanup EXIT

curl --fail-with-body --silent --show-error   -X POST   -H "${header}"   "${base}/api/create-ai-sandbox-v2"   > /tmp/provider-smoke-create.json

python - <<'PY'
import json
from pathlib import Path
data=json.loads(Path('/tmp/provider-smoke-create.json').read_text())
assert data.get('success') is True, data
assert data.get('sandboxId'), data
assert data.get('url'), data
print('create: PASS')
PY

curl --fail-with-body --silent --show-error   -H "${header}"   "${base}/api/sandbox-status"   > /tmp/provider-smoke-status.json

python - <<'PY'
import json
from pathlib import Path
data=json.loads(Path('/tmp/provider-smoke-status.json').read_text())
assert data.get('success') is True, data
assert data.get('active') is True, data
assert data.get('healthy') is True, data
print('status: PASS')
PY

curl --fail-with-body --silent --show-error   -H "${header}"   "${base}/api/get-sandbox-files"   > /tmp/provider-smoke-files.json

python - <<'PY'
import json
from pathlib import Path
data=json.loads(Path('/tmp/provider-smoke-files.json').read_text())
assert data.get('success') is True, data
assert isinstance(data.get('files'), dict), data
print('files: PASS', data.get('fileCount'))
PY

curl --fail-with-body --silent --show-error   -X POST   -H "${header}"   -H 'Content-Type: application/json'   --data '{"command":"printf open-lovable-provider-smoke"}'   "${base}/api/run-command-v2"   > /tmp/provider-smoke-command.json

python - <<'PY'
import json
from pathlib import Path
data=json.loads(Path('/tmp/provider-smoke-command.json').read_text())
assert data.get('success') is True, data
assert 'open-lovable-provider-smoke' in (data.get('output') or ''), data
print('command: PASS')
PY

cleanup
trap - EXIT

python - <<'PY'
import json
from pathlib import Path
data=json.loads(Path('/tmp/provider-smoke-kill.json').read_text())
assert data.get('success') is True, data
assert data.get('localStateCleared') is True, data
print('kill: PASS')
PY
