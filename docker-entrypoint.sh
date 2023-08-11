#!/usr/bin/env bash

set -Eeu -o pipefail
shopt -s dotglob inherit_errexit nullglob compat"${BASH_COMPAT=42}"

printf "%s\n" "$GITHUB_RSA_PRIVATE_KEY" > "private-key.pem"
export GITHUB_RSA_PRIVATE_KEY_FILE="private-key.pem"

exec yarn next start -p 80
