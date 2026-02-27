import React, { useState, useEffect } from 'react'
import {
  Modal,
  Steps,
  Form,
  Input,
  Select,
  Switch,
  Button,
  Alert,
  Space,
  Typography,
  Divider
} from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  GoogleOutlined,
  WindowsOutlined,
  CloudOutlined,
  MailOutlined
} from '@ant-design/icons'
import type { Account, AddAccountPayload, EmailProvider } from '@shared/types'
import { useAccounts } from '../../hooks/useAccounts'

const { Text } = Typography

interface AddAccountModalProps {
  open: boolean
  onClose: () => void
  onSuccess: (account: Account) => void
}

type Provider = {
  key: EmailProvider
  label: string
  icon: React.ReactElement
  imapHost: string
  imapPort: number
  imapTls: boolean
  note?: string
}

const PROVIDERS: Provider[] = [
  {
    key: 'gmail',
    label: 'Gmail',
    icon: <GoogleOutlined />,
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    imapTls: true,
    note: 'Google requires an App Password (not your regular password). Enable 2FA in your Google account first, then generate an App Password at myaccount.google.com/apppasswords.'
  },
  {
    key: 'icloud',
    label: 'iCloud Mail',
    icon: <CloudOutlined />,
    imapHost: 'imap.mail.me.com',
    imapPort: 993,
    imapTls: true
  },
  {
    key: 'microsoft365',
    label: 'Microsoft 365',
    icon: <WindowsOutlined />,
    imapHost: 'outlook.office365.com',
    imapPort: 993,
    imapTls: true
  },
  {
    key: 'yahoo',
    label: 'Yahoo Mail',
    icon: <MailOutlined />,
    imapHost: 'imap.mail.yahoo.com',
    imapPort: 993,
    imapTls: true
  },
  {
    key: 'other',
    label: 'Other',
    icon: <MailOutlined />,
    imapHost: '',
    imapPort: 993,
    imapTls: true
  }
]

type TestState = 'idle' | 'testing' | 'success' | 'error'

