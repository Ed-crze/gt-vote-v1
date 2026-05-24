type InactivityOptions = {
  timeoutMs: number
  onTimeout: () => void
}

export function startInactivityTimer({ timeoutMs, onTimeout }: InactivityOptions) {
  let timer: NodeJS.Timeout

  function reset() {
    clearTimeout(timer)
    timer = setTimeout(onTimeout, timeoutMs)
  }

  const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
  events.forEach(event => window.addEventListener(event, reset, { passive: true }))

  reset()

  return () => {
    clearTimeout(timer)
    events.forEach(event => window.removeEventListener(event, reset))
  }
}