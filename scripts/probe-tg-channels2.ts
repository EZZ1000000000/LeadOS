// جولة تانية من القنوات المرشحة + فحص بنية HTML للبارسر
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"

const CANDIDATES2 = [
  "ArabStartups", "arab_startup", "MENAStartups", "menastartups",
  "SadanyBusiness", "sadany", "HassoubAcademy", "hassoub",
  "EntrepreneursEG", "BusinessEgypt", "business_egypt", "EGYMarketing",
  "EgyptMarketing", "marketing_egypt", "eMarketeersEG", "3lmTasweeq",
  "EgyFreelancers", "egyfreelance", "freelancers_egypt", "MostaqlPlatform",
  "AkhbarEconomy", "EgyptEconomyNews", "BorsaNews", "AlmalNews", "almalnews",
  "Youm7Economy", "youm7", "Masrawy", "masrawy", "ElYawm7",
]

for (const ch of CANDIDATES2) {
  try {
    const res = await fetch(`https://t.me/s/${ch}`, {
      headers: { "User-Agent": UA, "Accept-Language": "ar,en;q=0.8" },
      signal: AbortSignal.timeout(8000),
    })
    const html = await res.text()
    const posts = html.split('data-post="').length - 1
    if (posts > 0) console.log(`${ch}: posts=${posts}  ✅`)
  } catch { console.log(`${ch}: FAIL`) }
}

// فحص البنية — قناة شغالة
console.log("\n=== HTML STRUCTURE (AlBorsaNews) ===")
try {
  const res = await fetch("https://t.me/s/AlBorsaNews", { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000) })
  const html = await res.text()
  const first = html.indexOf('data-post="')
  console.log(html.slice(Math.max(0, first - 600), first + 2600).replace(/\s+/g, " ").slice(0, 3000))
} catch (e) { console.log("struct FAIL", e) }
