() => {
  const lb = document.querySelector('[role="listbox"]')
  if (!lb) return 'no listbox'
  const chain = []
  let e = lb
  for (let i = 0; i < 8 && e; i++) {
    chain.push({ tag: e.tagName, cls: String(e.className).slice(0, 50), st: e.scrollTop, sh: e.scrollHeight, ch: e.clientHeight, overflow: e.style ? e.style.overflow : null, computed: getComputedStyle(e).overflowY })
    e = e.parentElement
  }
  // وابحث جوه listbox عن أي حاوية قابلة للسكرول
  const inner = [...lb.querySelectorAll('*')].map(el => ({ tag: el.tagName, st: el.scrollTop, sh: el.scrollHeight, ch: el.clientHeight })).filter(x => x.sh > x.ch + 10)
  return { chain, inner }
}
