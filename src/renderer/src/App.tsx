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
