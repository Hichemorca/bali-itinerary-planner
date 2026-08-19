import json, urllib.request, concurrent.futures, time

d = json.load(open('data/activities.json'))
acts = d['activities']
print(f"Total activities: {len(acts)}")

def check(a):
    url = a.get('bookingLink','')
    if not url: return (a['id'], 'NO_LINK', None)
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'}
    try:
        req = urllib.request.Request(url, headers=headers, method='HEAD')
        with urllib.request.urlopen(req, timeout=15) as r:
            return (a['id'], r.status, None)
    except Exception as e:
        # try GET with redirects
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=15) as r:
                return (a['id'], r.status, 'GET')
        except Exception as e2:
            return (a['id'], 'FAIL', str(e2)[:80])

with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
    results = list(ex.map(check, acts))

bad = [r for r in results if r[1] not in (200, 301, 302, 303, 307, 308)]
for r in bad: print('BAD:', r)
print(f"\nBad/unreachable: {len(bad)} / {len(results)}")
