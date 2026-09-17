#!/usr/bin/env bash
# Skybird Projects — Task 1 verification.
#
# Fill in the three values below, then run:  bash verify.sh
# Paste the whole output back to Claude.
#
# Nothing here writes to a production site. It creates two throwaway drafts on
# whatever site you point it at, and tells you their IDs so you can delete them.

SITE=''      # e.g. https://abc123.tastewp.com   (no trailing slash)
WPUSER=''    # your WordPress username
WPPASS=''    # Application Password, with the spaces, in quotes

# ---------------------------------------------------------------------------

set -uo pipefail

if [ -z "$SITE" ] || [ -z "$WPUSER" ] || [ -z "$WPPASS" ]; then
  echo "Fill in SITE, WPUSER and WPPASS at the top of this file first."
  exit 1
fi

SITE="${SITE%/}"
pass=0
fail=0

ok()   { printf '  \033[32mPASS\033[0m  %s\n' "$1"; pass=$((pass+1)); }
bad()  { printf '  \033[31mFAIL\033[0m  %s\n' "$1"; fail=$((fail+1)); }
note() { printf '        %s\n' "$1"; }

echo
echo "Skybird Projects verification"
echo "Site: $SITE"
echo "WordPress: $(curl -s "$SITE/wp-json/" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("name","?"))' 2>/dev/null || echo '?')"
echo

# --- 1. post type registered and exposed -----------------------------------
echo "1. Post type"
pt=$(curl -s "$SITE/wp-json/wp/v2/types/project")
if echo "$pt" | python3 -c 'import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get("rest_base")=="projects" else 1)' 2>/dev/null; then
  ok "rest_base is 'projects'"
else
  bad "post type missing or rest_base wrong"
  note "$(echo "$pt" | head -c 200)"
fi

if echo "$pt" | python3 -c 'import sys,json; d=json.load(sys.stdin); sys.exit(0 if d.get("supports",{}).get("custom-fields") else 1)' 2>/dev/null; then
  ok "supports custom-fields  <-- meta will be visible to n8n"
else
  bad "custom-fields NOT supported -- every meta field will be invisible to n8n"
fi

# --- 2. collection responds -------------------------------------------------
echo "2. Projects endpoint"
code=$(curl -s -o /dev/null -w '%{http_code}' "$SITE/wp-json/wp/v2/projects")
[ "$code" = "200" ] && ok "GET /wp/v2/projects -> 200" || bad "GET /wp/v2/projects -> $code"

# --- 3. meta in schema ------------------------------------------------------
echo "3. Meta schema"
meta=$(curl -s -X OPTIONS "$SITE/wp-json/wp/v2/projects" \
  | python3 -c 'import sys,json
try:
  d=json.load(sys.stdin)
  print(",".join(sorted(d["schema"]["properties"]["meta"]["properties"].keys())))
except Exception: print("")' 2>/dev/null)
count=$(echo "$meta" | tr ',' '\n' | grep -c . )
if [ "$count" -eq 14 ]; then
  ok "all 14 meta fields in schema"
else
  bad "expected 14 meta fields, found $count"
  note "$meta"
fi

# --- 4. service areas seeded ------------------------------------------------
echo "4. Service areas"
areas=$(curl -s "$SITE/wp-json/wp/v2/service-areas?per_page=20" \
  | python3 -c 'import sys,json
try: print(",".join(sorted(t["slug"] for t in json.load(sys.stdin))))
except Exception: print("")' 2>/dev/null)
want='franklinton,goldsboro,greenville,knightdale,raleigh,rolesville,wake-forest,youngsville'
[ "$areas" = "$want" ] && ok "8 terms seeded correctly" || { bad "service areas wrong"; note "got: $areas"; }

# --- 5. idempotency lookup accepted ----------------------------------------
echo "5. Idempotency lookup"
code=$(curl -s -o /dev/null -w '%{http_code}' "$SITE/wp-json/wp/v2/projects?companycam_project_id=110848078")
[ "$code" = "200" ] && ok "companycam_project_id param accepted" || bad "lookup param rejected -> $code"

# --- 6. no global archive ---------------------------------------------------
echo "6. No global projects hub"
code=$(curl -s -o /dev/null -w '%{http_code}' "$SITE/projects/")
[ "$code" = "404" ] && ok "/projects/ is 404 (correct -- Euan wants no master hub)" \
  || bad "/projects/ returned $code -- has_archive did not take"

# --- 7. authenticated write -------------------------------------------------
echo "7. Authenticated write  <-- the call n8n makes"
resp=$(curl -s -u "$WPUSER:$WPPASS" -X POST "$SITE/wp-json/wp/v2/projects" \
  -H 'Content-Type: application/json' \
  -d '{"status":"draft","title":"Smoke test - delete me","meta":{"companycam_project_id":"999","approx_lat":36.07,"approx_lng":-78.55}}')

id1=$(echo "$resp" | python3 -c 'import sys,json
try: print(json.load(sys.stdin).get("id",""))
except Exception: print("")' 2>/dev/null)

if [ -n "$id1" ]; then
  ok "draft created (id $id1)"
  echo "$resp" | python3 -c '
import sys,json
d=json.load(sys.stdin); m=d.get("meta",{})
checks=[("status is draft", d.get("status")=="draft"),
        ("companycam_project_id round-tripped", str(m.get("companycam_project_id"))=="999"),
        ("approx_lat round-tripped", abs(float(m.get("approx_lat") or 0)-36.07)<0.001),
        ("approx_lng round-tripped", abs(float(m.get("approx_lng") or 0)+78.55)<0.001)]
for n,c in checks: print(("  PASS  " if c else "  FAIL  ")+n)
' 2>/dev/null
else
  bad "could not create a draft"
  note "$(echo "$resp" | head -c 300)"
  note "A 401 here usually means a security plugin is blocking Application Passwords."
fi

# --- 8. validation rejects bad values --------------------------------------
echo "8. Validation rejects bad input"
resp2=$(curl -s -u "$WPUSER:$WPPASS" -X POST "$SITE/wp-json/wp/v2/projects" \
  -H 'Content-Type: application/json' \
  -d '{"status":"draft","title":"Validation test - delete me","meta":{"approx_lat":0,"approx_lng":0,"ambassador_referral_code":"BADGUY","completion_date":"2026-02-30","zip":"123","gallery":[5,5,-2,0]}}')

id2=$(echo "$resp2" | python3 -c 'import sys,json
try: print(json.load(sys.stdin).get("id",""))
except Exception: print("")' 2>/dev/null)

if [ -n "$id2" ]; then
  echo "$resp2" | python3 -c '
import sys,json
m=json.load(sys.stdin).get("meta",{})
checks=[("0,0 coordinates rejected", (m.get("approx_lat") in ("",0,None)) and (m.get("approx_lng") in ("",0,None))),
        ("invalid referral code rejected", not m.get("ambassador_referral_code")),
        ("Feb 30 rejected", not m.get("completion_date")),
        ("3-digit ZIP rejected", not m.get("zip")),
        ("gallery deduped, negatives dropped", m.get("gallery")==[5])]
for n,c in checks: print(("  PASS  " if c else "  FAIL  ")+n)
print("  gallery value:", m.get("gallery"))
' 2>/dev/null
  note "created id $id2"
else
  bad "validation test POST failed"
  note "$(echo "$resp2" | head -c 300)"
fi

echo
echo "-----------------------------------------------------"
echo "Structural checks: $pass passed, $fail failed"
[ -n "${id1:-}" ] && echo "Delete the throwaway drafts: id $id1${id2:+ and $id2}"
echo "-----------------------------------------------------"
echo
