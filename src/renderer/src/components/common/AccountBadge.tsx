import React from 'react'
import { getEmailColor, getInitials } from '../../utils/emailColors'

interface AccountBadgeProps {
  email: string
  name: string
  size?: number
}

export function AccountBadge({ email, name, size = 32 }: AccountBadgeProps) {
  const color = getEmailColor(email)
  const initials = getInitials(name, email)
  const fontSize = Math.max(10, Math.floor(size * 0.38))

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize,
        fontWeight: 600,
        color: '#ffffff',
        flexShrink: 0,
        userSelect: 'none'
      }}
    >
      {initials}
    </div>
  )
}
