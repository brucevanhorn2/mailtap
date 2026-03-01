import React from 'react'
import { Button, Dropdown, Space } from 'antd'
import { MinusOutlined, BorderOutlined, CloseOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'

export function TitleBar() {
  const isMac = navigator.platform.includes('Mac')

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
      onClick: () => window.mailtap.invoke('app:open-url', 'https://github.com/mailtap-app/mailtap')
    }
  ]

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 40,
        backgroundColor: '#0f0f10',
        borderBottom: '1px solid #2a2a2e',
        paddingLeft: 12,
        paddingRight: 12,
        gap: 8,
        userSelect: 'none'
      }}
    >
      {/* Menu items - left side */}
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

      {/* Title - center */}
      <div style={{ flex: 1, textAlign: 'center', fontSize: 13, color: '#a0a0a8' }}>
        MailTap
      </div>

      {/* Window controls - right side */}
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
