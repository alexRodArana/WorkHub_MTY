# WorkHub MTY

WorkHub MTY es una plataforma corporativa para administrar reservas de espacios de oficina y estacionamiento. El sistema centraliza disponibilidad, ocupacion, check-in, check-out, estacionamiento, gamificacion, analitica administrativa, bloqueos operativos y asistencia con IA usando contexto real autorizado por rol.

El repositorio contiene dos aplicaciones:

- `luminaFront-main`: frontend web en React, TypeScript y Vite.
- `luminaBack-main`: API REST en Node.js, Express, TypeScript y PostgreSQL.

La infraestructura recomendada es Vercel para frontend, Render para backend y Supabase/PostgreSQL para base de datos.

## Tabla de Contenido

- [Caracteristicas](#caracteristicas)
- [Roles](#roles)
- [Demo de Producto](#demo-de-producto)
- [Arquitectura](#arquitectura)
- [Stack Tecnologico](#stack-tecnologico)
- [Estructura](#estructura)
- [Base de Datos](#base-de-datos)
- [IA con Gemini](#ia-con-gemini)
- [Flujos Principales](#flujos-principales)
- [Variables de Entorno](#variables-de-entorno)
- [Instalacion Local](#instalacion-local)
- [Migraciones](#migraciones)
- [Pruebas](#pruebas)
- [Evidencia y Casos de Prueba](#evidencia-y-casos-de-prueba)
- [Deploy](#deploy)
- [Operacion](#operacion)

## Caracteristicas

- Autenticacion con JWT.
- Control de acceso por roles.
- Reservas de escritorio.
- Reservas de escritorio con estacionamiento.
- Reservas solo de estacionamiento.
- Registro de multiples vehiculos por usuario.
- Seleccion interactiva de vehiculo principal desde la tarjeta del vehiculo.
- Check-in de reservas.
- Check-out inmediato para liberar escritorio o estacionamiento sin tiempo minimo de espera.
- Mapa interactivo por piso con ocupacion, avatares, horarios e informacion del espacio.
- Recomendaciones de espacios generadas con Gemini.
- Chatbot con Gemini y contexto real autorizado segun rol.
- Dashboard administrativo con KPIs, graficas y detalle expandible.
- Filtros administrativos por dia, semana, mes y rango personalizado.
- Exportacion administrativa XLSX con formato ejecutivo y periodo seleccionado.
- Bloqueo de espacios por fecha, horario y motivo.
- Vista exclusiva para guardias con estacionamiento del dia.
- Busqueda rapida de usuarios para administradores y guardias.
- Badges, rachas, progreso y animaciones de desbloqueo.
- Perfil con foto de usuario y vehiculos.
- Tema claro y oscuro.
- Interfaz responsiva para escritorio, laptop, tablet y movil.
- Actualizaciones en tiempo real con Server-Sent Events.
- Cache operativo y rendering optimista en flujos criticos.
- Constraints, indices, triggers y stored procedures para produccion.

## Roles

### Empleado

Rutas:

- `/dashboard`
- `/nueva-reserva`
- `/mis-reservas`
- `/logros`
- `/perfil`

Permisos:

- Reservar escritorio.
- Reservar escritorio con estacionamiento.
- Reservar solo estacionamiento.
- Registrar, editar y eliminar vehiculos.
- Seleccionar vehiculo principal haciendo click en la tarjeta.
- Ver ocupacion del mapa.
- Recibir recomendaciones con IA.
- Hacer check-in y check-out.
- Cancelar reservas confirmadas.
- Consultar logros y racha.
- Actualizar foto de perfil.
- Usar chatbot con contexto de sus reservas, vehiculos, badges y perfil.

### Administrador

Rutas:

- `/admin`
- `/admin/gestion`
- `/admin/bloqueos`

Permisos:

- Consultar KPIs operativos.
- Filtrar dashboard por dia, semana, mes o rango.
- Exportar reportes XLSX segun el periodo visible.
- Expandir metricas para ver tablas con filtros.
- Buscar usuarios.
- Bloquear espacios o salas.
- Liberar bloqueos activos.
- Usar chatbot con contexto administrativo.

### Guardia

Ruta:

- `/guardia`

Permisos:

- Ver estacionamientos reservados del dia.
- Consultar usuario, horario, codigo, vehiculo, placa, zona y cajon.
- Buscar usuarios.
- Usar chatbot con contexto limitado a estacionamiento.

El guardia no tiene acceso a vistas de empleado ni administrador.

## Demo de Producto

El proyecto incluye un seed principal deterministico para presentar WorkHub MTY como producto con datos realistas: perfiles, fotos tipo avatar, vehiculos, reservas, estacionamientos, badges y bloqueos administrativos. Este es el seed oficial que debe ejecutarse en produccion para tener los perfiles de demostracion reales.

En produccion, el backend ejecuta `db:setup` automaticamente antes de iniciar el servidor mediante `npm start`. Ese flujo aplica las migraciones idempotentes de checkout/performance y despues ejecuta el seed oficial, por lo que cuentas como `lucia.moreno@lumina.demo` existen en la base real usada por Render.

Ejecutar seed de demo:

```bash
cd luminaBack-main
npm run db:seed
```

Credenciales demo:

| Rol | Correo | Contrasena | Uso recomendado |
|---|---|---|---|
| Empleado principal | `ana.garcia@lumina.demo` | `WorkHubDemo123!` | Dashboard, mapa, checkout, perfil, vehiculos y badges |
| Empleado para badge en vivo | `lucia.moreno@lumina.demo` | `WorkHubDemo123!` | Crear quinta reserva para desbloquear `Cafecito en la Mano` |
| Administrador | `admin.demo@lumina.demo` | `WorkHubDemo123!` | KPIs, XLSX, gestion de bloqueos y busqueda |
| Guardia | `guardia.demo@lumina.demo` | `WorkHubDemo123!` | Estacionamientos reservados del dia |

Datos incluidos por el seed:

- 16 usuarios demo activos.
- 13 empleados con perfil, foto y vehiculo.
- Usuarios con multiples vehiculos para validar seleccion de principal.
- 50 reservas demo con estados `confirmada`, `activa`, `finalizada`, `cancelada` y `no_show`.
- Reservas de tipo escritorio, escritorio con estacionamiento y solo estacionamiento.
- 2 bloqueos administrativos activos.
- Badges precargadas en usuarios seleccionados.
- Usuario `lucia.moreno@lumina.demo` preparado para desbloquear una badge durante la presentacion.

Guia completa de presentacion:

```text
docs/demo/DEMO_PRODUCTO_WORKHUB_MTY.md
```

Matriz extendida de casos de prueba de demo:

```text
docs/demo/CASOS_PRUEBA_DEMO_WORKHUB_MTY.md
```

Screenshots por caso de prueba:

```text
docs/demo/screenshots/
```

## Arquitectura

```text
Usuario
  |
  v
React SPA en Vercel
  |
  | REST API + SSE
  v
Express API en Render
  |
  | SQL parametrizado
  v
PostgreSQL / Supabase
  |
  | Contexto autorizado
  v
Gemini API
```

Principios del sistema:

- El frontend no calcula recomendaciones finales de IA.
- El backend arma contexto autorizado por rol.
- Gemini responde usando solo el contexto entregado por backend.
- La API valida respuestas de IA antes de regresarlas al cliente.
- La base de datos protege consistencia con constraints, triggers e indices parciales.

## Stack Tecnologico

### Frontend

- React 18
- TypeScript
- Vite
- React Router
- CSS Modules
- Fetch API
- Server-Sent Events
- ExcelJS para reportes XLSX
- Vitest
- Testing Library
- JSDOM
- ESLint

### Backend

- Node.js
- Express
- TypeScript
- PostgreSQL con `pg`
- JWT con `jsonwebtoken`
- Hash de contrasenas con `bcrypt`
- Rate limiting con `express-rate-limit`
- CORS configurable
- Google Generative Language API para Gemini
- Server-Sent Events para tiempo real
- Vitest
- Supertest

### Base de Datos

- PostgreSQL
- Supabase como proveedor recomendado
- Indices compuestos, parciales y trigram
- Constraints de integridad
- Triggers
- Stored procedures
- Funciones SQL auxiliares
- Migraciones TypeScript con `ts-node`

## Estructura

```text
.
├── README.md
├── render.yaml
├── database/
├── luminaBack-main/
│   ├── src/
│   │   ├── auth/
│   │   ├── reservations/
│   │   └── shared/
│   ├── migrate_*.ts
│   └── package.json
└── luminaFront-main/
    ├── src/
    │   ├── components/
    │   ├── services/
    │   ├── hooks/
    │   ├── types/
    │   └── utils/
    ├── vercel.json
    └── package.json
```

## Base de Datos

El modelo principal incluye:

- `users`: usuarios, roles logicos, foto, departamento y datos de perfil.
- `roles` y `user_roles`: control de acceso.
- `buildings`, `floors`, `spaces`: inventario de oficinas y layout del mapa.
- `reservations`: reservas de escritorio, parking y combinadas.
- `parking_zones`, `parking_spots`: inventario y prioridad de estacionamiento.
- `user_vehicles`: vehiculos por usuario.
- `badges`, `user_badges`, `user_streaks`: gamificacion.
- `area_blocks`, `space_blocks`: bloqueos operativos.
- `audit_logs`: auditoria administrativa.

Optimizaciones relevantes:

- `workhub_checkout_reservation`: stored procedure atomica para check-out.
- `workhub_enforce_single_default_vehicle`: trigger para mantener un solo vehiculo principal activo por usuario.
- `workhub_reservation_type`: funcion SQL para normalizar tipo de reserva.
- `workhub_count_open_checkout_candidates`: funcion de diagnostico operativo.
- Indices parciales para reservas abiertas, checkout, estacionamiento y bloqueos.
- Indices de periodo para dashboard administrativo.
- Indices trigram para busqueda de usuarios.
- `ANALYZE` sobre tablas criticas tras migraciones.

## IA con Gemini

El sistema usa Gemini para:

- Recomendaciones de espacios individuales.
- Chatbot de empleado.
- Chatbot de administrador.
- Chatbot de guardia.

Reglas:

- Las recomendaciones deben venir de Gemini.
- El backend no inventa recomendaciones locales cuando Gemini falla.
- Las recomendaciones de reserva solo consideran escritorios individuales.
- El chatbot responde con contexto autorizado por rol.
- El frontend no recibe ni expone secretos de IA.

Variables principales:

- `AI_PROVIDER=gemini`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `GEMINI_FALLBACK_MODELS`

## Flujos Principales

### Nueva Reserva

La pantalla permite elegir:

- Escritorio con estacionamiento.
- Solo escritorio.
- Solo estacionamiento.

El sistema valida disponibilidad, vehiculo requerido para estacionamiento, conflictos de horario, bloqueos activos y disponibilidad de cajones.

### Check-Out

El usuario puede liberar una reserva abierta inmediatamente:

- No existe tiempo minimo de uso.
- Aplica a reservas confirmadas o activas.
- Libera escritorio y/o estacionamiento.
- Publica evento en tiempo real.
- Limpia cache del frontend.

### Dashboard Administrativo

El administrador puede analizar:

- Dia.
- Semana.
- Mes.
- Rango personalizado.

El XLSX exportado usa el mismo periodo seleccionado en pantalla.

## Variables de Entorno

### Backend

Archivo recomendado: `luminaBack-main/.env`

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_ALGORITHM=HS256
JWT_EXPIRES_IN=3600
ALLOWED_ORIGINS=http://localhost:5173,https://tu-frontend.vercel.app
AI_PROVIDER=gemini
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash-lite
GEMINI_FALLBACK_MODELS=gemini-2.5-flash,gemini-2.0-flash-lite
```

### Frontend

Archivo recomendado: `luminaFront-main/.env`

```env
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=https://...
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

En Vercel se recomienda configurar `VITE_API_URL=https://workhub-mty.onrender.com`. Si se omite, el frontend desplegado usa ese backend de produccion como fallback.

Nunca subir `.env` reales al repositorio.

## Instalacion Local

### Backend

```bash
cd luminaBack-main
npm install
npm run dev
```

### Frontend

```bash
cd luminaFront-main
npm install
npm run dev
```

URLs locales comunes:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

## Migraciones

Las migraciones viven en `luminaBack-main/migrate_*.ts`.

Para aplicar las migraciones finales de checkout, performance y calidad:

```bash
cd luminaBack-main
npm run db:migrate:hu25
npm run db:migrate:hu27
```

Para dejar la base lista con la semilla principal de producto:

```bash
cd luminaBack-main
npm run db:seed
```

Para aplicar migraciones finales y despues sembrar los datos oficiales:

```bash
cd luminaBack-main
npm run db:setup
```

Las migraciones `hu25` y `hu27` son idempotentes. En conjunto aplican:

- Constraint actualizado para estados de reserva, incluyendo `finalizada`.
- Stored procedure `workhub_checkout_reservation`.
- Indices para checkout, dashboard, mapa, parking y busqueda.
- Limpieza de multiples vehiculos principales.
- Indice unico parcial para vehiculo principal activo.
- Trigger para mantener un solo vehiculo principal.
- Funciones SQL auxiliares.
- `ANALYZE` en tablas criticas.

## Pruebas

### Backend

```bash
cd luminaBack-main
npm test
npm run build
```

Cobertura incluida:

- Autenticacion.
- Perfil.
- Reservas.
- Parking-only.
- Vehiculos.
- Check-in.
- Check-out.
- Stored procedure de checkout desde repositorio.
- Eventos realtime de checkout.
- Recomendaciones IA con Gemini.
- Chatbot por rol.
- Dashboard administrativo por rango.
- Guardia.

### Frontend

```bash
cd luminaFront-main
npm test
npm run lint
npm run build
```

Cobertura incluida:

- Servicios HTTP.
- Checkout exitoso y errores de checkout.
- Recomendaciones.
- Reservas con estacionamiento.
- Ocupacion por piso.
- Incentivos por dia.
- Ruteo por rol.
- Utilidades de parking.
- Integracion de nueva reserva.

## Evidencia y Casos de Prueba

El repositorio incluye documentacion y evidencia visual para presentar y validar el sistema:

| Entregable | Ruta |
|---|---|
| Guia de demo de producto | `docs/demo/DEMO_PRODUCTO_WORKHUB_MTY.md` |
| Matriz extendida de casos de prueba | `docs/demo/CASOS_PRUEBA_DEMO_WORKHUB_MTY.md` |
| Screenshots por caso de prueba | `docs/demo/screenshots/` |
| Informe formal de Calidad M5 | `Informe_Formal_Calidad_M5_WorkHub_MTY.pdf` |
| Documento base editable de Calidad M5 | `Calidad_M5_WorkHub_MTY.md` |

Casos de prueba cubiertos en la evidencia:

- Login por rol.
- Dashboard del empleado.
- Nueva reserva con mapa, avatares y recomendaciones IA.
- Mis reservas y checkout.
- Logros y badges.
- Perfil y vehiculos.
- Dashboard administrativo con KPIs.
- Gestion administrativa de bloqueos.
- Bloqueos activos.
- Vista guardia de estacionamiento.
- Responsividad movil.

Para regenerar capturas locales:

```bash
mkdir -p /tmp/workhub-browser
cd /tmp/workhub-browser
npm init -y
npm install playwright
npx playwright install chromium

cd /ruta/a/WorkHub\ MTY
node scripts/capture_m5_screenshots.mjs
```

Para regenerar el PDF de Calidad M5:

```bash
python3 scripts/build_m5_quality_report.py
```

## Deploy

### GitHub

La rama principal de produccion es `main`.

```bash
git push origin main
```

### Render

El backend usa `render.yaml`.

Configuracion esperada:

- Root: `luminaBack-main`
- Build command: `npm ci --include=dev && npm run build`
- Start command: `npm start`
- Environment variables: las del backend.

### Vercel

El frontend usa `luminaFront-main/vercel.json`.

Configuracion esperada:

- Root: `luminaFront-main`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: las del frontend, especialmente `VITE_API_URL`.

### Supabase

Antes o durante el deploy:

1. Configurar `DATABASE_URL` en Render.
2. Ejecutar `npm run db:setup` o permitir que `npm start` lo ejecute automaticamente.
3. Verificar datos base, espacios, badges y usuarios demo si aplica.
4. Validar que `workhub_checkout_reservation` exista.
5. Validar que `workhub_reservation_type` exista.

## Operacion

Checklist recomendado antes de presentar o pasar a produccion:

- `npm test` en backend.
- `npm run build` en backend.
- `npm test` en frontend.
- `npm run lint` en frontend.
- `npm run build` en frontend.
- `npm run db:setup` aplicado correctamente.
- Login probado con empleado, administrador y guardia.
- Nueva reserva probada en los tres modos.
- Check-out probado en reserva confirmada y activa.
- Dashboard admin probado por dia, semana, mes y rango.
- Export XLSX probado.
- Guardia probado con estacionamientos del dia.
- Chatbot probado con Gemini configurado.
- Recomendaciones probadas con Gemini configurado.

## Calidad

El proyecto usa:

- TypeScript en frontend y backend.
- SQL parametrizado.
- Cache controlado en servicios frontend.
- Server-Sent Events para actualizacion sin refresh.
- Rate limit en endpoints de IA.
- Constraints e indices en base de datos.
- Pruebas unitarias e integracion para flujos criticos.
- Build de produccion validado en ambos proyectos.
