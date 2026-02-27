import React, { useState, useEffect } from 'react'
import { Modal, Table, Button, Space, Tag, Empty, message, Popconfirm } from 'antd'
import { LogoutOutlined } from '@ant-design/icons'
import { useAiStore } from '../../store/aiStore'
import type { Subscription, IpcResult } from '@shared/types'

interface SubscriptionManagerProps {
  visible: boolean
  onClose: () => void
}

export function SubscriptionManager({ visible, onClose }: SubscriptionManagerProps) {
  const { subscriptions, setSubscriptions } = useAiStore()
  const [loading, setLoading] = useState(false)
  const [unsubscribeLoading, setUnsubscribeLoading] = useState<string | null>(null)

  useEffect(() => {
    if (visible) {
      loadSubscriptions()
    }
  }, [visible])

  const loadSubscriptions = async () => {
    try {
      setLoading(true)
      const subs = await window.mailtap.invoke('ai:list-subscriptions')
      setSubscriptions(subs)
    } catch (err) {
      message.error('Failed to load subscriptions')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleUnsubscribe = async (subscription: Subscription) => {
    try {
      setUnsubscribeLoading(subscription.id)
      const result = (await window.mailtap.invoke('ai:unsubscribe', subscription.id)) as IpcResult
      if (result.success) {
        message.success(`Unsubscribed from ${subscription.fromEmail}`)
        loadSubscriptions()
      } else {
        message.error(result.error || 'Failed to unsubscribe')
      }
    } catch (err) {
      message.error('Failed to unsubscribe')
      console.error(err)
    } finally {
      setUnsubscribeLoading(null)
    }
  }

  const handleMute = async (subscriptionId: string) => {
    try {
      await window.mailtap.invoke('ai:mute-subscription', subscriptionId)
      message.success('Subscription muted')
      loadSubscriptions()
    } catch (err) {
      message.error('Failed to mute subscription')
      console.error(err)
    }
  }

  const columns = [
    {
      title: 'Sender',
      dataIndex: 'fromEmail',
      key: 'fromEmail',
      render: (email: string, record: Subscription) => (
        <div>
          <div>{email}</div>
          {record.fromName && <div style={{ fontSize: 12, color: '#999' }}>{record.fromName}</div>}
        </div>
      ),
      width: '30%'
    },
    {
      title: 'Messages',
      dataIndex: 'messageCount',
      key: 'messageCount',
      align: 'center' as const,
      width: '10%'
    },
    {
      title: 'Last Received',
      dataIndex: 'lastSeenAt',
      key: 'lastSeenAt',
      render: (timestamp: number) => {
        const date = new Date(timestamp)
        return date.toLocaleDateString()
      },
      width: '15%'
    },
    {
      title: 'Status',
      dataIndex: 'isMuted',
      key: 'isMuted',
      render: (isMuted: boolean) => (
        <Tag color={isMuted ? 'warning' : 'green'}>
          {isMuted ? 'Muted' : 'Active'}
        </Tag>
      ),
      width: '10%'
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: Subscription) => (
        <Space>
          {!record.isMuted && (
            <Popconfirm
              title="Unsubscribe"
              description={`Are you sure you want to unsubscribe from ${record.fromEmail}?`}
              onConfirm={() => handleUnsubscribe(record)}
              okText="Yes"
              cancelText="No"
            >
              <Button
                type="text"
                danger
                size="small"
                loading={unsubscribeLoading === record.id}
                icon={<LogoutOutlined />}
              >
                Unsubscribe
              </Button>
            </Popconfirm>
          )}
          {record.isMuted && (
            <Button
              type="text"
              size="small"
              onClick={() => handleMute(record.id)}
            >
              Unmute
            </Button>
          )}
        </Space>
      ),
      width: '25%'
    }
  ]

  return (
    <Modal
      title="Subscriptions & Newsletters"
      open={visible}
      onCancel={onClose}
      width={900}
      footer={<Button onClick={onClose}>Close</Button>}
    >
      {subscriptions.length === 0 ? (
        <Empty description="No subscriptions detected" />
      ) : (
        <Table
          columns={columns}
          dataSource={subscriptions}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          size="small"
        />
      )}
    </Modal>
  )
}
