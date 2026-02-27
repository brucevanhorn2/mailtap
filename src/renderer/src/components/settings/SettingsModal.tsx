import React, { useState, useEffect } from 'react'
import { Modal, Form, Switch, Button, Space } from 'antd'
import { FolderOpenOutlined } from '@ant-design/icons'
import type { AppSettings } from '@shared/types'

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
      width={420}
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
        </Form>
      )}
    </Modal>
  )
}
