async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const vis = (e) => e.offsetParent !== null
  const lb = document.querySelector('[role="listbox"]')
  if (!lb) return { err: 'no listbox' }
  // الحاوية السكرولية الفعلية جوه الـlistbox (sh >> ch)
  let scroller = [...lb.querySelectorAll('*')].find(el => el.scrollHeight > el.clientHeight + 100)
  if (!scroller) scroller = lb
  let found = null
  let lastTop = -1
  for (let i = 0; i < 80 && !found; i++) {
    const items = [...lb.querySelectorAll('[role="listitem"], [role="option"], li')].filter(vis)
    found = items.find(e => /مصر/.test(e.innerText || ''))
    if (!found) {
      if (Math.abs(scroller.scrollTop - lastTop) < 1 && i > 2) break
      lastTop = scroller.scrollTop
      scroller.scrollTop = scroller.scrollTop + 600
      await sleep(200)
    }
  }
  if (!found) return { err: 'مصر غير موجودة', top: scroller.scrollTop, sh: scroller.scrollHeight }
  found.click()
  return { clicked: (found.innerText || '').replace(/\n/g, ' ').slice(0, 80), top: scroller.scrollTop }
}
