#!/bin/bash
# Build minified production copies (readable dev files kept in place)
cd js
for f in itinerary-engine.js map-calendar.js analytics.js gumroad-integration.js pdf-generator.js quiz.js result.js; do
  npx -y terser "$f" -o "../build/${f%.js}.min.js" -c passes=2 -m 2>/dev/null && echo "minified $f ($(du -h $f | cut -f1) -> $(du -h ../build/${f%.js}.min.js | cut -f1))"
done
# CSS: simple minification via python
python3 - <<'PYEOF'
import re
css = open('../css/style.css').read()
css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
css = re.sub(r'\s+', ' ', css)
css = re.sub(r'\s*([{}:;,])\s*', r'\1', css)
css = css.strip()
open('../build/style.min.css','w').write(css)
print('css minified:', len(open('../css/style.css').read()), '->', len(css))
PYEOF
