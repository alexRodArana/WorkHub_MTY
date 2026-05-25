# WorkHub MTY Database Restore

Estos archivos recrean la base de datos de Supabase para correr WorkHub MTY desde cero.

## Archivos

- `01_schema.sql`: estructura completa de tablas, constraints, indices, triggers anti-solape, extensiones de busqueda y publicacion de Supabase Realtime.
- `02_seed_static.sql`: catalogos e inventario estatico exportado desde Supabase: roles, edificio, pisos, espacios, estacionamientos y badges.
- `export_static_seed.cjs`: script para volver a exportar `02_seed_static.sql` desde la base configurada en `luminaBack-main/.env`.
- `render-vercel-env.example`: variables requeridas para Render, Vercel y Supabase.
- `../luminaBack-main/seed_production_demo_data.ts`: crea usuarios demo, vehiculos y reservas de prueba.

## Orden de restauracion

Desde la raiz del repositorio:

```bash
psql "$DATABASE_URL" -f database/01_schema.sql
psql "$DATABASE_URL" -f database/02_seed_static.sql
```

Despues, si quieres datos demo para probar la app:

```bash
cd luminaBack-main
npm install
npx ts-node seed_production_demo_data.ts
```

El seed demo es idempotente: actualiza cuentas demo existentes y crea reservas faltantes sin borrar datos de usuarios reales.

## Variables minimas

Backend en Render:

```bash
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_ALGORITHM=HS256
JWT_EXPIRES_IN=3600
GEMINI_API_KEY=...
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://tu-frontend.vercel.app
```

Frontend en Vercel:

```bash
VITE_API_BASE_URL=https://tu-backend-render.onrender.com
```

## Realtime

`01_schema.sql` intenta registrar `reservations`, `space_blocks` y `area_blocks` en la publicacion `supabase_realtime`. En Supabase, verifica tambien en Dashboard > Database > Replication que esas tablas esten habilitadas si el panel no refleja cambios en vivo.

## Hardening de produccion

La base queda protegida contra:

- Dos reservas activas/confirmadas en el mismo escritorio y horario.
- Dos reservas activas/confirmadas en el mismo cajon de estacionamiento y horario.
- Dos reservas de escritorio simultaneas para el mismo usuario.
- Dos reservas de estacionamiento simultaneas para el mismo usuario.
- Bloquear un espacio que ya tiene una reserva activa/confirmada.
- Asignar estacionamiento sin vehiculo registrado.

Tambien incluye indices trigram para busqueda de usuarios, placas y auditoria, mas indices por fecha/estado para dashboard, guardia, recomendaciones IA y monitoreo en tiempo real.

## Regenerar semilla estatica

Si cambias pisos, espacios, cajones o badges en Supabase:

```bash
node database/export_static_seed.cjs
```

Luego revisa el diff de `database/02_seed_static.sql` y subelo al repositorio.
