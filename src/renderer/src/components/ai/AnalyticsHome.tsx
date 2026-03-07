import React, { useState, useEffect } from 'react'
import { Skeleton, Empty, Card, Statistic, Tooltip, message } from 'antd'
import { FilterOutlined, InfoCircleOutlined } from '@ant-design/icons'
import {
  PieChart,
  Pie,
  Cell,
  Treemap,
  Tooltip as RechartsTooltip,
  ResponsiveContainer
} from 'recharts'
import type { LabelCount, SenderStat, ThreatSummary, SentimentCount, AccountStats, StorageStat } from '@shared/types'
import { useAccountStore } from '../../store/accountStore'

// ─── Color palettes ───────────────────────────────────────────────────────────

// Colorful but no red/green/yellow (those are reserved for warning states)
const CLASSIFICATION_COLORS = [
  '#4f9eff', // blue
  '#9b5de5', // purple
  '#0bc5ea', // cyan
  '#f687b3', // pink
  '#ed8936', // orange
  '#667eea', // indigo
  '#4fd1c5', // teal
  '#b794f4', // lavender
  '#f6ad55', // amber
  '#a78bfa', // violet
  '#6366f1', // cornflower
  '#e879f9'  // magenta
]

const SENTIMENT_CONFIG: Record<string, { color: string; label: string }> = {
  POSITIVE: { color: '#52c41a', label: 'Positive' },
  NEGATIVE: { color: '#ff4d4f', label: 'Negative' },
  NEUTRAL:  { color: '#d4b896', label: 'Neutral' }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNumber(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString()
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

/** Blue → Purple → Red based on spam score 0–1 */
function spamColor(score: number): string {
  if (score <= 0.5) {
    const t = score * 2
    const r = Math.round(79  + t * (139 - 79))
    const g = Math.round(158 + t * (92  - 158))
    const b = Math.round(255 + t * (246 - 255))
    return `rgb(${r},${g},${b})`
  } else {
    const t = (score - 0.5) * 2
    const r = Math.round(139 + t * (255 - 139))
    const g = Math.round(92  + t * (77  - 92))
    const b = Math.round(246 + t * (79  - 246))
    return `rgb(${r},${g},${b})`
  }
}

// ─── Donut center overlay ─────────────────────────────────────────────────────

function DonutCenter({ total, label }: { total: number; label: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none'
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#e2e2e2', lineHeight: 1.2 }}>
          {formatNumber(total)}
        </div>
        <div style={{ fontSize: 11, color: '#a0a0a8', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  )
}

// ─── Shared donut tooltip style ───────────────────────────────────────────────

const TOOLTIP_STYLE = {
  backgroundColor: '#1c1c1e',
  border: '1px solid #2a2a2e',
  borderRadius: 4,
  color: '#e2e2e2',
  fontSize: 12
}

// ─── Clickable card title helper ──────────────────────────────────────────────

function ClickableTitle({ text, tip }: { text: string; tip: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {text}
      <Tooltip title={tip}>
        <FilterOutlined style={{ fontSize: 11, color: '#6a6a72', cursor: 'default' }} />
      </Tooltip>
    </span>
  )
}

// ─── Sender word cloud ────────────────────────────────────────────────────────

function WordItem({
  email, fontSize, opacity, count, onClick
}: {
  email: string; fontSize: number; opacity: number; count: number; onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <Tooltip title={`${formatNumber(count)} messages — click to filter`}>
      <span
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          fontSize,
          color: '#4f9eff',
          opacity: hovered ? 1 : opacity,
          cursor: 'pointer',
          textDecoration: hovered ? 'underline' : 'none',
          transition: 'opacity 0.15s',
          whiteSpace: 'nowrap',
          fontWeight: fontSize > 20 ? 600 : 400,
          userSelect: 'none'
        }}
      >
        {email}
      </span>
    </Tooltip>
  )
}

function WordCloud({
  senders,
  onFilterBySender
}: {
  senders: SenderStat[]
  onFilterBySender: (email: string) => void
}) {
  const maxCount = Math.max(...senders.map((s) => s.count), 1)
  const minCount = Math.min(...senders.map((s) => s.count))
  const range = Math.max(maxCount - minCount, 1)

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px 18px',
        alignItems: 'center',
        padding: '4px 2px',
        lineHeight: 1.6
      }}
    >
      {senders.map((sender) => {
        const normalized = (sender.count - minCount) / range
        return (
          <WordItem
            key={sender.email}
            email={sender.email}
            fontSize={11 + normalized * 20}
            opacity={0.5 + normalized * 0.5}
            count={sender.count}
            onClick={() => onFilterBySender(sender.email)}
          />
        )
      })}
    </div>
  )
}

