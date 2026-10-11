#!/bin/bash
# Cloud sessions: commit as lolesterrr, unsigned (see "Commits" in CLAUDE.md).
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"
git config user.name "lolesterrr"
git config user.email "178182850+lolesterrr@users.noreply.github.com"
git config commit.gpgsign false
