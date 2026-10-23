import * as React from "react"

const MOBILE_BREAKPOINT = 768

// The server and first client render assume `serverValue`, then follow the media query.
export function useMediaQuery(query: string, serverValue = false) {
  return React.useSyncExternalStore(
    (notify) => {
      const mql = window.matchMedia(query)
      mql.addEventListener("change", notify)
      return () => mql.removeEventListener("change", notify)
    },
    () => window.matchMedia(query).matches,
    () => serverValue
  )
}

export function useIsMobile() {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
}
