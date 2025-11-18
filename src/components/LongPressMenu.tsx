import React, { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn, isCapacitorIOS } from '../lib/utils'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

export interface LongPressMenuItem {
  key: string
  label?: React.ReactNode
  icon?: React.ReactNode
  onClick?: () => void
  node?: React.ReactNode
}

export interface LongPressMenuProps {
  items: LongPressMenuItem[]
  children: React.ReactNode
  pressDuration?: number
  moveThreshold?: number
  enableHaptics?: boolean
  className?: string
  startDelay?: number
}

export const LongPressMenu: React.FC<LongPressMenuProps> = ({
  items,
  children,
  pressDuration = 450,
  moveThreshold = 10,
  enableHaptics = true,
  className,
  startDelay = 80
}) => {
  const targetRef = useRef<HTMLDivElement | null>(null)
  const timerRef = useRef<number | null>(null)
  const guardTimerRef = useRef<number | null>(null)
  const startPosRef = useRef<{ x: number, y: number } | null>(null)
  const guardOkRef = useRef<boolean>(true)
  const docTouchMoveHandlerRef = useRef<(e: TouchEvent) => void | null>(null)
  const docTouchEndHandlerRef = useRef<(e: TouchEvent) => void | null>(null)
  const [open, setOpen] = useState(false)
  const [entered, setEntered] = useState(false)
  const [origin, setOrigin] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'>('top-right')
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({})
  const [floatingStyle, setFloatingStyle] = useState<React.CSSProperties>({})
  const menuRef = useRef<HTMLDivElement | null>(null)
  const instanceIdRef = useRef<string>(Math.random().toString(36).slice(2))
  const OPEN_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'
  const CLOSE_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)'
  const OPEN_SCALE_START = 0.6
  const OPEN_SCALE_PEAK = 1

  const clearTimer = (reason?: string) => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (guardTimerRef.current) {
      window.clearTimeout(guardTimerRef.current)
      guardTimerRef.current = null
    }
    startPosRef.current = null
    if (docTouchMoveHandlerRef.current) {
      document.removeEventListener('touchmove', docTouchMoveHandlerRef.current as EventListener)
      docTouchMoveHandlerRef.current = null
    }
    if (docTouchEndHandlerRef.current) {
      document.removeEventListener('touchend', docTouchEndHandlerRef.current as EventListener)
      document.removeEventListener('touchcancel', docTouchEndHandlerRef.current as EventListener)
      docTouchEndHandlerRef.current = null
    }
    console.warn('[LongPressMenu] clearTimer', { reason, ts: Date.now() })
  }

  const computePosition = () => {
    const el = targetRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const offset = 16
    const approxW = menuRef.current?.offsetWidth || 180
    const approxH = menuRef.current?.offsetHeight || 160
    const spaceBelow = vh - rect.bottom
    const spaceRight = vw - rect.right
    const spaceLeft = rect.left
    const openUp = spaceBelow < (approxH + offset) && rect.top > (approxH + offset)
    let alignStart = false
    if (spaceRight >= (approxW + offset)) {
      alignStart = false
    } else if (spaceLeft >= (approxW + offset)) {
      alignStart = true
    } else {
      alignStart = spaceRight < spaceLeft
    }
    const topCandidate = openUp ? (rect.top - offset - approxH) : (rect.bottom + offset)
    let leftCandidate = alignStart ? (rect.left - approxW) : (rect.right)
    if (leftCandidate + approxW > vw - 8) {
      leftCandidate = Math.max(8, rect.right - approxW)
    }
    if (leftCandidate < 8) {
      leftCandidate = Math.min(vw - approxW - 8, rect.left)
    }
    setMenuStyle({
      position: 'fixed',
      top: Math.max(8, Math.min(vh - approxH - 8, topCandidate)),
      left: Math.max(8, Math.min(vw - approxW - 8, leftCandidate)),
      zIndex: 1001
    })
    setFloatingStyle({
      position: 'fixed',
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      zIndex: 1002,
      pointerEvents: 'none'
    })
    if (openUp && alignStart) setOrigin('bottom-left')
    else if (openUp && !alignStart) setOrigin('bottom-right')
    else if (!openUp && alignStart) setOrigin('top-left')
    else setOrigin('top-right')
  }

  const openMenu = () => {
    computePosition()
    setOpen(true)
    setEntered(false)
    window.dispatchEvent(new CustomEvent('longpressmenu:open', { detail: { id: instanceIdRef.current } }))
    if (enableHaptics && isCapacitorIOS()) {
      try { Haptics.impact({ style: ImpactStyle.Light }) } catch {}
    }
    console.warn('[LongPressMenu] openMenu', { ts: Date.now() })
  }

  const closeMenu = () => {
    setEntered(false)
    window.setTimeout(() => setOpen(false), 160)
    console.warn('[LongPressMenu] closeMenu', { ts: Date.now() })
  }

  useEffect(() => {
    const onScrollOrResize = () => { if (open) computePosition() }
    window.addEventListener('resize', onScrollOrResize)
    window.addEventListener('scroll', onScrollOrResize, true)
    if (open) {
      requestAnimationFrame(() => { computePosition(); setEntered(true) })
    }
    const onGlobalOpen = (e: Event) => {
      const ev = e as CustomEvent
      if (ev.detail?.id && ev.detail.id !== instanceIdRef.current) {
        setOpen(false)
      }
    }
    window.addEventListener('longpressmenu:open', onGlobalOpen as EventListener)
    // 全局选择/上下文菜单抑制，避免文本选择与放大镜
    let prevBodyUserSelect: string | undefined
    let prevBodyWebkitUserSelect: string | undefined
    let prevBodyWebkitTouchCallout: string | undefined
    let prevBodyOverflow: string | undefined
    let prevHtmlOverscroll: string | undefined
    let prevBodyOverscroll: string | undefined
    let prevBodyTouchAction: string | undefined
    const preventDefault = (e: Event) => e.preventDefault()
    const preventDefaultPassiveFalse = (e: Event) => { e.preventDefault() }
    if (open) {
      prevBodyUserSelect = document.body.style.userSelect
      prevBodyWebkitUserSelect = (document.body.style as any).webkitUserSelect
      prevBodyWebkitTouchCallout = (document.body.style as any).webkitTouchCallout
      prevBodyOverflow = document.body.style.overflow
      prevHtmlOverscroll = (document.documentElement.style as any).overscrollBehavior
      prevBodyOverscroll = (document.body.style as any).overscrollBehavior
      prevBodyTouchAction = (document.body.style as any).touchAction
      document.body.style.userSelect = 'none'
      ;(document.body.style as any).webkitUserSelect = 'none'
      ;(document.body.style as any).webkitTouchCallout = 'none'
      document.body.style.overflow = 'hidden'
      ;(document.documentElement.style as any).overscrollBehavior = 'contain'
      ;(document.body.style as any).overscrollBehavior = 'contain'
      ;(document.body.style as any).touchAction = 'none'
      document.addEventListener('selectstart', preventDefault, { capture: true })
      document.addEventListener('contextmenu', preventDefault, { capture: true })
      document.addEventListener('dragstart', preventDefault, { capture: true })
      document.addEventListener('touchmove', preventDefaultPassiveFalse as EventListener, { capture: true, passive: false })
      document.addEventListener('wheel', preventDefaultPassiveFalse as EventListener, { capture: true, passive: false })
    }
    return () => {
      window.removeEventListener('resize', onScrollOrResize)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('longpressmenu:open', onGlobalOpen as EventListener)
      if (open) {
        document.removeEventListener('selectstart', preventDefault, { capture: true } as any)
        document.removeEventListener('contextmenu', preventDefault, { capture: true } as any)
        document.removeEventListener('dragstart', preventDefault, { capture: true } as any)
        document.removeEventListener('touchmove', preventDefaultPassiveFalse as EventListener, { capture: true } as any)
        document.removeEventListener('wheel', preventDefaultPassiveFalse as EventListener, { capture: true } as any)
        document.body.style.userSelect = prevBodyUserSelect || ''
        ;(document.body.style as any).webkitUserSelect = prevBodyWebkitUserSelect || ''
        ;(document.body.style as any).webkitTouchCallout = prevBodyWebkitTouchCallout || ''
        document.body.style.overflow = prevBodyOverflow || ''
        ;(document.documentElement.style as any).overscrollBehavior = prevHtmlOverscroll || ''
        ;(document.body.style as any).overscrollBehavior = prevBodyOverscroll || ''
        ;(document.body.style as any).touchAction = prevBodyTouchAction || ''
      }
    }
  }, [open])

  useEffect(() => {
    const el = menuRef.current
    if (!el) return
    if (open && entered) {
      el.style.willChange = 'transform, opacity'
      el.style.transition = 'none'
      el.style.transform = `scale(${OPEN_SCALE_START})`
      el.style.opacity = '0'
      void el.offsetWidth
      el.style.transition = `transform 220ms ${OPEN_EASING}, opacity 220ms ${OPEN_EASING}`
      requestAnimationFrame(() => {
        el.style.transform = `scale(${OPEN_SCALE_PEAK})`
        el.style.opacity = '1'
        window.setTimeout(() => {
          el.style.transition = 'transform 80ms ease-out'
          el.style.transform = 'scale(1)'
        }, 220)
      })
    } else if (open && !entered) {
      el.style.willChange = 'transform, opacity'
      el.style.transition = `transform 180ms ${CLOSE_EASING}, opacity 180ms ${CLOSE_EASING}`
      el.style.transform = `scale(${OPEN_SCALE_START})`
      el.style.opacity = '0'
    }
  }, [open, entered])

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 1) return
    clearTimer('touchstart')
    const t = e.touches[0]
    startPosRef.current = { x: t.clientX, y: t.clientY }
    guardOkRef.current = true
    guardTimerRef.current = window.setTimeout(() => {
      if (guardOkRef.current) {
        console.warn('[LongPressMenu] guard passed, schedule longpress', { pressDuration, startDelay, ts: Date.now() })
        timerRef.current = window.setTimeout(() => { console.warn('[LongPressMenu] longpress timer fired'); openMenu(); clearTimer('timer fired') }, Math.max(0, pressDuration - startDelay))
      }
    }, startDelay)
    // 全局跟踪手指滑动，避免仅在子元素触发时才收到事件
    docTouchMoveHandlerRef.current = (ev: TouchEvent) => {
      const first = ev.touches[0]
      if (!first || !startPosRef.current) return
      const dx = Math.abs(first.clientX - startPosRef.current.x)
      const dy = Math.abs(first.clientY - startPosRef.current.y)
      const exceed = dx > moveThreshold || dy > moveThreshold
      console.warn('[LongPressMenu] doc touchmove', { dx, dy, moveThreshold, exceed, ts: Date.now() })
      if (exceed) {
        guardOkRef.current = false
        clearTimer('move exceed')
      }
    }
    docTouchEndHandlerRef.current = () => {
      console.warn('[LongPressMenu] doc touchend/cancel', { ts: Date.now() })
      clearTimer('doc touchend/cancel')
    }
    document.addEventListener('touchmove', docTouchMoveHandlerRef.current as EventListener, { passive: true })
    document.addEventListener('touchend', docTouchEndHandlerRef.current as EventListener)
    document.addEventListener('touchcancel', docTouchEndHandlerRef.current as EventListener)
    console.warn('[LongPressMenu] touchstart', { startPos: startPosRef.current, startDelay, pressDuration, ts: Date.now() })
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (!startPosRef.current) return
    const t = e.touches[0]
    const dx = Math.abs(t.clientX - startPosRef.current.x)
    const dy = Math.abs(t.clientY - startPosRef.current.y)
    const exceed = dx > moveThreshold || dy > moveThreshold
    console.warn('[LongPressMenu] component touchmove', { dx, dy, moveThreshold, exceed, ts: Date.now() })
    if (exceed) {
      guardOkRef.current = false
      clearTimer('component move exceed')
    }
  }
  const onTouchEnd = () => { clearTimer('component touchend') }
  const onTouchCancel = () => { clearTimer('component touchcancel') }

  const onMouseDown = (e: React.MouseEvent) => {
    startPosRef.current = { x: e.clientX, y: e.clientY }
    clearTimer('mousedown')
    guardOkRef.current = true
    guardTimerRef.current = window.setTimeout(() => {
      if (guardOkRef.current) {
        console.warn('[LongPressMenu] mouse guard passed, schedule longpress', { pressDuration, startDelay, ts: Date.now() })
        timerRef.current = window.setTimeout(() => { console.warn('[LongPressMenu] mouse longpress timer fired'); openMenu(); clearTimer('mouse timer fired') }, Math.max(0, pressDuration - startDelay))
      }
    }, startDelay)
  }
  const onMouseUp = () => { clearTimer('mouseup') }
  const onMouseLeave = () => { clearTimer('mouseleave') }

  return (
    <div
      ref={targetRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onContextMenu={(e) => e.preventDefault()}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      onDrop={(e) => e.preventDefault()}
      className={cn('', className)}
      style={{ WebkitUserSelect: 'none' as any }}
    >
      {children}
      {open && createPortal(
        <>
          <div
            className="fixed inset-0 z-[1000] bg-black"
            style={{ opacity: entered ? 0.3 : 0, transition: 'opacity 150ms ease' }}
            onClick={closeMenu}
          />
          <div style={floatingStyle} className="z-[1001]">
            <div
              className="transform transition-transform transition-shadow shadow-lg bg-base-100 rounded-[var(--radius-box)]"
              style={{ pointerEvents: 'none', transform: entered ? 'scale(1.03)' : 'scale(1)', opacity: entered ? 1 : 0, transition: 'transform 150ms ease, opacity 150ms ease' }}
            >
              {children}
            </div>
          </div>
          <div style={menuStyle} className="z-[1002]">
            <div
              className={cn('menu p-3 shadow bg-base-100 rounded-box w-44 transition gap-1', origin.startsWith('top') ? 'origin-top' : 'origin-bottom')}
              style={{ transform: `scale(${OPEN_SCALE_START})`, opacity: 0 }}
              ref={(el) => {
                menuRef.current = el
                if (!el) return
              }}
            >
              {items.map(it => (
                it.node ? (
                  <div key={it.key} className="w-full">
                    {it.node}
                  </div>
                ) : (
                  <button key={it.key} className="text-base w-full px-3 h-9 text-left flex items-center gap-3 rounded-[var(--radius-box)] active:bg-base-300" onClick={() => { it.onClick?.(); closeMenu(); }}>
                    {it.icon}
                    {it.label && <span>{it.label}</span>}
                  </button>
                )
              ))}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

export default LongPressMenu