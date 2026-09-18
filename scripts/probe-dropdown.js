() => ({
  url: location.href.slice(0, 80),
  inputs: [...document.querySelectorAll('input')].filter(i => i.offsetParent !== null).map(i => ({ type: i.type, ph: i.placeholder, val: (i.value || '').slice(0, 20), aria: i.getAttribute('aria-label') })),
  roles: [...document.querySelectorAll('[role]')].filter(e => e.offsetParent !== null).map(e => e.getAttribute('role')).reduce((a, r) => (a[r] = (a[r] || 0) + 1, a), {}),
  lists: [...document.querySelectorAll('ul, ol, [role="listbox"], [role="list"]')].filter(e => e.offsetParent !== null).slice(0, 6).map(e => ({ tag: e.tagName, role: e.getAttribute('role'), kids: e.children.length, sample: (e.innerText || '').replace(/\n/g, ' | ').slice(0, 200) })),
  egText: [...document.querySelectorAll('div,span,li,p')].filter(e => e.offsetParent !== null && e.children.length === 0 && /مصر/.test(e.innerText || '')).slice(0, 8).map(e => ({ tag: e.tagName, txt: (e.innerText || '').slice(0, 50) })),
  bodyText: (document.body.innerText || '').replace(/\n+/g, ' | ').slice(0, 700),
})
