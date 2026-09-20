// فحص حي: تليجرام t.me/s/<channel> + RSS فيدات مصرية — نشوف إيه اللي شغال فعلاً
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"

async function testTelegram(channel: string) {
  try {
    const res = await fetch(`https://t.me/s/${channel}`, {
      headers: { "User-Agent": UA, "Accept-Language": "ar,en;q=0.8" },
      signal: AbortSignal.timeout(12000),
    })
    const html = await res.text()
    const posts = html.split('data-post="').length - 1
    const texts = html.split("tgme_widget_message_text").length - 1
    console.log(`TELEGRAM t.me/s/${channel}: HTTP ${res.status}, posts=${posts}, textBlocks=${texts}, len=${html.length}`)
    if (texts > 0) {
      const m = html.match(/tgme_widget_message_text[^>]*>([\s\S]{20,300}?)<\/div>/)
      if (m) console.log("   sample:", m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120))
    }
  } catch (e) {
    console.log(`TELEGRAM t.me/s/${channel}: FAIL ${e instanceof Error ? e.message : e}`)
  }
}

const FEEDS: Array<[string, string]> = [
  ["enterprise", "https://enterprise.press/feed/"],
  ["amwal-en", "https://en.amwalalghad.com/feed/"],
  ["egyptianstreets", "https://egyptianstreets.com/feed/"],
  ["wamda", "https://www.wamda.com/feed"],
  ["menabytes", "https://menabytes.com/feed"],
  ["alborsa", "https://alborsaanews.com/feed/"],
  ["amwal-ar", "https://www.amwalalghad.com/feed/"],
  ["hapijournal", "https://hapijournal.com/feed/"],
]

async function testFeed(name: string, url: string) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12000) })
    const xml = await res.text()
    const items = (xml.match(/<item[\s>]/g) ?? []).length + (xml.match(/<entry[\s>]/g) ?? []).length
    const titles = [...xml.matchAll(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/g)].slice(0, 3).map((m) => m[1].slice(0, 60))
    console.log(`RSS ${name}: HTTP ${res.status}, items=${items}, len=${xml.length}`)
    if (titles.length) console.log("   titles:", titles.join(" | "))
  } catch (e) {
    console.log(`RSS ${name}: FAIL ${e instanceof Error ? e.message : e}`)
  }
}

const channels = process.argv[2] ? [process.argv[2]] : ["startupsegypt", "Egypt_Startups", "masrbusiness", "telegram"]
await Promise.all(channels.map((c) => testTelegram(c)))
for (const [n, u] of FEEDS) await testFeed(n, u)
