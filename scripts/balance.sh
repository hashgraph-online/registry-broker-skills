#!/usr/bin/env bash
# Check credit balance
# Usage: ./balance.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/stats.sh"

run_cli balance
