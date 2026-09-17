# Task 1 verification — copy/paste checks

Replace `SITE` with your sandbox URL (no trailing slash).

```bash
SITE=https://your-sandbox.example.com
```

## 1. Post type is registered and exposed

```bash
curl -s "$SITE/wp-json/wp/v2/types/project" | python3 -m json.tool | head -30
```

Expect: JSON (not a 404). Look for `"rest_base": "projects"` and, under
`supports`, `"custom-fields": true`. If `custom-fields` is missing or false,
every meta field will be invisible to n8n — stop and tell me.

## 2. The projects endpoint exists

```bash
curl -s -o /dev/null -w "%{http_code}\n" "$SITE/wp-json/wp/v2/projects"
```

Expect: `200` (with `[]` as the body — no projects yet).

## 3. Meta fields are in the schema

```bash
curl -s -X OPTIONS "$SITE/wp-json/wp/v2/projects" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(sorted(d['schema']['properties']['meta']['properties'].keys()))"
```

Expect all 14:
`approx_lat, approx_lng, ambassador_referral_code, city, color,
companycam_project_id, completion_date, gallery, manufacturer, neighborhood,
product_line, proline_project_id, warranty, zip`

An empty list or a KeyError means #1's `custom-fields` check failed.

## 4. The eight service areas seeded on activation

```bash
curl -s "$SITE/wp-json/wp/v2/service-areas?per_page=20" \
  | python3 -c "import sys,json; print([t['slug'] for t in json.load(sys.stdin)])"
```

Expect exactly:
`['franklinton','goldsboro','greenville','knightdale','raleigh','rolesville','wake-forest','youngsville']`

## 5. The idempotency lookup is accepted

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  "$SITE/wp-json/wp/v2/projects?companycam_project_id=110848078"
```

Expect: `200`. A `400` means the parameter wasn't registered.

## 6. No global projects archive

```bash
curl -s -o /dev/null -w "%{http_code}\n" "$SITE/projects/"
```

Expect: `404`. A `200` means `has_archive` didn't take — Euan explicitly does
not want a master projects hub.

## 7. Authenticated write works

Create an Application Password first: **Users → Profile → Application
Passwords**, name it `n8n`. Copy it with the spaces.

```bash
WPUSER='admin-username'
WPPASS='xxxx xxxx xxxx xxxx xxxx xxxx'

curl -s -u "$WPUSER:$WPPASS" -X POST "$SITE/wp-json/wp/v2/projects" \
  -H 'Content-Type: application/json' \
  -d '{"status":"draft","title":"Smoke test","meta":{"companycam_project_id":"999","approx_lat":36.07,"approx_lng":-78.55}}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('id',d.get('id'),'status',d.get('status')); print('meta',d.get('meta'))"
```

Expect: an `id`, `status draft`, and meta echoing back
`companycam_project_id 999`, `approx_lat 36.07`, `approx_lng -78.55`.

**This is the single most important check** — it's the exact call n8n makes.

## 8. Validation actually rejects bad values

```bash
curl -s -u "$WPUSER:$WPPASS" -X POST "$SITE/wp-json/wp/v2/projects" \
  -H 'Content-Type: application/json' \
  -d '{"status":"draft","title":"Validation test","meta":{"approx_lat":0,"approx_lng":0,"ambassador_referral_code":"BADGUY","completion_date":"2026-02-30","zip":"123","gallery":[5,5,-2,0]}}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('meta'))"
```

Expect every one of those to come back **empty or dropped**:
`approx_lat ''`, `approx_lng ''` (0,0 rejected),
`ambassador_referral_code ''` (contains A and U),
`completion_date ''` (Feb 30 isn't real), `zip ''` (not 5 digits),
`gallery [5]` (deduped, negative and zero dropped).

If any bad value is stored, tell me which — that's a validation bug.