// ─── Spam heatmap treemap cell ─────────────────────────────────────────────────

function SpamCell(props: any) {
  const { x, y, width, height, depth, name, spamScore, count } = props
  // Treemap renders root/branch nodes too — only render leaf cells (depth === 1)
  if (depth !== 1 || !width || !height || width < 2 || height < 2) return null

  const fill = spamColor(spamScore ?? 0)
  const localPart = typeof name === 'string' ? name.split('@')[0] : ''
  const showLabel = width > 40 && height > 18
  const showCount = width > 80 && height > 36

  return (
    <g style={{ cursor: 'pointer' }}>
      <title>{name ?? ''} · {formatNumber(count)} msgs · spam: {Math.round((spamScore ?? 0) * 100)}%</title>
      <rect
        x={x + 1}
        y={y + 1}
        width={Math.max(width - 2, 0)}
        height={Math.max(height - 2, 0)}
        fill={fill}
        fillOpacity={0.85}
        rx={3}
      />
      {showLabel && (
        <text
          x={x + width / 2}
          y={y + height / 2 + (showCount ? -7 : 4)}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="white"
          fontSize={Math.min(12, Math.max(9, width / 8))}
          fontWeight={500}
          style={{ userSelect: 'none' }}
        >
          {localPart}
        </text>
      )}
      {showCount && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 10}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="rgba(255,255,255,0.65)"
          fontSize={Math.min(10, Math.max(8, width / 10))}
          style={{ userSelect: 'none' }}
        >
          {formatNumber(count)}
        </text>
      )}
    </g>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

interface AnalyticsHomeProps {
  onFilterByLabel: (label: string) => void
  onFilterByThreat: (level: 'high' | 'medium') => void
  onFilterBySender: (email: string) => void
  onFilterByDate: (timestamp: number) => void
}

