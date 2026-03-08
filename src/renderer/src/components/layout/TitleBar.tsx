import React, { useEffect } from 'react'
import { Button, Dropdown, Space, message } from 'antd'
import { MinusOutlined, BorderOutlined, CloseOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'

interface TitleBarProps {
  icon?: React.ReactNode
}

export function TitleBar({ icon }: TitleBarProps) {
  const isMac = navigator.platform.includes('Mac')

  // Update the loading notification with live progress from the main process
  useEffect(() => {
    return window.mailtap.on('ai:classification-progress', (...args) => {
      const progress = args[0] as { current: number; total: number; phase: string }
      if (progress.total > 0) {
        message.loading({
          content: `${progress.phase}: ${progress.current} / ${progress.total}`,
          duration: 0,
          key: 'reclassify'
        })
      }
    })
  }, [])

  // Window control handlers
  const handleMinimize = () => {
    window.mailtap.invoke('window:minimize')
  }

  const handleMaximize = () => {
    window.mailtap.invoke('window:maximize')
  }

  const handleClose = () => {
    window.mailtap.invoke('window:close')
  }

  // File menu
  const fileMenuItems: MenuProps['items'] = [
    {
      key: 'compose',
      label: 'New Message...',
      onClick: () => window.dispatchEvent(new CustomEvent('mailtap:compose'))
    },
    { type: 'divider' },
    {
      key: 'add-account',
      label: 'Add Account...',
      onClick: () => window.dispatchEvent(new CustomEvent('mailtap:add-account'))
    },
    { type: 'divider' },
    {
      key: 'quit',
      label: isMac ? 'Quit MailTap' : 'Exit',
      onClick: handleClose
    }
  ]

  const handleReclassify = async () => {
    message.loading({ content: 'Re-classifying all emails…', duration: 0, key: 'reclassify' })
    try {
      await window.mailtap.invoke('ai:classify-batch')
      message.success({ content: 'Classification complete!', duration: 2, key: 'reclassify' })
      window.dispatchEvent(new CustomEvent('mailtap:analytics-refresh'))
    } catch {
      message.error({ content: 'Re-classification failed', duration: 3, key: 'reclassify' })
    }
  }

  // Sync menu
  const syncMenuItems: MenuProps['items'] = [
    {
      key: 'sync-all',
      label: 'Sync All Accounts',
      onClick: () => window.dispatchEvent(new CustomEvent('mailtap:sync-all'))
    },
    {
      key: 'sync-stop',
      label: 'Stop Sync',
      onClick: () => window.mailtap.invoke('sync:stop')
    },
    { type: 'divider' },
    {
      key: 'reclassify',
      label: 'Re-run Classification',
      onClick: handleReclassify
    }
  ]

  // View menu
  const viewMenuItems: MenuProps['items'] = [
    {
      key: 'search',
      label: 'Search',
      onClick: () => window.dispatchEvent(new CustomEvent('mailtap:focus-search'))
    },
    {
      key: 'toggle-sidebar',
      label: 'Toggle Sidebar',
      onClick: () => window.dispatchEvent(new CustomEvent('mailtap:toggle-sidebar'))
    },
    { type: 'divider' },
    {
      key: 'analytics',
      label: 'Email Analytics',
      onClick: () => window.dispatchEvent(new CustomEvent('mailtap:show-dashboard'))
    },
    { type: 'divider' },
    {
      key: 'zoom-in',
      label: 'Zoom In',
      onClick: () => window.mailtap.invoke('app:zoom-in')
    },
    {
      key: 'zoom-out',
      label: 'Zoom Out',
      onClick: () => window.mailtap.invoke('app:zoom-out')
    },
    {
      key: 'reset-zoom',
      label: 'Reset Zoom',
      onClick: () => window.mailtap.invoke('app:reset-zoom')
    }
  ]

  // Help menu
  const helpMenuItems: MenuProps['items'] = [
    {
      key: 'rebuild-index',
      label: 'Rebuild Search Index',
      onClick: () => window.dispatchEvent(new CustomEvent('mailtap:rebuild-index'))
    },
    { type: 'divider' },
    {
      key: 'learn-more',
      label: 'Learn More',
      onClick: () => window.mailtap.invoke('app:open-url', 'https://github.com/brucevanhorn2/mailtap')
    }
  ]

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 40,
        backgroundColor: '#0f0f10',
        borderBottom: '1px solid #2a2a2e',
        paddingLeft: 12,
        paddingRight: 12,
        gap: 12,
        userSelect: 'none'
      }}
    >
      {/* Title + Icon - far left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: '#e2e2e2', flexShrink: 0 }}>
        {icon && <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{icon}</div>}
        MailTap
      </div>

      {/* Menu items - center-left */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}
      >
        <Dropdown menu={{ items: fileMenuItems }} trigger={['click']}>
          <Button type="text" size="small" style={{ color: '#e2e2e2', fontSize: 13, padding: '4px 10px' }}>
            Accounts
          </Button>
        </Dropdown>

        <Dropdown menu={{ items: syncMenuItems }} trigger={['click']}>
          <Button type="text" size="small" style={{ color: '#e2e2e2', fontSize: 13, padding: '4px 10px' }}>
            Sync
          </Button>
        </Dropdown>

        <Dropdown menu={{ items: viewMenuItems }} trigger={['click']}>
          <Button type="text" size="small" style={{ color: '#e2e2e2', fontSize: 13, padding: '4px 10px' }}>
            View
          </Button>
        </Dropdown>

        <Dropdown menu={{ items: helpMenuItems }} trigger={['click']}>
          <Button type="text" size="small" style={{ color: '#e2e2e2', fontSize: 13, padding: '4px 10px' }}>
            Help
          </Button>
        </Dropdown>
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Window controls - far right */}
      {!isMac && (
        <Space size={0}>
          <Button
            type="text"
            size="small"
            icon={<MinusOutlined />}
            onClick={handleMinimize}
            style={{ color: '#a0a0a8', width: 32, height: 32, padding: 0 }}
          />
          <Button
            type="text"
            size="small"
            icon={<BorderOutlined />}
            onClick={handleMaximize}
            style={{ color: '#a0a0a8', width: 32, height: 32, padding: 0 }}
          />
          <Button
            type="text"
            size="small"
            icon={<CloseOutlined />}
            onClick={handleClose}
            style={{ color: '#a0a0a8', width: 32, height: 32, padding: 0 }}
          />
        </Space>
      )}

    </div>
  )
}
