import React, { useEffect } from 'react'
import { ConfigProvider, App as AntApp, theme } from 'antd'
import { darkTheme } from './theme'
import { AppLayout } from './components/layout/AppLayout'

export default function App(): React.ReactElement {
  useEffect(() => {
    // Ensure no scrollbars on body/html by removing default margins
    document.documentElement.style.margin = '0'
    document.documentElement.style.padding = '0'
    document.body.style.margin = '0'
    document.body.style.padding = '0'

    // Add global scrollbar styling
    const style = document.createElement('style')
    style.textContent = `
      ::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }

      ::-webkit-scrollbar-track {
        background: transparent;
      }

      ::-webkit-scrollbar-thumb {
        background: #404047;
        border-radius: 4px;
        transition: background-color 0.2s;
      }

      ::-webkit-scrollbar-thumb:hover {
        background: #52525a;
      }

      ::-webkit-scrollbar-thumb:active {
        background: #5f5f67;
      }
    `
    document.head.appendChild(style)
  }, [])

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        ...darkTheme
      }}
    >
      <AntApp>
        <AppLayout />
      </AntApp>
    </ConfigProvider>
  )
}
