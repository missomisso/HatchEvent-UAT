#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# run-uat.sh — HatchEvent UAT one-command runner
#
# Usage:
#   ./run-uat.sh                   # run all journeys, then update tracker
#   ./run-uat.sh eo                # run EO Journey only
#   ./run-uat.sh vendor            # run Vendor Registration only
#   ./run-uat.sh rfq               # run RFQ Process only
#   ./run-uat.sh svc               # run Event Service & RSVP only
#   ./run-uat.sh --no-tracker      # skip tracker update (useful for quick checks)
#   ./run-uat.sh --headed          # run with visible browser window
#
# Requirements:
#   • Node.js ≥18 and npm
#   • Python 3 (python3 in PATH)
#   • .env file populated (see SETUP GUIDE below or README.md)
#   • HatchEvent-UAT-Tracker-v6.xlsx in this directory
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; }

# ── Change to the script's own directory ─────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Argument parsing ──────────────────────────────────────────────────────────
JOURNEY=""
UPDATE_TRACKER=true
HEADED_FLAG=""

for arg in "$@"; do
  case "$arg" in
    eo|vendor|rfq|svc) JOURNEY="$arg" ;;
    --no-tracker)      UPDATE_TRACKER=false ;;
    --headed)          HEADED_FLAG="--headed" ;;
    --help|-h)
      grep '^# ' "$0" | sed 's/^# //'
      exit 0 ;;
    *)
      error "Unknown argument: $arg"
      error "Usage: ./run-uat.sh [eo|vendor|rfq|svc] [--no-tracker] [--headed]"
      exit 1 ;;
  esac
done

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║       HatchEvent UAT — Playwright Runner         ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${RESET}"
echo -e "  Date:    $(date '+%d/%m/%Y %H:%M')"
echo -e "  Journey: ${JOURNEY:-all journeys}"
echo -e "  Tracker: ${UPDATE_TRACKER}"
echo ""

# ── Pre-flight checks ─────────────────────────────────────────────────────────
info "Running pre-flight checks…"

# 1. .env must exist
if [[ ! -f ".env" ]]; then
  error ".env file not found!"
  echo ""
  echo "  Create it by copying the template and filling in your credentials:"
  echo "    cp .env.example .env"
  echo "    nano .env   (or open in your editor)"
  echo ""
  echo "  See README.md → 'Credential Setup' for details."
  exit 1
fi

# 2. Required credentials must be set (not empty, not placeholder)
source .env 2>/dev/null || true

MISSING=()
for VAR in EO_EMAIL EO_PASSWORD VENDOR_EMAIL VENDOR_PASSWORD; do
  VALUE="${!VAR:-}"
  if [[ -z "$VALUE" || "$VALUE" == *"your_"* || "$VALUE" == *"example"* ]]; then
    MISSING+=("$VAR")
  fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  error "The following credentials are missing or still have placeholder values in .env:"
  for VAR in "${MISSING[@]}"; do
    echo "    • $VAR"
  done
  echo ""
  echo "  Edit .env and provide real staging account credentials."
  echo "  See README.md → 'Credential Setup' for details."
  exit 1
fi
success "Credentials OK (EO + Vendor accounts found)"

# 3. Node / npm
if ! command -v node &>/dev/null; then
  error "Node.js not found. Install Node.js ≥18 from https://nodejs.org"
  exit 1
fi
if ! command -v npm &>/dev/null; then
  error "npm not found. It should ship with Node.js."
  exit 1
fi
NODE_VER=$(node --version)
success "Node.js $NODE_VER"

# 4. node_modules
if [[ ! -d "node_modules" ]]; then
  info "node_modules not found — running npm install…"
  npm install --silent
fi
success "node_modules present"

# 5. Python 3
if ! command -v python3 &>/dev/null; then
  error "python3 not found. Install Python 3 to enable tracker updates."
  if [[ "$UPDATE_TRACKER" == true ]]; then
    warn "Disabling tracker update (use --no-tracker to suppress this warning)."
    UPDATE_TRACKER=false
  fi
else
  success "Python3 $(python3 --version 2>&1 | cut -d' ' -f2)"
fi

# 6. Tracker file (only needed if we plan to update it)
TRACKER_FILE=$(ls HatchEvent-UAT-Tracker*.xlsx 2>/dev/null | head -1 || true)
if [[ "$UPDATE_TRACKER" == true ]]; then
  if [[ -z "$TRACKER_FILE" ]]; then
    warn "No HatchEvent-UAT-Tracker*.xlsx found in $SCRIPT_DIR"
    warn "Tracker update will be skipped. Place the file here and re-run."
    UPDATE_TRACKER=false
  else
    success "Tracker file: $TRACKER_FILE"
  fi
fi

# ── Run Playwright ─────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}── Running Playwright tests ─────────────────────────────────────${RESET}"

# Map friendly name to npm script
case "$JOURNEY" in
  eo)     NPM_SCRIPT="test:eo" ;;
  vendor) NPM_SCRIPT="test:vendor" ;;
  rfq)    NPM_SCRIPT="test:rfq" ;;
  svc)    NPM_SCRIPT="test:svc" ;;
  *)      NPM_SCRIPT="test" ;;
esac

# Pass --headed via PLAYWRIGHT_HEADED env var so npm scripts pick it up
PLAYWRIGHT_HEADED_FLAG=""
if [[ -n "$HEADED_FLAG" ]]; then
  export PLAYWRIGHT_HEADED=1
fi

START_TIME=$(date +%s)

# Run tests; capture exit code without killing the script (set -e)
if npm run "$NPM_SCRIPT" -- ${HEADED_FLAG:-}; then
  TEST_EXIT=0
  echo ""
  success "Playwright tests completed"
else
  TEST_EXIT=$?
  echo ""
  warn "Playwright tests finished with failures (exit $TEST_EXIT)"
  warn "Failed tests will be marked Fail in the tracker."
fi

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
info "Test run duration: ${ELAPSED}s"

# ── Update Excel tracker ────────────────────────────────────────────────────────
RESULTS_JSON="results/results.json"

if [[ "$UPDATE_TRACKER" == true ]]; then
  echo ""
  echo -e "${BOLD}── Updating Excel tracker ───────────────────────────────────────${RESET}"

  if [[ ! -f "$RESULTS_JSON" ]]; then
    warn "results/results.json not found — was the JSON reporter configured?"
    warn "Check playwright.config.js reporter settings."
  else
    TESTER_NAME="${TESTER_NAME:-Laurent Misso}" \
      python3 update_tracker.py "$RESULTS_JSON" "$TRACKER_FILE"
    success "Tracker updated: $TRACKER_FILE"
  fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║                    RUN SUMMARY                   ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════╝${RESET}"
echo -e "  Finished: $(date '+%d/%m/%Y %H:%M')"
echo -e "  Duration: ${ELAPSED}s"

if [[ -f "playwright-report/index.html" ]]; then
  echo -e "  HTML Report: ${SCRIPT_DIR}/playwright-report/index.html"
  echo "  (open with: npx playwright show-report)"
fi

if [[ "$UPDATE_TRACKER" == true && -n "$TRACKER_FILE" ]]; then
  echo -e "  Tracker: ${SCRIPT_DIR}/${TRACKER_FILE}"
fi

echo ""
if [[ $TEST_EXIT -eq 0 ]]; then
  echo -e "  ${GREEN}${BOLD}All tests passed ✓${RESET}"
else
  echo -e "  ${YELLOW}${BOLD}Some tests failed — review the HTML report for details${RESET}"
fi
echo ""

exit $TEST_EXIT
