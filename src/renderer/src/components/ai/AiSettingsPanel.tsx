import React, { useState, useEffect } from 'react'
import {
  Form,
  Switch,
  Slider,
  Input,
  Select,
  Button,
  Space,
  Card,
  Row,
  Col,
  message,
  Tag,
  Progress,
  Tooltip
} from 'antd'
import { DownloadOutlined, InfoCircleOutlined, DeleteOutlined, RobotOutlined, CheckCircleOutlined } from '@ant-design/icons'
import { useAiStore } from '../../store/aiStore'
import type { AiModelInfo, IpcResult } from '@shared/types'

export function AiSettingsPanel() {
  const { enabled, setEnabled, settings, setSettings, models, setModels, modelDownloadProgress } =
    useAiStore()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [modelLoading, setModelLoading] = useState<Record<string, boolean>>({})

  useEffect(() => {
    loadSettings()
    loadModels()
  }, [])

  useEffect(() => {
    if (settings) {
      form.setFieldsValue(settings)
    }
  }, [settings, form])

  const loadSettings = async () => {
    try {
      const aiSettings = await window.mailtap.invoke('ai:get-settings')
      setSettings(aiSettings)
      setEnabled(aiSettings.enabled)
    } catch (err) {
      message.error('Failed to load AI settings')
      console.error(err)
    }
  }

  const loadModels = async () => {
    try {
      const modelList = await window.mailtap.invoke('ai:list-models')
      setModels(modelList)
    } catch (err) {
      message.error('Failed to load models')
      console.error(err)
    }
  }

  const handleSave = async (values: any) => {
    try {
      setLoading(true)
      const result = (await window.mailtap.invoke('ai:save-settings', values)) as IpcResult
      if (result.success) {
        message.success('Settings saved')
        setSettings(values)
      } else {
        message.error(result.error || 'Failed to save settings')
      }
    } catch (err) {
      message.error('Failed to save settings')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleAi = async (checked: boolean) => {
    try {
      const result = await window.mailtap.invoke('ai:enable', checked)
      if (result.success) {
        setEnabled(checked)
        message.success(checked ? 'AI enabled' : 'AI disabled')
      } else {
        message.error(result.error || 'Failed to toggle AI')
      }
    } catch (err) {
      message.error('Failed to toggle AI')
      console.error(err)
    }
  }

  const handleDownloadModel = async (modelId: string) => {
    try {
      setModelLoading((prev) => ({ ...prev, [modelId]: true }))
      const result = await window.mailtap.invoke('ai:download-model', modelId)
      if (result.success) {
        message.success(`Downloaded ${modelId}`)
        loadModels()
      } else {
        message.error(result.error || 'Failed to download model')
      }
    } catch (err) {
      message.error('Failed to download model')
      console.error(err)
    } finally {
      setModelLoading((prev) => ({ ...prev, [modelId]: false }))
    }
  }

  const handleDeleteModel = async (modelId: string) => {
    try {
      setModelLoading((prev) => ({ ...prev, [modelId]: true }))
      const result = await window.mailtap.invoke('ai:delete-model', modelId)
      if (result.success) {
        message.success(`Deleted ${modelId}`)
        loadModels()
      } else {
        message.error(result.error || 'Failed to delete model')
      }
    } catch (err) {
      message.error('Failed to delete model')
      console.error(err)
    } finally {
      setModelLoading((prev) => ({ ...prev, [modelId]: false }))
    }
  }

  const [llmInitLoading, setLlmInitLoading] = useState(false)
  const [llmReady, setLlmReady] = useState(false)

  const handleInitLlm = async () => {
    if (!settings?.llmModelId) {
      message.warning('Select an LLM model first')
      return
    }
    const llmModel = models.find((m) => m.id === settings.llmModelId)
    if (!llmModel?.isDownloaded || !llmModel.localPath) {
      message.error('Download the LLM model first')
      return
    }
    try {
      setLlmInitLoading(true)
      const result = await window.mailtap.invoke('ai:init-llm', llmModel.localPath)
      if (result.success) {
        setLlmReady(true)
        message.success('LLM initialized — Ask AI is ready!')
      } else {
        message.error(result.error || 'Failed to initialize LLM')
      }
    } catch (err) {
      message.error('Failed to initialize LLM')
      console.error(err)
    } finally {
      setLlmInitLoading(false)
    }
  }

  const tier1Models = models.filter((m) => m.tier === 1)
  const tier2Models = models.filter((m) => m.tier === 2)
  const llmModels = models.filter((m) => m.modelType === 'llm')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Main AI Toggle */}
      <Card title="Enable AI Features" size="small">
        <Row gutter={16}>
          <Col>
            <span>AI Features: </span>
            <Switch checked={enabled} onChange={handleToggleAi} />
          </Col>
          <Col>
            {enabled && <Tag color="green">Enabled</Tag>}
            {!enabled && <Tag>Disabled</Tag>}
          </Col>
        </Row>
      </Card>

      {/* Settings Form */}
      {enabled && settings && (
        <Card title="AI Settings" size="small">
          <Form form={form} layout="vertical" onFinish={handleSave}>
            <Form.Item label="Auto-Classify Messages" name="autoClassify" valuePropName="checked">
              <Switch />
            </Form.Item>

            <Form.Item label="Auto-Embed Messages" name="autoEmbed" valuePropName="checked">
              <Switch />
            </Form.Item>

            <Form.Item
              label={
                <span>
                  Spam Score Threshold{' '}
                  <Tooltip title="Messages above this score are marked as spam">
                    <InfoCircleOutlined />
                  </Tooltip>
                </span>
              }
              name="spamThreshold"
              getValueFromEvent={(v) => v / 100}
              getValueProps={(v) => ({ value: (v ?? 0) * 100 })}
            >
              <Slider min={0} max={100} step={5} marks={{ 0: '0%', 50: '50%', 100: '100%' }} />
            </Form.Item>

            <Form.Item
              label={
                <span>
                  Threat Score Threshold{' '}
                  <Tooltip title="Messages above this score trigger a security warning">
                    <InfoCircleOutlined />
                  </Tooltip>
                </span>
              }
              name="threatThreshold"
              getValueFromEvent={(v) => v / 100}
              getValueProps={(v) => ({ value: (v ?? 0) * 100 })}
            >
              <Slider min={0} max={100} step={5} marks={{ 0: '0%', 50: '50%', 100: '100%' }} />
            </Form.Item>

            <Form.Item
              label={
                <span>
                  Label Confidence Threshold{' '}
                  <Tooltip title="AI labels below this confidence score are ignored">
                    <InfoCircleOutlined />
                  </Tooltip>
                </span>
              }
              name="labelMinScore"
              getValueFromEvent={(v) => v / 100}
              getValueProps={(v) => ({ value: (v ?? 0) * 100 })}
            >
              <Slider min={0} max={100} step={5} marks={{ 0: '0%', 50: '50%', 100: '100%' }} />
            </Form.Item>

            <Form.Item
              label="Custom Classification Labels (comma-separated)"
              name="customLabels"
              getValueFromEvent={(e) =>
                typeof e === 'string' ? e.split(',').map((s) => s.trim()) : e
              }
              getValueProps={(value) => ({ value: Array.isArray(value) ? value.join(', ') : '' })}
            >
              <Input placeholder="e.g., potential client, legal document, personal" />
            </Form.Item>

            {llmModels.length > 0 && (
              <Form.Item label="LLM Model (for Ask AI)" name="llmModelId">
                <Select
                  placeholder="Select a downloaded LLM model"
                  options={llmModels
                    .filter((m) => m.isDownloaded)
                    .map((m) => ({ label: m.displayName, value: m.id }))}
                />
              </Form.Item>
            )}

            <Space>
              <Button type="primary" loading={loading} onClick={() => form.submit()}>
                Save Settings
              </Button>
            </Space>
          </Form>
        </Card>
      )}

      {/* Models */}
      <Card title="AI Models" size="small">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Tier 1 Models */}
          {tier1Models.length > 0 && (
            <div>
              <h4 style={{ marginBottom: 12, color: '#666' }}>Tier 1: Included (Auto-Downloaded)</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tier1Models.map((model) => (
                  <ModelCard
                    key={model.id}
                    model={model}
                    loading={modelLoading[model.id] ?? false}
                    progress={modelDownloadProgress[model.id]}
                    onDownload={() => handleDownloadModel(model.id)}
                    onDelete={() => handleDeleteModel(model.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Tier 2 Models */}
          {tier2Models.length > 0 && (
            <div>
              <h4 style={{ marginBottom: 12, color: '#666' }}>
                Tier 2: Large Models (Manual Download)
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {tier2Models.map((model) => (
                  <ModelCard
                    key={model.id}
                    model={model}
                    loading={modelLoading[model.id] ?? false}
                    progress={modelDownloadProgress[model.id]}
                    onDownload={() => handleDownloadModel(model.id)}
                    onDelete={() => handleDeleteModel(model.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* LLM Activation */}
      {enabled && llmModels.length > 0 && (
        <Card
          title={
            <span>
              <RobotOutlined style={{ marginRight: 8, color: '#4f9eff' }} />
              Ask AI (LLM)
            </span>
          }
          size="small"
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ fontSize: 13, color: '#999' }}>
              Select an LLM model in Settings above, save, then click Initialize to activate Ask AI
              and message summarization.
            </div>
            <Space>
              <Button
                type="primary"
                icon={<RobotOutlined />}
                loading={llmInitLoading}
                onClick={handleInitLlm}
                disabled={!settings?.llmModelId}
              >
                Initialize LLM
              </Button>
              {llmReady && (
                <Tag color="green" icon={<CheckCircleOutlined />}>
                  Ready
                </Tag>
              )}
            </Space>
          </Space>
        </Card>
      )}
    </div>
  )
}

interface ModelCardProps {
  model: AiModelInfo
  loading: boolean
  progress?: number
  onDownload: () => void
  onDelete: () => void
}

function ModelCard({ model, loading, progress, onDownload, onDelete }: ModelCardProps) {
  const sizeInGb = (model.sizeBytes / 1024 / 1024 / 1024).toFixed(2)
  const sizeInMb = (model.sizeBytes / 1024 / 1024).toFixed(0)

  return (
    <div
      style={{
        padding: 12,
        border: '1px solid #e0e0e0',
        borderRadius: 6,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500 }}>{model.displayName}</div>
        <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
          {Number(sizeInGb) >= 1 ? `${sizeInGb}GB` : `${sizeInMb}MB`} • {model.modelType}
        </div>
        {loading && progress !== undefined && (
          <Progress percent={Math.round(progress)} size="small" style={{ marginTop: 8, width: 200 }} />
        )}
      </div>
      <Space>
        {model.isDownloaded ? (
          <>
            <Tag color="green">Downloaded</Tag>
            <Button
              type="text"
              danger
              size="small"
              loading={loading}
              icon={<DeleteOutlined />}
              onClick={onDelete}
            />
          </>
        ) : (
          <>
            <Tag>Not Downloaded</Tag>
            <Button
              type="text"
              size="small"
              loading={loading}
              icon={<DownloadOutlined />}
              onClick={onDownload}
            >
              Download
            </Button>
          </>
        )}
      </Space>
    </div>
  )
}
