() => {
  const els = [...document.querySelectorAll('[role="button"], button')]
  const m = els.find(e => e.offsetParent !== null && /تحديد الدولة/.test((e.innerText || '') + (e.getAttribute('aria-label') || '')))
  if (!m) return 'not found'
  m.click()
  return 'clicked: ' + ((m.innerText || '') + (m.getAttribute('aria-label') || '')).slice(0, 50)
}
