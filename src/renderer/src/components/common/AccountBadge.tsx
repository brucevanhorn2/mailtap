import React, { useState, useEffect } from 'react'
import { getEmailColor, getInitials } from '../../utils/emailColors'

// These providers' favicons aren't useful as sender identity icons — use
// Gravatar or the colored-circle fallback instead.
const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'yahoo.co.uk', 'yahoo.fr', 'yahoo.de',
  'hotmail.com', 'hotmail.co.uk', 'hotmail.fr',
  'outlook.com', 'live.com', 'msn.com',
  'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'aol.co.uk',
  'protonmail.com', 'proton.me', 'pm.me',
  'tutanota.com', 'tuta.io',
  'fastmail.com', 'fastmail.fm',
  'zoho.com', 'zohomail.com',
  'yandex.com', 'yandex.ru',
  'mail.com', 'gmx.com', 'gmx.net', 'gmx.de'
])

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
  const isPersonal = PERSONAL_DOMAINS.has(domain)
  const logoUrl = `https://logo.clearbit.com/${domain}`

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
          onError={() => (isPersonal ? setStage('initials') : setStage('logo'))}
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
