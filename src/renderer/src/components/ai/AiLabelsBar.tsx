import React from 'react'
import { Tag, Tooltip, Space } from 'antd'
import { AlertOutlined } from '@ant-design/icons'

interface AiLabelsBarProps {
  labels?: Record<string, number> | null
  threatScore?: number | null
  isNewsletter?: boolean
  threatThreshold?: number
}

export function AiLabelsBar({
  labels,
  threatScore,
  isNewsletter,
  threatThreshold = 0.5
}: AiLabelsBarProps) {
  if (!labels && !threatScore && !isNewsletter) {
    return null
  }

  const topLabels = labels
    ? Object.entries(labels)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .filter(([, score]) => score > 0.3)
    : []

  return (
    <Space size="small" wrap style={{ marginTop: 4 }}>
      {/* Threat warning */}
      {threatScore && threatScore > threatThreshold && (
        <Tooltip title={`Security risk: ${(threatScore * 100).toFixed(0)}%`}>
          <Tag icon={<AlertOutlined />} color="red">
            Threat
          </Tag>
        </Tooltip>
      )}

      {/* Newsletter badge */}
      {isNewsletter && <Tag color="blue">Newsletter</Tag>}

      {/* Top classification labels */}
      {topLabels.map(([label, score]) => (
        <Tooltip key={label} title={`${(score * 100).toFixed(0)}% confidence`}>
          <Tag color="default">{label}</Tag>
        </Tooltip>
      ))}
    </Space>
  )
}
