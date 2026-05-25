const badgeImages = import.meta.glob('../assets/Badges/*.png', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const BADGE_IMAGE_FILES: Record<string, { earned: string; locked: string }> = {
  bienvenido_colega: { earned: 'Bienvenido.png', locked: 'bienvenidoGris.png' },
  cafecito_en_la_mano: { earned: '5reservas.png', locked: '5reservasGris.png' },
  diez_de_diez: { earned: '10reservas.png', locked: '10reservasGris.png' },
  criatura_de_habitos: { earned: '5dias.png', locked: '5diasGris.png' },
  ya_me_ubico: { earned: '20reservas.png', locked: '20reservasGris.png' },
  la_misma_silla: { earned: 'mismasilla.png', locked: 'mismasillaGris.png' },
  el_madrugador: { earned: 'madrugador.png', locked: 'madrugadorGris.png' },
  asiduo_del_edificio: { earned: '50reservas.png', locked: '50reservasGris.png' },
  racha_de_acero: { earned: '15dias.png', locked: '15diasGris.png' },
  ciudadano_del_edificio: { earned: '4pisos.png', locked: '4pisosGris.png' },
  semana_completa: { earned: 'semana.png', locked: 'semanaGris.png' },
  sin_faltas: { earned: 'sinfaltas.png', locked: 'sinfaltasGris.png' },
  inquilino_de_honor: { earned: '100reservas.png', locked: '100reservasGris.png' },
  el_mes_perfecto: { earned: '20dias.png', locked: '20diasGris.png' },
  sin_fronteras: { earned: 'sinfronteras.png', locked: 'sinfronterasGris.png' },
  planificador_de_elite: { earned: 'anticipacion.png', locked: 'anticipacionGris.png' },
  el_constante: { earned: 'constante.png', locked: 'constanteGris.png' },
  el_edificio_es_mio: { earned: '200reservas.png', locked: '200reservasGris.png' },
  imparable: { earned: '30dias.png', locked: '30diasGris.png' },
  la_leyenda_del_edificio: { earned: '50dias.png', locked: '50diasGris.png' },
  inmortal: { earned: '100dias.png', locked: '100diasGris.png' },
  el_dueno_del_edificio: { earned: 'todosespacios.png', locked: 'todosespaciosGris.png' },
}

function findBadgeAsset(filename: string): string | undefined {
  return badgeImages[`../assets/Badges/${filename}`]
}

export function getBadgeGlyph(key: string): string {
  const normalized = key.trim()
  if (!normalized) return 'WH'
  return normalized.slice(0, 2).toUpperCase()
}

export function getBadgeImage(key: string, earned: boolean): string {
  const imageFiles = BADGE_IMAGE_FILES[key]
  if (imageFiles) {
    const asset = findBadgeAsset(earned ? imageFiles.earned : imageFiles.locked)
    if (asset) return asset
  }

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
