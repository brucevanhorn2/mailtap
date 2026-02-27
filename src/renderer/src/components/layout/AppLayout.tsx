import React, { useState, useEffect } from 'react'
import { useUiStore } from '../../store/uiStore'
import { useSearchStore } from '../../store/searchStore'
import { AccountSidebar } from './AccountSidebar'
import { MailListPane } from './MailListPane'
import { MailViewerPane } from './MailViewerPane'
import { SearchBar } from '../search/SearchBar'

interface PaneDividerProps {
  current: number
  onResize: (width: number) => void
  min: number
  max: number
}

function PaneDivider({ current, onResize, min, max }: PaneDividerProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)

    const startX = e.clientX
    const startWidth = current

    // Full-screen overlay prevents iframe from stealing mouse events during drag
    const overlay = document.createElement('div')
    overlay.style.cssText =
      'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;cursor:col-resize'
    document.body.appendChild(overlay)
    document.body.style.userSelect = 'none'

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX
      const newWidth = Math.min(max, Math.max(min, startWidth + delta))
      onResize(newWidth)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.body.removeChild(overlay)
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: 4,
        flexShrink: 0,
        cursor: 'col-resize',
        backgroundColor: isDragging || isHovered ? '#4f9eff55' : 'transparent',
        transition: isDragging ? 'none' : 'background-color 0.15s',
        position: 'relative',
        zIndex: 10
      }}
    />
  )
}

export function AppLayout() {
  const { sidebarVisible, sidebarWidth, setSidebarWidth, mailListWidth, setMailListWidth, toggleSidebar } =
    useUiStore()
  const { openSearch } = useSearchStore()

  useEffect(() => {
    const unsubToggleSidebar = window.mailtap.on('menu:toggle-sidebar' as string, () => {
      toggleSidebar()
    })

    const unsubAddAccount = window.mailtap.on('menu:add-account' as string, () => {
      window.dispatchEvent(new CustomEvent('mailtap:add-account'))
    })

    const unsubSyncAll = window.mailtap.on('menu:sync-all' as string, () => {
      window.dispatchEvent(new CustomEvent('mailtap:sync-all'))
    })

    const unsubSearch = window.mailtap.on('menu:search' as string, () => {
      openSearch()
    })

    return () => {
      unsubToggleSidebar()
      unsubAddAccount()
      unsubSyncAll()
      unsubSearch()
    }
  }, [toggleSidebar, openSearch])

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        backgroundColor: '#141414'
      }}
    >
      {sidebarVisible && (
        <>
          <div style={{ width: sidebarWidth, flexShrink: 0, height: '100%', overflow: 'hidden' }}>
            <AccountSidebar />
          </div>
          <PaneDivider current={sidebarWidth} onResize={setSidebarWidth} min={160} max={400} />
        </>
      )}

      <div style={{ width: mailListWidth, flexShrink: 0, height: '100%', overflow: 'hidden' }}>
        <MailListPane />
      </div>
      <PaneDivider current={mailListWidth} onResize={setMailListWidth} min={240} max={560} />

      <div style={{ flex: 1, height: '100%', minWidth: 0, overflow: 'hidden' }}>
        <MailViewerPane />
      </div>

      <SearchBar />
    </div>
  )
}
