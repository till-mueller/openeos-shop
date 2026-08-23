#!/bin/sh
# Rewrites the sentinel token baked into the built .next output (see the
# Dockerfile's NEXT_PUBLIC_API_URL ARG default) to its real runtime value,
# so one image can be redeployed against a different api domain without a
# rebuild. If the image was built with a real URL passed as a build-arg
# instead of the sentinel, this grep simply finds nothing and no-ops.
set -e

replace_token() {
  token="$1"
  value="$2"
  grep -rl -- "$token" /app/.next /app/public 2>/dev/null | while IFS= read -r file; do
    sed -i "s|$token|$value|g" "$file"
  done
}

replace_token '__RUNTIME_NEXT_PUBLIC_API_URL__' "${NEXT_PUBLIC_API_URL:-https://api.openeos.de/api}"

exec "$@"
