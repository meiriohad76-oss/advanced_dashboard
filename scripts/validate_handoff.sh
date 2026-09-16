#!/usr/bin/env sh
set -eu

required_files="
README.md
HANDOFF.md
package.json
docker-compose.yml
frontend.Dockerfile
src/App.tsx
src/domain/engine.ts
backend/Dockerfile
backend/requirements.txt
backend/app/main.py
backend/app/engine.py
infra/nginx.conf
preview.html
"

for file in $required_files; do
  if [ ! -f "$file" ]; then
    echo "Missing required handoff file: $file" >&2
    exit 1
  fi
done

ATLAS_PYCACHE="${TMPDIR:-/tmp}/atlas-pyc"
PYTHONPYCACHEPREFIX="$ATLAS_PYCACHE" python3 -m compileall -q backend/app backend/tests
echo "Handoff structure and Python syntax: OK"
