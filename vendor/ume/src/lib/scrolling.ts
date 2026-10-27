/* Marks an autohide-scrollbar element with data-scrolling while it scrolls,
   so its bar shows, and clears it 800ms after the last scroll event. One
   listener on the document (scroll doesn't bubble, so it listens in the
   capture phase) covers every table without each one wiring a ref. */
const timers = new WeakMap<Element, number>()

export function installScrollingFlag() {
  document.addEventListener(
    "scroll",
    (e) => {
      const el = e.target
      if (!(el instanceof HTMLElement) || !el.classList.contains("autohide-scrollbar")) return
      el.dataset.scrolling = ""
      clearTimeout(timers.get(el))
      timers.set(
        el,
        window.setTimeout(() => delete el.dataset.scrolling, 800),
      )
    },
    { capture: true, passive: true },
  )
}
