export function getBadgeGlyph(key: string): string {
  const normalized = key.trim()
  if (!normalized) return 'WH'
  return normalized.slice(0, 2).toUpperCase()
}

export function getBadgeImage(key: string, earned: boolean): string {
  const hue = Math.abs([...key].reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 360
  const colorA = earned ? `hsl(${hue} 82% 48%)` : '#d8d8d8'
  const colorB = earned ? `hsl(${(hue + 54) % 360} 86% 54%)` : '#f2f2f2'
  const glyph = getBadgeGlyph(key)
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
      <defs>
        <linearGradient id="g" x1="24" x2="136" y1="18" y2="144" gradientUnits="userSpaceOnUse">
          <stop stop-color="${colorA}"/>
          <stop offset="1" stop-color="${colorB}"/>
        </linearGradient>
        <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#460073" flood-opacity=".2"/>
        </filter>
      </defs>
      <rect width="160" height="160" rx="36" fill="url(#g)" filter="url(#s)"/>
      <circle cx="80" cy="70" r="42" fill="rgba(255,255,255,.2)" stroke="rgba(255,255,255,.72)" stroke-width="6"/>
      <path d="M52 102 44 142l36-20 36 20-8-40" fill="rgba(255,255,255,.28)"/>
      <text x="80" y="82" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="30" font-weight="900" fill="white">${glyph}</text>
    </svg>
  `
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}
