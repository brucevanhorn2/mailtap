import React, { useState, useEffect } from 'react'
import { Modal, Form, Switch, Button, Space, Collapse, Input, Select, Typography } from 'antd'
import { FolderOpenOutlined } from '@ant-design/icons'
import type { AppSettings, AiSettings } from '@shared/types'

const { Text } = Typography

interface Props {
  open: boolean
  onClose: () => void
}

export function SettingsModal({ open, onClose }: Props) {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      window.mailtap.invoke('settings:load').then((s) => setSettings(s as AppSettings))
    }
  }, [open])

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    try {
      await window.mailtap.invoke('settings:save', settings)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  function set<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  function setAi<K extends keyof AiSettings>(key: K, value: AiSettings[K]) {
    setSettings((prev) => {
      if (!prev) return prev
      const ai = prev.ai ?? {
        enabled: false,
        autoClassify: true,
        autoEmbed: true,
        spamThreshold: 0.7,
        threatThreshold: 0.5,
        customLabels: [],
        llmEnabled: false,
        llmModelId: null,
        classifierModelId: 'Xenova/mobilebert-uncased-mnli',
        sentimentModelId: 'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
        embeddingModelId: 'Xenova/bge-small-en-v1.5',
        modelDtype: 'q8'
      }
      return { ...prev, ai: { ...ai, [key]: value } }
    })
  }

  return (
    <Modal
      title="Settings"
      open={open}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={handleSave} loading={saving}>
            Save
          </Button>
        </Space>
      }
      width={520}
    >
      {settings && (
        <Form layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item label="Sync on Startup">
            <Switch
              checked={settings.syncOnStartup}
              onChange={(v) => set('syncOnStartup', v)}
            />
          </Form.Item>

          <Form.Item label="Show External Images">
            <Switch
              checked={settings.showExternalImages}
              onChange={(v) => set('showExternalImages', v)}
            />
          </Form.Item>

          <Form.Item label="Enable Logging">
            <Space>
              <Switch
                checked={settings.enableLogging}
                onChange={(v) => set('enableLogging', v)}
              />
              {settings.enableLogging && (
                <Button
                  size="small"
                  icon={<FolderOpenOutlined />}
                  onClick={() => window.mailtap.invoke('settings:open-log-folder')}
                >
                  Open Log Folder
                </Button>
              )}
            </Space>
          </Form.Item>

          <Collapse
            ghost
            items={[{
              key: 'ai-models',
              label: 'AI Models',
              children: (
                <>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
                    HuggingFace model ID or local path. Changes take effect after restarting the app.
                  </Text>
                  <Form.Item label="Classifier Model">
                    <Input
                      value={settings.ai?.classifierModelId ?? 'Xenova/mobilebert-uncased-mnli'}
                      onChange={(e) => setAi('classifierModelId', e.target.value)}
                      placeholder="Xenova/mobilebert-uncased-mnli"
                    />
                  </Form.Item>
                  <Form.Item label="Sentiment Model">
                    <Input
                      value={settings.ai?.sentimentModelId ?? 'Xenova/distilbert-base-uncased-finetuned-sst-2-english'}
                      onChange={(e) => setAi('sentimentModelId', e.target.value)}
                      placeholder="Xenova/distilbert-base-uncased-finetuned-sst-2-english"
                    />
                  </Form.Item>
                  <Form.Item label="Embedding Model">
                    <Input
                      value={settings.ai?.embeddingModelId ?? 'Xenova/bge-small-en-v1.5'}
                      onChange={(e) => setAi('embeddingModelId', e.target.value)}
                      placeholder="Xenova/bge-small-en-v1.5"
                    />
                  </Form.Item>
                  <Form.Item label="Quantization">
                    <Select
                      value={settings.ai?.modelDtype ?? 'q8'}
                      onChange={(v) => setAi('modelDtype', v)}
                      options={[
                        { label: 'q4 (smallest, fastest)', value: 'q4' },
                        { label: 'q8 (balanced)', value: 'q8' },
                        { label: 'fp16 (half precision)', value: 'fp16' },
                        { label: 'fp32 (full precision)', value: 'fp32' }
                      ]}
                    />
                  </Form.Item>
                </>
              )
            }]}
          />
        </Form>
      )}
    </Modal>
  )
}