export function AnalyticsHome({
  onFilterByLabel,
  onFilterByThreat,
  onFilterBySender
}: AnalyticsHomeProps) {
  const accounts = useAccountStore((s) => s.accounts)

  const [loading, setLoading] = useState(true)
  const [classification, setClassification] = useState<LabelCount[]>([])
  const [senders, setSenders] = useState<SenderStat[]>([])
  const [threats, setThreats] = useState<ThreatSummary | null>(null)
  const [sentiment, setSentiment] = useState<SentimentCount[]>([])
  const [accountStats, setAccountStats] = useState<AccountStats[]>([])
  const [storageStats, setStorageStats] = useState<StorageStat[]>([])

  const loadAnalytics = async () => {
    try {
      setLoading(true)
      const [classData, senderData, threatData, sentimentData, statsData, storageData] = await Promise.all([
        window.mailtap.invoke('ai:analytics-classification'),
        window.mailtap.invoke('ai:analytics-senders', 50),
        window.mailtap.invoke('ai:analytics-threats', 30),
        window.mailtap.invoke('ai:analytics-sentiment'),
        window.mailtap.invoke('ai:analytics-account-stats'),
        window.mailtap.invoke('ai:analytics-storage')
      ])
      setClassification(classData)
      setSenders(senderData)
      setThreats(threatData)
      setSentiment(sentimentData)
      setAccountStats(statsData)
      setStorageStats(storageData as StorageStat[])
    } catch (err) {
      message.error('Failed to load analytics')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    loadAnalytics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Refresh when TitleBar triggers reclassify completion
  useEffect(() => {
    const handler = () => loadAnalytics()
    window.addEventListener('mailtap:analytics-refresh', handler)
    return () => window.removeEventListener('mailtap:analytics-refresh', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Derived data ─────────────────────────────────────────────────────────

  const totalStats = accountStats.reduce(
    (acc, s) => ({
      totalAll:   acc.totalAll   + s.totalAll,
      total30d:   acc.total30d   + s.total30d,
      total7d:    acc.total7d    + s.total7d,
      totalToday: acc.totalToday + s.totalToday
    }),
    { totalAll: 0, total30d: 0, total7d: 0, totalToday: 0 }
  )

  const safeCount = Math.max(
    0,
    (threats?.totalThreats ?? 0) - (threats?.highRisk ?? 0) - (threats?.mediumRisk ?? 0)
  )
  const threatDonutData = [
    { name: 'High Risk',   value: threats?.highRisk   ?? 0, color: '#ff4d4f', key: 'high'   },
    { name: 'Medium Risk', value: threats?.mediumRisk ?? 0, color: '#faad14', key: 'medium' },
    { name: 'Safe',        value: safeCount,                color: '#2a3340', key: 'safe'   }
  ].filter((d) => d.value > 0)

  const classDonutData = classification.map((item, i) => ({
    name:  item.label,
    value: item.count,
    color: CLASSIFICATION_COLORS[i % CLASSIFICATION_COLORS.length]
  }))

  const sentimentDonutData = sentiment.map((item) => ({
    name:  item.sentiment,
    value: item.count,
    color: SENTIMENT_CONFIG[item.sentiment]?.color ?? '#666'
  }))

  const totalThreatClassified = threats?.totalThreats ?? 0
  const totalClassified       = classification.reduce((s, c) => s + c.count, 0)
  const totalSentiment        = sentiment.reduce((s, c) => s + c.count, 0)

  // Storage: message_bytes is the full EML size (already includes attachments).
  // attachment_bytes is a sub-breakdown — not additive with message_bytes.
  const storageTotalBytes      = storageStats.reduce((s, r) => s + r.messageBytes, 0)
  const storageAttachBytes     = storageStats.reduce((s, r) => s + r.attachmentBytes, 0)
  const storageMaxAccountBytes = Math.max(...storageStats.map((r) => r.messageBytes), 1)

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Card size="small"><Skeleton paragraph={{ rows: 2 }} active /></Card>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          <Card size="small"><Skeleton paragraph={{ rows: 4 }} active /></Card>
          <Card size="small"><Skeleton paragraph={{ rows: 4 }} active /></Card>
          <Card size="small"><Skeleton paragraph={{ rows: 4 }} active /></Card>
        </div>
        <Card size="small"><Skeleton paragraph={{ rows: 3 }} active /></Card>
        <Card size="small"><Skeleton paragraph={{ rows: 5 }} active /></Card>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Mail Overview stats ─────────────────────────────────────────── */}
      <Card size="small" title="Mail Overview">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <Statistic
            title="All Time"
            value={totalStats.totalAll}
            formatter={(v) => formatNumber(Number(v) || 0)}
          />
          <Statistic
            title="Last 30 Days"
            value={totalStats.total30d}
            formatter={(v) => formatNumber(Number(v) || 0)}
          />
          <Statistic
            title="Last 7 Days"
            value={totalStats.total7d}
            formatter={(v) => formatNumber(Number(v) || 0)}
          />
          <Statistic
            title="Today"
            value={totalStats.totalToday}
            formatter={(v) => formatNumber(Number(v) || 0)}
          />
        </div>

        {/* Per-account breakdown when multiple accounts present */}
        {accounts.length > 1 && accountStats.length > 0 && (
          <div style={{ marginTop: 16, borderTop: '1px solid #2a2a2e', paddingTop: 12 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 80px 80px 80px 80px',
                gap: 8,
                marginBottom: 6
              }}
            >
              <span style={{ fontSize: 11, color: '#6a6a72' }}>Account</span>
              <span style={{ fontSize: 11, color: '#6a6a72', textAlign: 'right' }}>All Time</span>
              <span style={{ fontSize: 11, color: '#6a6a72', textAlign: 'right' }}>30 days</span>
              <span style={{ fontSize: 11, color: '#6a6a72', textAlign: 'right' }}>7 days</span>
              <span style={{ fontSize: 11, color: '#6a6a72', textAlign: 'right' }}>Today</span>
            </div>
            {accountStats.map((stat) => {
              const account = accounts.find((a) => a.id === stat.accountId)
              if (!account) return null
              return (
                <div
                  key={stat.accountId}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 80px 80px 80px 80px',
                    gap: 8,
                    alignItems: 'center',
                    marginBottom: 4
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: '#a0a0a8',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {account.email}
                  </span>
                  <span style={{ fontSize: 13, textAlign: 'right' }}>{formatNumber(stat.totalAll)}</span>
                  <span style={{ fontSize: 13, textAlign: 'right' }}>{formatNumber(stat.total30d)}</span>
                  <span style={{ fontSize: 13, textAlign: 'right' }}>{formatNumber(stat.total7d)}</span>
                  <span style={{ fontSize: 13, textAlign: 'right' }}>{formatNumber(stat.totalToday)}</span>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* ── Storage stats ───────────────────────────────────────────────── */}
      {storageStats.length > 0 && (
        <Card size="small" title="Storage">
          {/* Totals: attachment bytes are a subset of total, not additive */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
            <Statistic title="Total Disk Used" value={formatBytes(storageTotalBytes)} />
            <Statistic
              title="Of Which: Attachments"
              value={formatBytes(storageAttachBytes)}
            />
            <Statistic
              title="Attachment Share"
              value={storageTotalBytes > 0 ? `${Math.round((storageAttachBytes / storageTotalBytes) * 100)}%` : '0%'}
            />
          </div>

          {/* Per-account bars (stacked: message-only portion + attachment portion) */}
          {storageStats.length > 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid #2a2a2e', paddingTop: 12 }}>
              {storageStats.map((stat) => {
                const account   = accounts.find((a) => a.id === stat.accountId)
                const barPct    = (stat.messageBytes / storageMaxAccountBytes) * 100
                const atchPct   = stat.messageBytes > 0 ? (stat.attachmentBytes  / stat.messageBytes) * 100 : 0
                const bodyPct   = 100 - atchPct

                return (
                  <div key={stat.accountId}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: '#a0a0a8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                        {account?.email ?? stat.accountId}
                      </span>
                      <span style={{ fontSize: 12, color: '#e2e2e2', flexShrink: 0 }}>
                        {formatBytes(stat.messageBytes)}
                      </span>
                    </div>
                    {/* Bar width = relative disk usage; split shows body vs attachment content */}
                    <div style={{ height: 8, borderRadius: 4, backgroundColor: '#2a2a2e', overflow: 'hidden', width: `${barPct}%`, minWidth: 40 }}>
                      <div style={{ display: 'flex', height: '100%' }}>
                        <div style={{ width: `${bodyPct}%`, backgroundColor: '#4f9eff', transition: 'width 0.3s' }} />
                        <div style={{ width: `${atchPct}%`, backgroundColor: '#9b5de5', transition: 'width 0.3s' }} />
                      </div>
                    </div>
                  </div>
                )
              })}
              <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
                <span style={{ fontSize: 11, color: '#4f9eff', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#4f9eff', display: 'inline-block' }} />
                  Message body
                </span>
                <span style={{ fontSize: 11, color: '#9b5de5', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#9b5de5', display: 'inline-block' }} />
                  Attachments
                </span>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── Three donut charts ──────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>

        {/* Security */}
        <Card
          size="small"
          title={<ClickableTitle text="Security" tip="Click segments or labels to filter by threat level" />}
        >
          {threatDonutData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#a0a0a8', fontSize: 13 }}>
              No threats detected
            </div>
          ) : (
            <div style={{ position: 'relative', height: 180 }}>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={threatDonutData}
                    innerRadius={55}
                    outerRadius={78}
                    paddingAngle={2}
                    dataKey="value"
                    onClick={(entry) => {
                      if (entry.key === 'high') onFilterByThreat('high')
                      else if (entry.key === 'medium') onFilterByThreat('medium')
                    }}
                    cursor="pointer"
                  >
                    {threatDonutData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value, name) => [formatNumber(Number(value) || 0), name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <DonutCenter total={totalThreatClassified} label="classified" />
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 8 }}>
            <Tooltip title="Click to filter">
              <span
                onClick={() => onFilterByThreat('high')}
                style={{
                  fontSize: 12,
                  color: '#ff4d4f',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: '#ff4d4f',
                    display: 'inline-block'
                  }}
                />
                High: {formatNumber(threats?.highRisk ?? 0)}
              </span>
            </Tooltip>
            <Tooltip title="Click to filter">
              <span
                onClick={() => onFilterByThreat('medium')}
                style={{
                  fontSize: 12,
                  color: '#faad14',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: '#faad14',
                    display: 'inline-block'
                  }}
                />
                Medium: {formatNumber(threats?.mediumRisk ?? 0)}
              </span>
            </Tooltip>
          </div>
        </Card>

        {/* Classification */}
        <Card
          size="small"
          title={<ClickableTitle text="Classification" tip="Click segments or labels to filter" />}
        >
          {classDonutData.length === 0 ? (
            <Empty description="No classification data yet" />
          ) : (
            <div style={{ position: 'relative', height: 180 }}>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={classDonutData}
                    innerRadius={55}
                    outerRadius={78}
                    paddingAngle={2}
                    dataKey="value"
                    onClick={(entry) => onFilterByLabel(entry.name)}
                    cursor="pointer"
                  >
                    {classDonutData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value, name) => [formatNumber(Number(value) || 0), name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <DonutCenter total={totalClassified} label="classified" />
            </div>
          )}
          {classDonutData.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px 12px',
                justifyContent: 'center',
                marginTop: 4
              }}
            >
              {classDonutData.slice(0, 8).map((item) => (
                <Tooltip key={item.name} title="Click to filter">
                  <span
                    onClick={() => onFilterByLabel(item.name)}
                    style={{
                      fontSize: 11,
                      color: item.color,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        backgroundColor: item.color,
                        display: 'inline-block',
                        flexShrink: 0
                      }}
                    />
                    {item.name}
                  </span>
                </Tooltip>
              ))}
            </div>
          )}
        </Card>

        {/* Sentiment */}
        <Card
          size="small"
          title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              Sentiment
              <Tooltip title="Positive, negative and neutral tone across classified emails">
                <InfoCircleOutlined style={{ fontSize: 11, color: '#6a6a72', cursor: 'default' }} />
              </Tooltip>
            </span>
          }
        >
          {sentimentDonutData.length === 0 ? (
            <Empty description="No sentiment data yet" />
          ) : (
            <div style={{ position: 'relative', height: 180 }}>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={sentimentDonutData}
                    innerRadius={55}
                    outerRadius={78}
                    paddingAngle={2}
                    dataKey="value"
                    cursor="default"
                  >
                    {sentimentDonutData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value, name) => [
                      formatNumber(value as number),
                      SENTIMENT_CONFIG[name as string]?.label ?? name
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <DonutCenter total={totalSentiment} label="analyzed" />
            </div>
          )}
          {sentimentDonutData.length > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 16,
                marginTop: 6,
                flexWrap: 'wrap'
              }}
            >
              {sentimentDonutData.map((item) => (
                <span
                  key={item.name}
                  style={{
                    fontSize: 12,
                    color: item.color,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: item.color,
                      display: 'inline-block'
                    }}
                  />
                  {SENTIMENT_CONFIG[item.name]?.label ?? item.name}: {formatNumber(item.value)}
                </span>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Sender word cloud ────────────────────────────────────────────── */}
      {senders.length > 0 && (
        <Card
          size="small"
          title={
            <ClickableTitle
              text="Active Senders"
              tip="Size reflects email volume. Click any address to filter your inbox."
            />
          }
        >
          <WordCloud senders={senders} onFilterBySender={onFilterBySender} />
        </Card>
      )}

      {/* ── Spam score heatmap ───────────────────────────────────────────── */}
      {senders.length > 0 && (
        <Card
          size="small"
          title={
            <ClickableTitle
              text="Spam Score by Sender"
              tip="Cell size = email volume. Color = average spam score. Click to filter."
            />
          }
        >
          {/* Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 10 }}>
            {[
              { label: 'Low spam',    color: '#4f9eff' },
              { label: 'Suspicious', color: '#8b5cf6' },
              { label: 'High spam',  color: '#ff4d4f' }
            ].map(({ label, color }) => (
              <span
                key={label}
                style={{ fontSize: 11, color, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 2,
                    backgroundColor: color,
                    display: 'inline-block'
                  }}
                />
                {label}
              </span>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <Treemap
              data={senders.map((s) => ({
                name:      s.email,
                size:      s.count,
                spamScore: s.avgSpamScore,
                count:     s.count
              }))}
              dataKey="size"
              content={<SpamCell />}
              onClick={(entry) => {
                if (entry?.name) onFilterBySender(entry.name as string)
              }}
              style={{ cursor: 'pointer' }}
            />
          </ResponsiveContainer>
        </Card>
      )}

    </div>
  )
}
