// Meeting point between the shell (main.js) and the views.
// Views register click handlers with on(); the shell fills in refresh/go.

/** data-act name → handler(arg, element, event) */
export const actions = {}
export const on = (name, fn) => (actions[name] = fn)

export const app = {
  /** Current route: {view, arg}. */
  route: { view: 'home', arg: null },
  /** Re-render the current view in place, keeping the scroll position. */
  refresh: () => {},
  /** Re-render only the shell chrome (sidebar progress and such). */
  refreshChrome: () => {},
  /** Navigate to a hash as if a link had been followed. */
  go: () => {},
}
