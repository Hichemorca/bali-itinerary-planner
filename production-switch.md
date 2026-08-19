# Production build (minified + gzip-ready)
The `build/` directory contains minified versions of all JS/CSS.
To use them, replace script/link references in HTML:
  js/<name>.js          -> build/<name>.min.js
  css/style.css         -> build/style.min.css
Optional: run `gzip -k build/*.min.js build/style.min.css` to pre-compress
and serve with `Content-Encoding: gzip` (Netlify does this automatically
for .gz files when netlify.toml sets [[plugins]... or you enable asset optimization).
