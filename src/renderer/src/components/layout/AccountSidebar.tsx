import React, { useState, useEffect, useCallback } from 'react'
import { Button, Tooltip } from 'antd'
import { PlusOutlined, SettingOutlined } from '@ant-design/icons'
import type { Mailbox } from '@shared/types'
import { useAccountStore } from '../../store/accountStore'
import { useMailStore } from '../../store/mailStore'
import { AccountItem } from '../sidebar/AccountItem'
import { FolderItem } from '../sidebar/FolderItem'
import { AddAccountModal } from '../sidebar/AddAccountModal'
import { SyncStatusBar } from '../sidebar/SyncStatusBar'
import { SettingsModal } from '../settings/SettingsModal'

export function AccountSidebar() {
  const accounts = useAccountStore((s) => s.accounts)
  const removeAccount = useAccountStore((s) => s.removeAccount)
  const { activeAccountId, activeMailboxId, setActiveMailbox } = useMailStore()

  const [mailboxesByAccount, setMailboxesByAccount] = useState<Record<string, Mailbox[]>>({})
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set())

  const loadMailboxes = useCallback(async () => {
    try {
      const all = await window.mailtap.invoke('mailbox:list')
      const byAccount: Record<string, Mailbox[]> = {}
      for (const mailbox of all) {
        if (!byAccount[mailbox.accountId]) {
          byAccount[mailbox.accountId] = []
        }
        byAccount[mailbox.accountId].push(mailbox)
      }
      setMailboxesByAccount(byAccount)
    } catch (err) {
      console.error('Failed to load mailboxes:', err)
    }
  }, [])

  const loadUnreadCounts = useCallback(async () => {
    try {
      const counts = await window.mailtap.invoke('mailbox:unread-counts')
      setUnreadCounts(counts)
    } catch (err) {
      console.error('Failed to load unread counts:', err)
    }
  }, [])

  useEffect(() => {
    loadMailboxes()
    loadUnreadCounts()
  }, [loadMailboxes, loadUnreadCounts])

  // Reload mailboxes and unread counts when sync completes or new messages arrive
  useEffect(() => {
    const unsubComplete = window.mailtap.on('sync:complete' as string, () => {
      loadMailboxes()
      loadUnreadCounts()
    })
    const unsubNew = window.mailtap.on('mail:new-messages' as string, () => {
      loadUnreadCounts()
    })
    return () => {
      unsubComplete()
      unsubNew()
    }
  }, [loadMailboxes, loadUnreadCounts])

  // Expand accounts by default as they are loaded
  useEffect(() => {
    setExpandedAccounts((prev) => {
      const next = new Set(prev)
      for (const account of accounts) {
        next.add(account.id)
      }
      return next
    })
  }, [accounts])

  function toggleExpand(accountId: string) {
    setExpandedAccounts((prev) => {
      const next = new Set(prev)
      if (next.has(accountId)) {
        next.delete(accountId)
      } else {
        next.add(accountId)
      }
      return next
    })
  }

  function getAccountUnread(accountId: string): number {
    const mailboxes = mailboxesByAccount[accountId] ?? []
    return mailboxes.reduce((sum, mb) => sum + (unreadCounts[mb.id] ?? mb.unreadCount), 0)
  }

  function handleAccountSelect(accountId: string) {
    toggleExpand(accountId)
    setActiveMailbox(accountId, null)
  }

  function handleFolderSelect(accountId: string, mailboxId: string) {
    setActiveMailbox(accountId, mailboxId)
  }

  async function handleRemoveAccount(id: string) {
    await window.mailtap.invoke('account:remove', id)
    removeAccount(id)
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#0f0f10',
        borderRight: '1px solid #2a2a2e',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* App Title */}
      <div
        style={{
          padding: '16px 14px 12px',
          borderBottom: '1px solid #2a2a2e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}
      >
        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: '#e2e2e2',
            letterSpacing: '-0.3px'
          }}
        >
          MailTap
        </span>
      </div>

      {/* Account + Folder List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 4px' }}>
        {accounts.map((account) => {
          const isExpanded = expandedAccounts.has(account.id)
          const isAccountSelected = activeAccountId === account.id && activeMailboxId === null
          const mailboxes = mailboxesByAccount[account.id] ?? []
          const totalUnread = getAccountUnread(account.id)

          return (
            <div key={account.id}>
              <AccountItem
                account={account}
                isSelected={isAccountSelected}
                unreadCount={totalUnread}
                onSelect={() => handleAccountSelect(account.id)}
                onRemove={() => handleRemoveAccount(account.id)}
              />

              {isExpanded && mailboxes.length > 0 && (
                <div>
                  {[...mailboxes]
                    .sort((a, b) => {
                      const isInbox = (m: Mailbox) =>
                        m.path.toLowerCase() === 'inbox' ||
                        m.attributes.some((x) => x.toLowerCase() === '\\inbox')
                      if (isInbox(a) && !isInbox(b)) return -1
                      if (!isInbox(a) && isInbox(b)) return 1
                      return 0
                    })
                    .map((mailbox, idx, arr) => {
                      const isInbox =
                        mailbox.path.toLowerCase() === 'inbox' ||
                        mailbox.attributes.some((x) => x.toLowerCase() === '\\inbox')
                      const nextIsNotInbox = idx === 0 && isInbox && arr.length > 1
                      return (
                        <React.Fragment key={mailbox.id}>
                          <FolderItem
                            mailbox={{
                              ...mailbox,
                              unreadCount: unreadCounts[mailbox.id] ?? mailbox.unreadCount
                            }}
                            isSelected={activeMailboxId === mailbox.id}
                            onSelect={() => handleFolderSelect(account.id, mailbox.id)}
                          />
                          {nextIsNotInbox && (
                            <div
                              style={{
                                height: 1,
                                backgroundColor: '#2a2a2e',
                                margin: '4px 14px 4px 36px'
                              }}
                            />
                          )}
                        </React.Fragment>
                      )
                    })}
                </div>
              )}
            </div>
          )
        })}

        {accounts.length === 0 && (
          <div
            style={{
              padding: '24px 14px',
              color: '#a0a0a8',
              fontSize: 13,
              textAlign: 'center',
              lineHeight: 1.6
            }}
          >
            No accounts yet.
            <br />
            Add one to get started.
          </div>
        )}
      </div>

      {/* Add Account + Settings Buttons */}
      <div
        style={{
          padding: '8px 10px',
          borderTop: '1px solid #2a2a2e',
          flexShrink: 0,
          display: 'flex',
          gap: 6
        }}
      >
        <Tooltip title="Add Email Account" placement="right">
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => setAddModalOpen(true)}
            style={{ flex: 1, borderColor: '#2a2a2e', color: '#a0a0a8', backgroundColor: 'transparent' }}
            size="small"
          >
            Add Account
          </Button>
        </Tooltip>
        <Tooltip title="Settings" placement="right">
          <Button
            icon={<SettingOutlined />}
            onClick={() => setSettingsOpen(true)}
            style={{ borderColor: '#2a2a2e', color: '#a0a0a8', backgroundColor: 'transparent' }}
            size="small"
          />
        </Tooltip>
      </div>

      {/* Sync Status Bar */}
      <SyncStatusBar />

      <AddAccountModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={() => {
          setAddModalOpen(false)
          loadMailboxes()
          loadUnreadCounts()
        }}
      />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}
