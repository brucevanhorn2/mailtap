import React, { useState, useEffect } from 'react'
import { getEmailColor, getInitials } from '../../utils/emailColors'

type Stage = 'loading' | 'gravatar' | 'logo' | 'initials'

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

interface AccountBadgeProps {
  email: string
  name: string
  size?: number
}

export function AccountBadge({ email, name, size = 32 }: AccountBadgeProps) {
  const [stage, setStage] = useState<Stage>('loading')
  const [gravatarUrl, setGravatarUrl] = useState('')

  const domain = (email.split('@')[1] ?? '').toLowerCase()
  // Google's S2 favicon service — reliable replacement for the defunct Clearbit Logo API.
  // Works for both corporate domains and well-known providers (gmail.com → Google G,
  // outlook.com → Microsoft flag, icloud.com → Apple logo, etc.)
  const logoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`

  useEffect(() => {
    let cancelled = false
    setStage('loading')
    setGravatarUrl('')

    sha256Hex(email.trim().toLowerCase()).then((hash) => {
      if (cancelled) return
      setGravatarUrl(`https://www.gravatar.com/avatar/${hash}?s=128&d=404`)
      setStage('gravatar')
    })

    return () => {
      cancelled = true
    }
  }, [email])

  const color = getEmailColor(email)
  const initials = getInitials(name, email)
  const fontSize = Math.max(10, Math.floor(size * 0.38))

  const circleBase: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    userSelect: 'none'
  }

  // Colored-circle fallback (also shown during 'loading' so there's no flash)
  if (stage === 'loading' || stage === 'initials') {
    return (
      <div
        style={{
          ...circleBase,
          backgroundColor: color,
          fontSize,
          fontWeight: 600,
          color: '#fff'
        }}
      >
        {initials}
      </div>
    )
  }

  // Gravatar attempt
  if (stage === 'gravatar') {
    return (
      <div style={{ ...circleBase, backgroundColor: color }}>
        <img
          src={gravatarUrl}
          width={size}
          height={size}
          draggable={false}
          style={{ objectFit: 'cover', display: 'block' }}
          onError={() => setStage('logo')}
        />
      </div>
    )
  }

  // Clearbit company logo attempt (non-personal domains only)
  return (
    <div style={{ ...circleBase, backgroundColor: '#fff' }}>
      <img
        src={logoUrl}
        width={size}
        height={size}
        draggable={false}
        style={{ objectFit: 'contain', display: 'block' }}
        onError={() => setStage('initials')}
      />
    </div>
  )
}
