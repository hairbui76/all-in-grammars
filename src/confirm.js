import { on } from './app.js'

let settle = null
let returnFocus = null

function close(answer) {
  document.getElementById('modal')?.remove()
  returnFocus?.focus?.()
  returnFocus = null
  settle?.(answer)
  settle = null
}
on('modal-no', () => close(false))
on('modal-yes', () => close(true))

/** Asks before something destructive. `body` is HTML. Resolves to true when confirmed. */
export function confirmDialog({ title, body, yes }) {
  close(false)
  returnFocus = document.activeElement
  const m = document.createElement('div')
  m.className = 'modal'
  m.id = 'modal'
  m.innerHTML =
    `<div class="modal-box" role="alertdialog" aria-modal="true" aria-labelledby="mTitle"><h2 id="mTitle">${title}</h2><p>${body}</p>` +
    `<div class="row"><button class="btn grow" data-act="modal-no">Huỷ</button><button class="btn danger grow" data-act="modal-yes">${yes}</button></div></div>`
  m.addEventListener('click', (e) => {
    if (e.target === m) close(false)
  })
  document.body.appendChild(m)
  m.querySelector('[data-act="modal-no"]').focus()
  return new Promise((resolve) => (settle = resolve))
}
