import React, { useEffect, useState } from 'react'
import logoSrc from '../../assets/image/logo.png'

const DESKTOP_ACCESS_QUERY = '(min-width: 900px), (hover: hover) and (pointer: fine)'
const TOUCH_POINTER_QUERY = '(pointer: coarse)'

function canAccessSystem() {
  if (typeof window === 'undefined') return true

  const desktopQuery = window.matchMedia(DESKTOP_ACCESS_QUERY)
  return desktopQuery.matches && !isPhoneLikeScreen()
}

function isPhoneLikeScreen() {
  const shortestScreenSide = Math.min(
    window.screen?.width || window.innerWidth,
    window.screen?.height || window.innerHeight,
  )
  const hasTouchPointer = window.matchMedia(TOUCH_POINTER_QUERY).matches || navigator.maxTouchPoints > 0

  return (
    window.innerWidth < 768 ||
    (hasTouchPointer && window.innerHeight < 540) ||
    (hasTouchPointer && shortestScreenSide < 700)
  )
}

export function ScreenAccessGuard({ children }) {
  const [isAllowed, setIsAllowed] = useState(canAccessSystem)

  useEffect(() => {
    const desktopQuery = window.matchMedia(DESKTOP_ACCESS_QUERY)
    const updateAccess = () => setIsAllowed(canAccessSystem())

    desktopQuery.addEventListener('change', updateAccess)
    window.addEventListener('resize', updateAccess)
    window.addEventListener('orientationchange', updateAccess)
    updateAccess()

    return () => {
      desktopQuery.removeEventListener('change', updateAccess)
      window.removeEventListener('resize', updateAccess)
      window.removeEventListener('orientationchange', updateAccess)
    }
  }, [])

  if (isAllowed) return children

  return (
    <section className="device-access-blocker" role="alert" aria-live="assertive">
      <div className="device-access-panel">
        <img className="device-access-logo" src={logoSrc} alt="CPMS" />
        <h1>Desktop Access Required</h1>
        <p>
          This system is available on laptop or larger screens only. Please open CPMS on a
          laptop, desktop, or external display.
        </p>
      </div>
    </section>
  )
}
