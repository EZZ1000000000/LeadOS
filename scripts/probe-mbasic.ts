// اختبار mbasic: هل الجلسة شغالة؟ هل بنشوف الجروب؟ هل فيه فورم تعليق؟
const cookie = process.env.FACEBOOK_SESSION_COOKIE
const group = process.argv[2] ?? "410405026127793"

// UA موبايل قديم يخلي فيسبوك يخدم mbasic بدون redirect لموقع كامل
const UA_BASIC =
  process.argv[3] === "m"
    ? "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
    : "Mozilla/5.0 (Linux; U; Android 4.4.2; en-us; SAMSUNG-SM-G900A Build/KOT49H) AppleWebKit/537.16 (KHTML, like Gecko) Version/2.0 Chrome/34.0.0 Mobile Safari/537.16"

const base = process.argv[3] === "m" ? "https://m.facebook.com" : "https://mbasic.facebook.com"

async function probe(url: string, label: string) {
  try {
    const res = await fetch(url, {
      headers: { Cookie: cookie!, "User-Agent": UA_BASIC, "Accept-Language": "ar,eg;q=0.9,en;q=0.8" },
      redirect: "follow",
      signal: AbortSignal.timeout(25000),
    })
    const html = await res.text()
    const markers = {
      loggedIn: /\/logout.php|LogoutButton|تسجيل الخروج/.test(html),
      composer: /composer|اكتب منشور|Write something/i.test(html),
      storyLink: /\/posts\/|permalink|story_fbid/.test(html),
      commentForm: /comment\/submit|comment_text|ufi/i.test(html),
      loginWall: /login_form|checkpoint|log in to continue|سجل الدخول/i.test(html),
      dtsg: /"dtsg":|"DTSGInitialData"|fb_dtsg/.test(html),
      unavailable: /content isn't available|محتوى غير متوفر|unavailable/i.test(html),
    }
    console.log(`【${label}】 ${res.status} final=${res.url.slice(0, 70)} len=${html.length}`)
    console.log("   ", JSON.stringify(markers))
    return html
  } catch (e) {
    console.log(`【${label}】 FAIL ${e instanceof Error ? e.message : e}`)
    return ""
  }
}

const feed = await probe(`${base}/groups/${group}`, `feed ${base.includes("mbasic") ? "mbasic" : "m"}`)
if (feed) {
  // دور على لينك أول منشور (Full Story)
  const postLinks = [...feed.matchAll(/href="([^"]*\/groups\/[^"]*\/posts\/[^"]*)"/g)].slice(0, 3).map((m) => m[1])
  console.log("   post links:", postLinks.length, postLinks[0]?.slice(0, 90))
  if (postLinks[0]) {
    const permalink = postLinks[0].startsWith("http") ? postLinks[0] : `${base}${postLinks[0]}`
    await probe(permalink, "permalink+comment-form")
  }
}
