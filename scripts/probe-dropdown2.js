() => {
  const vis = (e) => e.offsetParent !== null
  const roles = [...document.querySelectorAll('[role]')].filter(vis).map(e => e.getAttribute('role')).reduce((a, r) => (a[r] = (a[r] || 0) + 1, a), {})
  const inputs = [...document.querySelectorAll('input')].filter(vis).map(i => ({ type: i.type, ph: i.placeholder, val: (i.value || '').slice(0, 20), aria: i.getAttribute('aria-label') }))
  // كل النصوص الليفية الظاهرة (أول 70)
  const leaves = [...document.querySelectorAll('div,span,li,p,button')].filter(e => vis(e) && e.children.length === 0 && (e.innerText || '').trim()).slice(0, 70).map(e => (e.innerText || '').trim().slice(0, 40))
  // أي عنصر فيه "هونغ" أو "مصر"
  const hits = [...document.querySelectorAll('*')].filter(e => vis(e) && /هونغ|مصر|852|Egypt/.test(e.innerText || '') && e.children.length < 50).slice(0, 10).map(e => ({ tag: e.tagName, role: e.getAttribute('role'), txt: (e.innerText || '').replace(/\n/g, ' | ').slice(0, 80) }))
  return { roles, inputs, leaves, hits, body: (document.body.innerText || '').replace(/\n+/g, ' | ').slice(0, 500) }
}