export function AddAccountModal({ open, onClose, onSuccess }: AddAccountModalProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedProvider, setSelectedProvider] = useState<Provider>(PROVIDERS[0])
  const [form] = Form.useForm<AddAccountPayload>()
  const [testState, setTestState] = useState<TestState>('idle')
  const [testError, setTestError] = useState<string>('')
  const [testMailboxCount, setTestMailboxCount] = useState<number>(0)
  const [submitting, setSubmitting] = useState(false)
  const [pendingPayload, setPendingPayload] = useState<AddAccountPayload | null>(null)

  const { testConnection, addAccount } = useAccounts()

  useEffect(() => {
    if (!open) {
      setCurrentStep(0)
      setSelectedProvider(PROVIDERS[0])
      setTestState('idle')
      setTestError('')
      setPendingPayload(null)
      form.resetFields()
    }
  }, [open, form])

  function handleProviderSelect(provider: Provider) {
    setSelectedProvider(provider)
    form.setFieldsValue({
      provider: provider.key,
      imapHost: provider.imapHost,
      imapPort: provider.imapPort,
      imapTls: provider.imapTls,
      authMethod: 'app_password'
    })
  }

  async function handleStep2Next() {
    try {
      await form.validateFields(['name', 'email', 'imapHost', 'imapPort', 'password'])
      // Snapshot values NOW while the Form is still mounted — it will unmount when we move to step 3
      const values = form.getFieldsValue()
      const payload: AddAccountPayload = {
        name: values.name,
        email: values.email,
        provider: values.provider ?? selectedProvider.key,
        authMethod: values.authMethod ?? 'app_password',
        imapHost: values.imapHost,
        imapPort: values.imapPort,
        imapTls: values.imapTls ?? true,
        password: values.password,
        syncIntervalMinutes: 15
      }
      setPendingPayload(payload)
      setCurrentStep(2)
      runTest(payload)
    } catch {
      // validation failed, stay on step 2
    }
  }

  async function runTest(payload?: AddAccountPayload) {
    const p = payload ?? pendingPayload
    if (!p) return
    setTestState('testing')
    setTestError('')
    try {
      const result = await testConnection(p)
      if (result.success) {
        setTestState('success')
        setTestMailboxCount(result.mailboxCount ?? 0)
      } else {
        setTestState('error')
        setTestError(result.error ?? 'Connection failed')
      }
    } catch (err) {
      setTestState('error')
      setTestError(String(err))
    }
  }

  async function handleAddAccount() {
    if (!pendingPayload) return
    setSubmitting(true)
    try {
      const result = await addAccount(pendingPayload)
      if (result.success && result.data) {
        onSuccess(result.data)
        onClose()
      } else {
        setTestState('error')
        setTestError(result.error ?? 'Failed to add account')
        setCurrentStep(2)
      }
    } catch (err) {
      setTestState('error')
      setTestError(String(err))
      setCurrentStep(2)
    } finally {
      setSubmitting(false)
    }
  }

  const steps = [
    { title: 'Provider' },
    { title: 'Details' },
    { title: 'Connect' }
  ]

  const step1Footer = (
    <Space>
      <Button onClick={onClose}>Cancel</Button>
      <Button
        type="primary"
        onClick={() => {
          handleProviderSelect(selectedProvider)
          setCurrentStep(1)
        }}
      >
        Next
      </Button>
    </Space>
  )

  const step2Footer = (
    <Space>
      <Button onClick={() => setCurrentStep(0)}>Back</Button>
      <Button type="primary" onClick={handleStep2Next}>
        Test Connection
      </Button>
    </Space>
  )

  const step3Footer = (
    <Space>
      <Button onClick={() => setCurrentStep(1)}>Back</Button>
      {testState === 'error' && (
        <Button onClick={() => runTest()}>Retry</Button>
      )}
      <Button
        type="primary"
        disabled={testState !== 'success'}
        loading={submitting}
        onClick={handleAddAccount}
      >
        Add Account
      </Button>
    </Space>
  )

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="Add Email Account"
      footer={
        currentStep === 0 ? step1Footer : currentStep === 1 ? step2Footer : step3Footer
      }
      width={520}
      destroyOnClose
    >
      <Steps
        current={currentStep}
        items={steps}
        size="small"
        style={{ marginBottom: 28 }}
      />

      {/* Step 1: Choose Provider */}
      {currentStep === 0 && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {PROVIDERS.map((provider) => (
              <div
                key={provider.key}
                onClick={() => setSelectedProvider(provider)}
                style={{
                  padding: '14px 16px',
                  borderRadius: 8,
                  border: `2px solid ${selectedProvider.key === provider.key ? '#4f9eff' : '#2a2a2e'}`,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  backgroundColor: selectedProvider.key === provider.key ? '#1a2a3e' : '#1c1c1e',
                  transition: 'all 0.15s ease',
                  color: selectedProvider.key === provider.key ? '#4f9eff' : '#e2e2e2'
                }}
              >
                <span style={{ fontSize: 20 }}>{provider.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{provider.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Connection Details */}
      {currentStep === 1 && (
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            provider: selectedProvider.key,
            imapHost: selectedProvider.imapHost,
            imapPort: selectedProvider.imapPort,
            imapTls: selectedProvider.imapTls,
            authMethod: 'app_password'
          }}
          size="middle"
        >
          {selectedProvider.note && (
            <Alert
              type="info"
              message={selectedProvider.note}
              style={{ marginBottom: 16, fontSize: 12 }}
              showIcon
            />
          )}

          <Form.Item name="provider" hidden>
            <Input />
          </Form.Item>
          <Form.Item name="authMethod" hidden>
            <Input />
          </Form.Item>

          <Form.Item
            label="Display Name"
            name="name"
            rules={[{ required: true, message: 'Enter a name for this account' }]}
          >
            <Input placeholder="e.g. Work Gmail" />
          </Form.Item>

          <Form.Item
            label="Email Address"
            name="email"
            rules={[
              { required: true, message: 'Enter your email address' },
              { type: 'email', message: 'Enter a valid email address' }
            ]}
          >
            <Input placeholder="you@example.com" />
          </Form.Item>

          <Divider style={{ borderColor: '#2a2a2e', margin: '12px 0' }}>
            <Text style={{ fontSize: 12, color: '#a0a0a8' }}>IMAP Settings</Text>
          </Divider>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
            <Form.Item
              label="IMAP Host"
              name="imapHost"
              rules={[{ required: true, message: 'Enter IMAP host' }]}
              style={{ marginBottom: 12 }}
            >
              <Input placeholder="imap.example.com" />
            </Form.Item>

            <Form.Item
              label="Port"
              name="imapPort"
              rules={[{ required: true }]}
              style={{ marginBottom: 12, width: 90 }}
            >
              <Select
                options={[
                  { value: 993, label: '993' },
                  { value: 143, label: '143' }
                ]}
              />
            </Form.Item>
          </div>

          <Form.Item
            label="Use TLS/SSL"
            name="imapTls"
            valuePropName="checked"
            style={{ marginBottom: 12 }}
          >
            <Switch />
          </Form.Item>

          <Form.Item
            label={selectedProvider.key === 'gmail' ? 'App Password' : 'Password'}
            name="password"
            rules={[{ required: true, message: 'Enter your password' }]}
          >
            <Input.Password
              placeholder={
                selectedProvider.key === 'gmail' ? 'App password (16 characters)' : 'Password'
              }
            />
          </Form.Item>
        </Form>
      )}

      {/* Step 3: Test & Confirm */}
      {currentStep === 2 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
            padding: '20px 0'
          }}
        >
          {testState === 'testing' && (
            <>
              <LoadingOutlined style={{ fontSize: 40, color: '#4f9eff' }} />
              <div style={{ color: '#a0a0a8', fontSize: 14 }}>
                Testing connection to {pendingPayload?.imapHost}...
              </div>
            </>
          )}

          {testState === 'success' && (
            <>
              <CheckCircleOutlined style={{ fontSize: 40, color: '#52e05c' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#e2e2e2', fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
                  Connection successful
                </div>
                {testMailboxCount > 0 && (
                  <div style={{ color: '#a0a0a8', fontSize: 13 }}>
                    Found {testMailboxCount} mailbox{testMailboxCount !== 1 ? 'es' : ''}
                  </div>
                )}
              </div>
            </>
          )}

          {testState === 'error' && (
            <>
              <CloseCircleOutlined style={{ fontSize: 40, color: '#ff5f5f' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#ff5f5f', fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
                  Connection failed
                </div>
                <div style={{ color: '#a0a0a8', fontSize: 13, maxWidth: 340 }}>{testError}</div>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
