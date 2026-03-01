import React, { useState, useEffect, useRef } from 'react'
import { Modal, Progress } from 'antd'
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

  const [rebuildVisible, setRebuildVisible] = useState(false)
  const [rebuildCurrent, setRebuildCurrent] = useState(0)
  const [rebuildTotal, setRebuildTotal] = useState(0)
  const [rebuildDone, setRebuildDone] = useState(false)
  const rebuildProgressUnsubRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        openSearch()
      }
    }
    document.addEventListener('keydown', handleKeyDown)

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

    const unsubRebuild = window.mailtap.on('menu:rebuild-index' as string, () => {
      setRebuildCurrent(0)
      setRebuildTotal(0)
      setRebuildDone(false)
      setRebuildVisible(true)

      const unsubProgress = window.mailtap.on('rebuild:progress', ({ current, total }) => {
        setRebuildCurrent(current)
        setRebuildTotal(total)
      })
      rebuildProgressUnsubRef.current = unsubProgress

      window.mailtap.invoke('rebuild:trigger').then(() => {
        setRebuildDone(true)
        if (rebuildProgressUnsubRef.current) {
          rebuildProgressUnsubRef.current()
          rebuildProgressUnsubRef.current = null
        }
      })
    })

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      unsubToggleSidebar()
      unsubAddAccount()
      unsubSyncAll()
      unsubSearch()
      unsubRebuild()
    }
  }, [toggleSidebar, openSearch])

  const rebuildPercent =
    rebuildTotal > 0 ? Math.round((rebuildCurrent / rebuildTotal) * 100) : (rebuildDone ? 100 : 0)

  const handleRebuildClose = () => {
    if (rebuildDone) {
      setRebuildVisible(false)
    }
  }

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

      <Modal
        title="Rebuilding Search Index"
        open={rebuildVisible}
        footer={rebuildDone ? undefined : null}
        closable={rebuildDone}
        maskClosable={false}
        onOk={handleRebuildClose}
        onCancel={handleRebuildClose}
        okText="Close"
      >
        <div style={{ padding: '8px 0' }}>
          <Progress
            percent={rebuildPercent}
            status={rebuildDone ? 'success' : 'active'}
            strokeColor="#4f9eff"
          />
          <div style={{ marginTop: 8, color: '#999', fontSize: 13 }}>
            {rebuildDone
              ? `Done — ${rebuildTotal} message${rebuildTotal !== 1 ? 's' : ''} indexed.`
              : rebuildTotal > 0
                ? `Processing ${rebuildCurrent} / ${rebuildTotal}…`
                : 'Scanning mail files…'}
          </div>
        </div>
      </Modal>
    </div>
  )
}
