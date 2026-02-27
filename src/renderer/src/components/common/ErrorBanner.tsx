import React from 'react'
import { Alert, Button } from 'antd'

interface ErrorBannerProps {
  message: string
  onRetry?: () => void
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <Alert
      type="error"
      message={message}
      style={{ borderRadius: 6 }}
      action={
        onRetry ? (
          <Button size="small" danger onClick={onRetry}>
            Retry
          </Button>
        ) : undefined
      }
      showIcon
    />
  )
}
