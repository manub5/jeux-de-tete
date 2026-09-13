#!/usr/bin/env bash
# tests/navigateur/lancer.sh
# Serve the repository on a free port, run the browser scripts, stop the
# server, and exit non-zero if any of them failed.
set -euo pipefail

ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RACINE="$(cd "$ICI/../.." && pwd)"
PYTHON="${PYTHON:-python3}"
ESSAIS=(essai_sudoku.py essai_hauteurs.py essai_motus.py essai_ensemble.py \
        essai_mise_a_jour.py essai_paires.py essai_sequence.py)

if [[ ! -f "$RACINE/index.html" ]]; then
  echo "Racine du dépôt introuvable : $RACINE" >&2
  exit 1
fi

if ! "$PYTHON" -c 'import playwright' >/dev/null 2>&1; then
  echo "Playwright n'est pas installé pour « $PYTHON »." >&2
  echo "  pip install playwright && \"$PYTHON\" -m playwright install chromium" >&2
  exit 1
fi

# A free port rather than a fixed one: two runs at once must not collide, and
# a new origin each time means no service worker or cache survives from the
# previous run.
PORT="$("$PYTHON" - <<'FIN'
import socket

with socket.socket() as prise:
    prise.bind(("127.0.0.1", 0))
    print(prise.getsockname()[1])
FIN
)"

SERVEUR=""
arreter_serveur() {
  if [[ -n "$SERVEUR" ]] && kill -0 "$SERVEUR" 2>/dev/null; then
    kill "$SERVEUR" 2>/dev/null || true
    wait "$SERVEUR" 2>/dev/null || true
  fi
}
trap arreter_serveur EXIT

"$PYTHON" -m http.server "$PORT" --bind 127.0.0.1 --directory "$RACINE" \
  >/dev/null 2>&1 &
SERVEUR=$!

export JEUX_URL="http://127.0.0.1:${PORT}/"

pret=0
for ((essai = 0; essai < 50; essai++)); do
  if "$PYTHON" -c \
    "import urllib.request; urllib.request.urlopen('${JEUX_URL}', timeout=1)" \
    >/dev/null 2>&1; then
    pret=1
    break
  fi
  sleep 0.2
done

if [[ "$pret" -ne 1 ]]; then
  echo "Le serveur n'a pas répondu sur $JEUX_URL" >&2
  exit 1
fi
echo "Serveur sur $JEUX_URL (pid $SERVEUR)"

echecs=()
for script in "${ESSAIS[@]}"; do
  echo
  echo "######## $script ########"
  if "$PYTHON" "$ICI/$script"; then
    echo "######## $script : OK ########"
  else
    echo "######## $script : EN ÉCHEC ########"
    echecs+=("$script")
  fi
done

echo
if [[ "${#echecs[@]}" -gt 0 ]]; then
  echo "Essais en échec : ${echecs[*]}" >&2
  exit 1
fi
# Counted, not written down: the sentence was still saying "four" the day a
# fifth script landed, and a summary that miscounts is a summary nobody reads.
echo "Les ${#ESSAIS[@]} essais passent."
