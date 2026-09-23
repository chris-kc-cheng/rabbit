#!/usr/bin/env bash

set -Eeuo pipefail
umask 077

usage() {
  cat <<'EOF'
Download the production PostgreSQL database and replace the local database.

Usage:
  HOSTINGER_HOST=example.com HOSTINGER_USER=deploy \
    scripts/restore-production-database.sh

Required environment variables:
  HOSTINGER_HOST       Hostname of the production Hostinger server
  HOSTINGER_USER       SSH user for the production Hostinger server

Optional environment variables:
  HOSTINGER_SSH_PORT   SSH port (default: 22)
  HOSTINGER_SSH_KEY    Path to an SSH private key (uses the SSH default if unset)
  RABBIT_REMOTE_DIR    Production deployment directory (default: ~/rabbit)
  RABBIT_LOCAL_DATA    Local backup directory (default: <repo>/local-data)
  RABBIT_DATABASE_NAME Database to dump and restore (default: rabbit)
  RABBIT_DATABASE_USER Database role used by Compose (default: rabbit)

The local PostgreSQL service must be running with `docker compose up -d db`.
The dated custom-format dump is retained in local-data after the restore.
EOF
}

if [[ ${1:-} == "--help" || ${1:-} == "-h" ]]; then
  usage
  exit 0
fi

if (($# > 0)); then
  usage >&2
  exit 2
fi

: "${HOSTINGER_HOST:?Set HOSTINGER_HOST to the production server hostname}"
: "${HOSTINGER_USER:?Set HOSTINGER_USER to the production SSH user}"

ssh_port=${HOSTINGER_SSH_PORT:-22}
ssh_key=${HOSTINGER_SSH_KEY:-}
remote_dir=${RABBIT_REMOTE_DIR:-'~/rabbit'}
database=${RABBIT_DATABASE_NAME:-rabbit}
database_user=${RABBIT_DATABASE_USER:-rabbit}

if [[ ! $database =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ || ! $database_user =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]]; then
  echo "Database name and user must be PostgreSQL identifiers." >&2
  exit 2
fi

repo_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
local_data=${RABBIT_LOCAL_DATA:-"$repo_dir/local-data"}
timestamp=$(date -u +%Y%m%dT%H%M%SZ)
dump_path="$local_data/rabbit-production-$timestamp.dump"
partial_path="$dump_path.partial"

mkdir -p -- "$local_data"
chmod 700 "$local_data"
trap 'rm -f -- "$partial_path"' EXIT

ssh_args=(-p "$ssh_port")
if [[ -n $ssh_key ]]; then
  ssh_args+=(-i "$ssh_key")
fi

if [[ $remote_dir == "~/rabbit" ]]; then
  remote_dir_quoted='~/rabbit'
else
  printf -v remote_dir_quoted '%q' "$remote_dir"
fi
printf -v database_quoted '%q' "$database"
printf -v database_user_quoted '%q' "$database_user"
remote_dump="cd $remote_dir_quoted && docker compose -p rabbit --env-file .env.prod -f compose.prod.yml exec -T db pg_dump --username $database_user_quoted --dbname $database_quoted --format=custom --no-owner --no-privileges"

echo "Downloading production database to $dump_path ..."
ssh "${ssh_args[@]}" "$HOSTINGER_USER@$HOSTINGER_HOST" "$remote_dump" >"$partial_path"
[[ -s $partial_path ]] || { echo "Production dump was empty; local database was not changed." >&2; exit 1; }
mv -- "$partial_path" "$dump_path"
chmod 600 "$dump_path"

cd "$repo_dir"
echo "Validating the downloaded PostgreSQL archive ..."
docker compose exec -T db pg_restore --list <"$dump_path" >/dev/null

echo "Replacing local database '$database' ..."
docker compose exec -T db psql --username "$database_user" --dbname postgres --set ON_ERROR_STOP=1 \
  --command "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$database' AND pid <> pg_backend_pid();" >/dev/null
docker compose exec -T db dropdb --username "$database_user" --if-exists "$database"
docker compose exec -T db createdb --username "$database_user" "$database"
docker compose exec -T db pg_restore --username "$database_user" --dbname "$database" --exit-on-error --no-owner --no-privileges <"$dump_path"

echo "Local database replaced successfully. Backup retained at $dump_path"
