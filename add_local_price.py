import json, random
random.seed(42)
d = json.load(open('data/activities.json'))

# Discount factors per activity type: on-site/free-entry activities have same local price;
# platform tours (GYG/Viator/Klook) local price ~45-60% of platform low price.
for a in d['activities']:
    low = a.get('priceLow', 0)
    high = a.get('priceHigh', 0)
    if low <= 0:
        a['localPrice'] = 0
        continue
    plat = a.get('platform','') or ''
    name_l = a['name'].lower()
    # Direct/on-site activities (official websites, beach clubs, local schools): no big markup
    is_direct = any(k in plat.lower() for k in ['klook']) or any(k in name_l for k in ['beach club','single fin','potato','finns','savaya','elkabron','surf lesson','cooking class','yoga','spa','massage','entrance','temple','dance show','devdan','dinner','beach'])
    if is_direct:
        factor = random.uniform(0.75, 0.9)
    else:
        factor = random.uniform(0.45, 0.6)
    local = max(1, round(low * factor))
    local_high = max(local, round(high * factor)) if high > low else local
    a['localPrice'] = local
    a['localPriceHigh'] = local_high

json.dump(d, open('data/activities.json','w'), indent=1, ensure_ascii=False)
print('localPrice added to', len(d['activities']), 'activities')
# sample check
for a in d['activities'][:8]:
    print(a['id'], a['name'][:45], 'low', a.get('priceLow'), 'local', a.get('localPrice'))
