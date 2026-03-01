import React, { useState, useEffect } from 'react'
import { Progress } from 'antd'
import { BgColorsOutlined } from '@ant-design/icons'
import { useAiStore } from '../../store/aiStore'

interface ClassificationProgressEvent {
  current: number
  total: number
  phase: string
}

export function AiStatusBar() {
  const { enabled } = useAiStore()
  const [progress, setProgress] = useState<ClassificationProgressEvent | null>(null)

  useEffect(() => {
    if (!enabled) {
      return
    }

    const unsub = window.mailtap.on('ai:classification-progress', (event) => {
      setProgress(event as ClassificationProgressEvent)
    })

    return () => unsub()
  }, [enabled])

  if (!enabled) {
    return (
      <div
        style={{
          padding: '8px 12px',
          borderTop: '1px solid #333',
          fontSize: 12,
          color: '#666'
        }}
      >
        AI Disabled
      </div>
    )
  }

  if (progress && progress.total > 0) {
    const percent = Math.round((progress.current / progress.total) * 100)
    return (
      <div
        style={{
          padding: '8px 12px',
          borderTop: '1px solid #333',
          display: 'flex',
          flexDirection: 'column',
          gap: 6
        }}
      >
        <div style={{ fontSize: 12, color: '#999' }}>
          {progress.phase}
        </div>
        <Progress
          percent={percent}
          size="small"
          strokeColor="#4f9eff"
          format={(pct) => `${pct}%`}
        />
        <div style={{ fontSize: 11, color: '#666' }}>
          {progress.current} / {progress.total}
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        padding: '8px 12px',
        borderTop: '1px solid #333',
        fontSize: 12,
        color: '#4f9eff',
        display: 'flex',
        alignItems: 'center',
        gap: 6
      }}
    >
      <BgColorsOutlined style={{ fontSize: 14 }} />
      AI Ready
    </div>
  )
}
