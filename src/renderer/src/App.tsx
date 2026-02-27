import React from 'react'
import { ConfigProvider, App as AntApp, theme } from 'antd'
import { darkTheme } from './theme'
import { AppLayout } from './components/layout/AppLayout'

export default function App(): React.ReactElement {
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
