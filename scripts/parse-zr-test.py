"""تحليل عينة Google SERP من ZenRows — استخلاص النتايج (title/url/snippet)."""
import re, html, json

raw = open('/home/z/my-project/scripts/zenrows-google-ok.html', encoding='utf-8', errors='ignore').read()

results = []
seen = set()

# نمط جوجل الحديث: <a href="REAL_URL" ... ping="..."><h3 class="LC20lb...">TITLE</h3>...
# بناخد الـ href الحقيقي من <a> اللي جواه h3 بclass LC20lb
for m in re.finditer(r'<a\s[^>]*?href="([^"]+)"[^>]*>\s*(?:<[^h][^>]*>\s*)*<h3[^>]*>(.*?)</h3>', raw, re.S):
    url, title_html = m.group(1), m.group(2)
    # ننضف الـ URL من محارف التتبع
    url = html.unescape(url)
    url = url.split("&ved=")[0].split("&uoh=")[0]
    if url.startswith("/url?q="):
        url = urllib.parse.unquote(url[7:].split("&")[0])
    if not url.startswith("http"):
        continue
    dom = url.split("/")[2] if "/" in url else ""
    if "google." in dom or "gstatic." in dom:
        continue
    title = html.unescape(re.sub(r"<[^>]+>", "", title_html)).strip()
    if not title or url in seen:
        continue
    seen.add(url)
    # snippet: أول نص بعد الـ h3 في كتلة النتيجة (div VwiC3b هو الشائع)
    tail = raw[m.end():m.end() + 1500]
    sn = re.search(r'class="[^"]*VwiC3b[^"]*"[^>]*>(.*?)</div>', tail, re.S)
    snippet = html.unescape(re.sub(r"<[^>]+>", "", sn.group(1))).strip()[:200] if sn else ""

    results.append({"title": title, "url": url, "domain": dom, "snippet": snippet})

print(f"استخلصنا {len(results)} نتيجة:")
for r in results[:10]:
    print(f"• {r['title'][:55]} → {r['domain']}")
    if r["snippet"]:
        print(f"  {r['snippet'][:100]}")
