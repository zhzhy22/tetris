#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../../" && pwd)"
FEATURE_DIR="${PROJECT_ROOT}/specs/001-web-tetris-10x20"

if [[ " $* " == *" --require-tasks "* ]]; then
  if [[ ! -f "${FEATURE_DIR}/tasks.md" ]]; then
    echo "[specify] ERROR: tasks.md not found in ${FEATURE_DIR}" >&2
    exit 1
  fi
fi

available_docs=()
if [[ -f "${FEATURE_DIR}/research.md" ]]; then
  available_docs+=("\"research.md\"")
fi
if [[ -f "${FEATURE_DIR}/data-model.md" ]]; then
  available_docs+=("\"data-model.md\"")
fi
if [[ -d "${FEATURE_DIR}/contracts" ]]; then
  available_docs+=("\"contracts/\"")
fi
if [[ -f "${FEATURE_DIR}/quickstart.md" ]]; then
  available_docs+=("\"quickstart.md\"")
fi
if [[ -f "${FEATURE_DIR}/tasks.md" ]]; then
  available_docs+=("\"tasks.md\"")
fi

docs_joined=$(IFS=,; echo "${available_docs[*]}")

echo "{\"FEATURE_DIR\":\"${FEATURE_DIR}\",\"AVAILABLE_DOCS\":[${docs_joined}]}"
