// تشخيص الرادار: نعرض بالظبط إيه اللي اتحمل من الصفحة وإيه اللي اتحلل
import { db } from "../src/lib/db"
import { stealthNavigate, stealthAct } from "../src/lib/agent/stealth-browser"
import { parseAgeMinutes, parseCommentCount, matchInstantIntent } from "../src/lib/radar"

const group = await db.monitoredGroup.findFirst({ where: { platform: "FACEBOOK" } })
if (!group) process.exit(1)
console.log("جروب:", group.name.slice(0, 50))

const nav = await stealthNavigate({ url: group.url, wait_until: "domcontentloaded", timeout: 90_000, scroll_times: 2, session: "fb" })
console.log("nav ok:", nav.ok, "| text len:", (nav.text ?? "").length)

const EXTRACT = `(() => {
  const arts = Array.from(document.querySelectorAll('div[role="article"]')).slice(0, 40);
  const out = [];
  for (const a of arts) {
    const linkEl = a.querySelector('a[href*="/posts/"], a[href*="story_fbid"], a[href*="permalink"]');
    const link = linkEl ? linkEl.href : '';
    const text = (a.innerText || '').slice(0, 900);
    if (text.length < 30) continue;
    out.push({ link, text });
  }
  return out;
})()`

const r = await stealthAct({ action: "eval", script: EXTRACT, session: "fb" })
const articles = (Array.isArray(r.result) ? r.result : []) as Array<{ link: string; text: string }>
console.log("articles:", articles.length)
for (const a of articles.slice(0, 10)) {
  const age = parseAgeMinutes(a.text)
  const comments = parseCommentCount(a.text)
  const intent = matchInstantIntent(a.text)
  const first = a.text.slice(0, 150).replace(/\n/g, " ⏎ ")
  console.log(`\n— age=${age ?? "?"}د comments=${comments} intent=${intent ? intent.matched.join("+") + " @" + intent.score : "لا"} link=${a.link ? "نعم" : "لا"}`)
  console.log("  ", first)
}
process.exit(0)
