import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      const newIsMobile = window.innerWidth < MOBILE_BREAKPOINT
      console.log('📱 isMobile changed:', {
        windowWidth: window.innerWidth,
        breakpoint: MOBILE_BREAKPOINT,
        isMobile: newIsMobile
      })
      setIsMobile(newIsMobile)
    }
    mql.addEventListener("change", onChange)
    const initialIsMobile = window.innerWidth < MOBILE_BREAKPOINT
    console.log('📱 useIsMobile initial:', {
      windowWidth: window.innerWidth,
      breakpoint: MOBILE_BREAKPOINT,
      isMobile: initialIsMobile
    })
    setIsMobile(initialIsMobile)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  console.log('📱 useIsMobile hook returning:', !!isMobile)
  return !!isMobile
}
