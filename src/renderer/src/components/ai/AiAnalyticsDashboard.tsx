import React, { useState, useEffect } from 'react'
import { Modal, Skeleton, Empty, Row, Col, Card, Table, Tag, Statistic, Progress, message, Button, Space } from 'antd'
import { AlertOutlined, ReloadOutlined } from '@ant-design/icons'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { LabelCount, TimeSeriesPoint, SenderStat, ThreatSummary, SentimentCount } from '@shared/types'

interface AiAnalyticsDashboardProps {
  visible: boolean
  onClose: () => void
}

export function AiAnalyticsDashboard({ visible, onClose }: AiAnalyticsDashboardProps) {
  const [loading, setLoading] = useState(false)
  const [classifying, setClassifying] = useState(false)
  const [classification, setClassification] = useState<LabelCount[]>([])
  const [volume, setVolume] = useState<TimeSeriesPoint[]>([])
  const [senders, setSenders] = useState<SenderStat[]>([])
  const [threats, setThreats] = useState<ThreatSummary | null>(null)
  const [sentiment, setSentiment] = useState<SentimentCount[]>([])

  useEffect(() => {
    if (visible) {
      loadAnalytics()
    }
  }, [visible])

  const loadAnalytics = async () => {
    try {
      setLoading(true)

      const [classData, volData, senderData, threatData, sentimentData] = await Promise.all([
        window.mailtap.invoke('ai:analytics-classification'),
        window.mailtap.invoke('ai:analytics-volume', undefined, 'day', 30),
        window.mailtap.invoke('ai:analytics-senders', 10),
        window.mailtap.invoke('ai:analytics-threats', 30),
        window.mailtap.invoke('ai:analytics-sentiment')
      ])

      setClassification(classData)
      setVolume(volData)
      setSenders(senderData)
      setThreats(threatData)
      setSentiment(sentimentData)
    } catch (err) {
      message.error('Failed to load analytics')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleReclassify = async () => {
    try {
      setClassifying(true)
      message.loading({ content: 'Re-classifying all emails...', duration: 0, key: 'reclassify' })

      await window.mailtap.invoke('ai:classify-batch')

      message.success({ content: 'Classification complete! Refreshing analytics...', duration: 2, key: 'reclassify' })

      // Reload analytics after classification completes
      await new Promise(resolve => setTimeout(resolve, 1000))
      await loadAnalytics()
    } catch (err) {
      message.error('Failed to re-classify emails')
      console.error(err)
    } finally {
      setClassifying(false)
    }
  }

  return (
    <Modal
      title="Email Analytics"
      open={visible}
      onCancel={onClose}
      width={1200}
      footer={
        <Space>
          <Button onClick={onClose}>Close</Button>
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={handleReclassify}
            loading={classifying}
            disabled={loading}
          >
            Re-run Classification
          </Button>
        </Space>
      }
      bodyStyle={{ maxHeight: '80vh', overflowY: 'auto' }}
    >
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <Card title="Security Overview" size="small">
            <Skeleton paragraph={{ rows: 4 }} />
          </Card>
          <Card title="Message Classification" size="small">
            <Skeleton paragraph={{ rows: 3 }} />
          </Card>
          <Card title="Sentiment Distribution" size="small">
            <Skeleton paragraph={{ rows: 3 }} />
          </Card>
          <Card title="Most Active Senders" size="small">
            <Skeleton paragraph={{ rows: 5 }} />
          </Card>
        </div>
      ) : (
        <>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Threat Summary */}
          {threats && (
            <Card title="Security Overview" size="small">
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={8}>
                  <Statistic
                    title="Total Threats Detected"
                    value={threats.totalThreats}
                    prefix={<AlertOutlined />}
                    valueStyle={{ color: threats.totalThreats > 0 ? '#ff4d4f' : '#52c41a' }}
                  />
                </Col>
                <Col xs={24} sm={8}>
                  <Statistic
                    title="High Risk"
                    value={threats.highRisk}
                    suffix={`/ ${threats.totalThreats}`}
                    valueStyle={{ color: '#ff4d4f' }}
                  />
                </Col>
                <Col xs={24} sm={8}>
                  <Statistic
                    title="Medium Risk"
                    value={threats.mediumRisk}
                    suffix={`/ ${threats.totalThreats}`}
                    valueStyle={{ color: '#faad14' }}
                  />
                </Col>
              </Row>

              {threats.details.length > 0 && (
                <Table
                  dataSource={threats.details}
                  columns={[
                    {
                      title: 'Subject',
                      dataIndex: 'subject',
                      key: 'subject',
                      ellipsis: true
                    },
                    {
                      title: 'From',
                      dataIndex: 'fromEmail',
                      key: 'fromEmail',
                      width: 150
                    },
                    {
                      title: 'Risk Level',
                      dataIndex: 'threatScore',
                      key: 'threatScore',
                      width: 120,
                      render: (score: number) => {
                        const percent = Math.round(score * 100)
                        return (
                          <Tag color={percent > 70 ? 'red' : 'orange'}>
                            {percent}%
                          </Tag>
                        )
                      }
                    }
                  ]}
                  rowKey="id"
                  pagination={{ pageSize: 5 }}
                  size="small"
                  style={{ marginTop: 16 }}
                />
              )}
            </Card>
          )}

          {/* Classification Breakdown */}
          {classification.length > 0 ? (
            <Card title="Message Classification" size="small">
              <Row gutter={[16, 16]}>
                {classification.slice(0, 6).map((item) => (
                  <Col xs={12} sm={8} key={item.label}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                        {item.label}
                      </div>
                      <Progress
                        type="circle"
                        percent={item.percentage}
                        width={80}
                        format={(pct) => `${pct}%`}
                      />
                      <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                        {item.count} message{item.count !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </Col>
                ))}
              </Row>
            </Card>
          ) : (
            <Empty description="No classification data yet" />
          )}

          {/* Sentiment Distribution */}
          {sentiment.length > 0 && (
            <Card title="Sentiment Distribution" size="small">
              <Row gutter={[16, 16]}>
                {sentiment.map((item) => (
                  <Col xs={24} sm={12} key={item.sentiment}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13 }}>{item.sentiment}</span>
                      <span style={{ color: '#666', fontSize: 12 }}>
                        {item.count} ({item.percentage}%)
                      </span>
                    </div>
                    <Progress percent={item.percentage} size="small" showInfo={false} />
                  </Col>
                ))}
              </Row>
            </Card>
          )}

          {/* Top Senders */}
          {senders.length > 0 && (
            <Card title="Most Active Senders" size="small">
              <Table
                dataSource={senders}
                columns={[
                  {
                    title: 'Sender',
                    dataIndex: 'email',
                    key: 'email',
                    render: (email: string, record: SenderStat) => (
                      <div>
                        <div>{email}</div>
                        {record.name !== email && (
                          <div style={{ fontSize: 11, color: '#999' }}>{record.name}</div>
                        )}
                      </div>
                    )
                  },
                  {
                    title: 'Messages',
                    dataIndex: 'count',
                    key: 'count',
                    width: 100,
                    align: 'center' as const
                  },
                  {
                    title: 'Avg Spam Score',
                    dataIndex: 'avgSpamScore',
                    key: 'avgSpamScore',
                    width: 150,
                    render: (score: number) => {
                      const percent = Math.round(score * 100)
                      return (
                        <Tag color={percent > 50 ? 'red' : percent > 20 ? 'orange' : 'green'}>
                          {percent}%
                        </Tag>
                      )
                    }
                  }
                ]}
                rowKey="email"
                pagination={{ pageSize: 10 }}
                size="small"
              />
            </Card>
          )}

          {/* Volume Trend */}
          {volume.length > 0 && (
            <Card title="Message Volume (Last 30 Days)" size="small">
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={volume}
                    margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2e" />
                    <XAxis
                      dataKey="date"
                      stroke="#a0a0a8"
                      style={{ fontSize: 12 }}
                      tick={{ fill: '#a0a0a8' }}
                    />
                    <YAxis
                      stroke="#a0a0a8"
                      style={{ fontSize: 12 }}
                      tick={{ fill: '#a0a0a8' }}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1c1c1e',
                        border: '1px solid #2a2a2e',
                        borderRadius: 4,
                        color: '#e2e2e2'
                      }}
                      labelStyle={{ color: '#e2e2e2' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#4f9eff"
                      strokeWidth={2}
                      dot={{ fill: '#4f9eff', r: 4 }}
                      activeDot={{ r: 6 }}
                      isAnimationActive={true}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </div>
        </>
      )}
    </Modal>
  )
}
