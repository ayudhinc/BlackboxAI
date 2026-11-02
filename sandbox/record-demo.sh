#!/usr/bin/env bash
# Record scripted demo runs from the host. ERP runs (D10-D12) start the remote
# Meridian container on a private network first; host ports 3505 (noVNC) and
# 3506 (VNC) are registered in ~/dev/ports.md and only bound while recording.
# Usage: sandbox/record-demo.sh D01 [D02 ...]
set -euo pipefail
cd "$(dirname "$0")/.."
IMAGE=blackbox-sandbox:dev
mkdir -p recordings/demo
docker network inspect blackbox-net >/dev/null 2>&1 || docker network create blackbox-net >/dev/null

for id in "$@"; do
  remote=""
  if [[ "$id" =~ ^D1[0-2]$ ]]; then
    docker rm -f blackbox-meridian >/dev/null 2>&1 || true
    docker run -d --rm --name blackbox-meridian --hostname meridian --network blackbox-net --network-alias meridian \
      --shm-size=1g --add-host erp.meridian.test:127.0.0.1 -e SCREEN_W=1024 -e SCREEN_H=768 \
      -p 127.0.0.1:3506:5900 "$IMAGE" remote-desktop >/dev/null
    remote="blackbox-meridian"
    for _ in $(seq 1 50); do docker exec blackbox-meridian bash -c 'exec 3<>/dev/tcp/127.0.0.1/5900' 2>/dev/null && break; sleep 0.2; done
  fi
  docker run --rm --network blackbox-net --shm-size=1g \
    --add-host crm.acme.test:127.0.0.1 --add-host webmail.test:127.0.0.1 \
    ${remote:+-p 127.0.0.1:3505:6080} \
    -v "$PWD/recordings/demo:/recordings" "$IMAGE" demo-run "$id" "$id" 2>&1 | grep -v "unknown child\|dbus" | tail -2
  [[ -n "$remote" ]] && docker rm -f "$remote" >/dev/null
done
