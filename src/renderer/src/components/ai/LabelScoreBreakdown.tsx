import React from 'react'
import { Progress, Tag } from 'antd'

const SECURITY_LABELS = new Set(['phishing', 'spam', 'security alert'])

interface LabelScoreBreakdownProps {
  labels: Record<string, number>
  sentiment?: string | null
}

export function LabelScoreBreakdown({ labels, sentiment }: LabelScoreBreakdownProps) {
  const sorted = Object.entries(labels).sort((a, b) => b[1] - a[1])

  if (sorted.length === 0) {
    return <div style={{ color: '#999', fontSize: 12 }}>No label data</div>
  }

  return (
    <div style={{ padding: '4px 0' }}>
      {sorted.map(([label, score]) => {
        const percent = Math.round(score * 100)
        const isSecurity = SECURITY_LABELS.has(label)
        const color = isSecurity
          ? percent > 70
            ? '#ff4d4f'
            : '#fa8c16'
          : '#4f9eff'

        return (
          <div
            key={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4
            }}
          >
            <span
              style={{
                width: 120,
                fontSize: 12,
                color: isSecurity ? '#ff7875' : '#d9d9d9',
                flexShrink: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {label}
            </span>
            <Progress
              percent={percent}
              size="small"
              showInfo={false}
              strokeColor={color}
              trailColor="#2a2a2e"
              style={{ flex: 1, margin: 0 }}
            />
            <span style={{ width: 40, fontSize: 11, color: '#999', textAlign: 'right', flexShrink: 0 }}>
              {percent}%
            </span>
          </div>
        )
      })}
      {sentiment && (
        <div style={{ marginTop: 6 }}>
          <Tag
            color={sentiment === 'POSITIVE' ? 'green' : sentiment === 'NEGATIVE' ? 'red' : 'default'}
            style={{ fontSize: 11 }}
          >
            {sentiment}
          </Tag>
        </div>
      )}
    </div>
  )
}
