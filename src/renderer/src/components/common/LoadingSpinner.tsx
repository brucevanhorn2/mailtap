import React from 'react'
import { Spin } from 'antd'

interface LoadingSpinnerProps {
  tip?: string
  size?: 'small' | 'default' | 'large'
}

export function LoadingSpinner({ tip, size = 'default' }: LoadingSpinnerProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        minHeight: 80,
        flexDirection: 'column',
        gap: 12
      }}
    >
      <Spin size={size} tip={tip} />
    </div>
  )
}
