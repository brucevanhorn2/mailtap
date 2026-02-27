const COLOR_PALETTE = [
  '#4f9eff', // blue
  '#52e05c', // green
  '#f5a623', // orange
  '#c471ed', // purple
  '#ff5f5f', // red
  '#12c2e9', // cyan
  '#f64f59', // coral
  '#43e97b', // mint
  '#fa8231', // amber
  '#a29bfe'  // lavender
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // convert to 32-bit int
  }
  return Math.abs(hash)
}

export function getEmailColor(email: string): string {
  const index = hashString(email.toLowerCase()) % COLOR_PALETTE.length
  return COLOR_PALETTE[index]
}

export function getInitials(name: string, email: string): string {
  const source = name && name.trim().length > 0 ? name.trim() : email.trim()

  if (!source) return '?'

  const parts = source.split(/[\s@._-]+/).filter((p) => p.length > 0)

  if (parts.length === 0) return '?'

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
