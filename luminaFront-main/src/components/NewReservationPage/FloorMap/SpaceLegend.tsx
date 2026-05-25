const LEGEND_ITEMS = [
  { label: 'Disponible', color: '#00c9a7' },
  { label: 'Ocupado', color: '#c0c0c0' },
  { label: 'Bloqueado', color: '#5c6470' },
  { label: 'Seleccionado', color: '#a100ff' },
  { label: 'Recomendado IA', color: '#ffb000' },
];

export function SpaceLegend() {
  return (
    <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
      {LEGEND_ITEMS.map(({ label, color }) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: color,
              display: 'inline-block',
              flexShrink: 0,
            }}
            aria-hidden="true"
          />
          <span style={{ fontSize: '0.8rem', color: '#555' }}>{label}</span>
        </div>
      ))}
    </div>
  );
}
