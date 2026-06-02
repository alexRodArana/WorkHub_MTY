# WorkHub MTY

WorkHub MTY es una plataforma web para gestionar reservas de espacios de oficina y estacionamiento en un entorno corporativo. El sistema permite a empleados reservar escritorios, salas y cajones de estacionamiento; a administradores analizar ocupación y bloquear espacios; y a guardias consultar las reservas de estacionamiento del día.

El proyecto está dividido en dos aplicaciones principales:

- `luminaFront-main`: frontend SPA construido con React, TypeScript y Vite.
- `luminaBack-main`: API REST construida con Node.js, Express, TypeScript y PostgreSQL.

La base de datos está preparada para Supabase/PostgreSQL y el despliegue está orientado a Vercel para frontend, Render para backend y Supabase para datos.

## Contenido

- [Características Principales](#características-principales)
- [Roles del Sistema](#roles-del-sistema)
- [Stack Tecnológico](#stack-tecnológico)
- [Arquitectura](#arquitectura)
- [Estructura del Repositorio](#estructura-del-repositorio)
- [Modelo de Base de Datos](#modelo-de-base-de-datos)
- [IA con Gemini](#ia-con-gemini)
- [Flujos Principales](#flujos-principales)
- [Variables de Entorno](#variables-de-entorno)
- [Instalación Local](#instalación-local)
- [Migraciones y Seeds](#migraciones-y-seeds)
- [Scripts Disponibles](#scripts-disponibles)
- [API Principal](#api-principal)
- [Deploy en Producción](#deploy-en-producción)
- [Pruebas y Validación](#pruebas-y-validación)
- [Seguridad](#seguridad)
- [Notas Operativas](#notas-operativas)

## Características Principales

- Autenticación con JWT.
- Control de acceso por rol.
- Reservas de escritorio.
- Reservas de escritorio con estacionamiento.
- Reservas solo de estacionamiento.
- Registro de vehículos por usuario.
- Selección de vehículo para reservas con estacionamiento.
- Check-in de reservas de escritorio.
- Check-out inmediato para liberar reservas activas de escritorio o estacionamiento.
- Vista de reservas activas e historial.
- Mapa interactivo por piso con escritorios, salas, zonas y ocupación.
- Hover contextual con información del espacio, piso, ocupante, foto y horario.
- Avatares sobre espacios ocupados.
- Recomendaciones de espacios usando Gemini.
- Resaltado visual de recomendaciones en el mapa.
- Chatbot con Gemini y contexto real autorizado por rol.
- Exportación administrativa en XLSX con formato ejecutivo.
- Onboarding interactivo para usuarios nuevos.
- Incentivos contextuales para martes de tacos y jueves de barista.
- Gamificación con badges, rachas, porcentaje de adopción y detalle modal.
- Animaciones de desbloqueo de badges.
- Perfil de usuario con foto y vehículos registrados.
- Dashboard administrativo con KPIs y gráficas.
- Detalle expandible de métricas administrativas.
- Tablas administrativas con búsqueda y filtros.
- Bloqueo de espacios o salas por fecha y horario desde el mapa.
- Vista exclusiva de guardia para estacionamiento.
- Búsqueda rápida de usuarios para administrador y guardia.
- Monitoreo en tiempo real mediante Server-Sent Events.
- Tema claro y oscuro.
- Diseño responsivo para desktop, laptop, tablet y móvil.
- Optimistic rendering y cache en consultas críticas del frontend.
- Índices, constraints, triggers y funciones almacenadas para operación en producción.

## Roles del Sistema

### Empleado

Rutas principales:

- `/dashboard`
- `/nueva-reserva`
- `/mis-reservas`
- `/logros`
- `/perfil`

Capacidades:

- Crear reservas de escritorio.
- Crear reservas de escritorio con estacionamiento.
- Crear reservas solo de estacionamiento.
- Ver ocupación del mapa por fecha y horario.
- Usar recomendaciones de IA.
- Hacer check-in.
- Hacer check-out anticipado.
- Cancelar reservas confirmadas.
- Registrar vehículos.
- Seleccionar vehículo principal.
- Consultar badges y racha.
- Actualizar foto de perfil.
- Usar chatbot con contexto de sus reservas, vehículos, badges y perfil.

### Administrador

Rutas principales:

- `/admin`
- `/admin/gestion`

Capacidades:

- Consultar KPIs operativos.
- Revisar ocupación por piso, categoría, hora, estado y tipo de reserva.
- Expandir métricas para ver detalle tabular.
- Filtrar y buscar información administrativa.
- Bloquear espacios o salas desde el mapa.
- Liberar bloqueos activos.
- Buscar usuarios.
- Usar chatbot con contexto de KPIs, reservas, bloqueos y uso operativo.

### Guardia

Ruta principal:

- `/guardia`

Capacidades:

- Ver reservas de estacionamiento del día.
- Consultar usuario, horario, código, vehículo, placa, zona y cajón.
- Buscar usuarios rápidamente.
- Usar chatbot con contexto limitado a estacionamiento del día.

El guardia no tiene acceso a dashboard, perfil, reservas, logros ni administración.

## Stack Tecnológico

### Frontend

- React 18
- TypeScript
- Vite
- React Router
- CSS Modules
- ExcelJS para reportes XLSX formales
- Servicios HTTP con Fetch API
- Server-Sent Events para actualizaciones en tiempo real
- Cache operativo en servicios de datos
- Rendering optimista en flujos críticos
- Vitest
- Testing Library
- JSDOM

### Backend

- Node.js
- Express
- TypeScript
- PostgreSQL con `pg`
- JWT con `jsonwebtoken`
- `bcrypt` para contraseñas
- `express-rate-limit`
- CORS configurable por ambiente
- Integración con Google Generative Language API para Gemini
- Server-Sent Events para eventos de reservas y bloqueos
- Vitest
- Supertest

### Base de Datos

- PostgreSQL
- Supabase como proveedor recomendado
- Constraints de integridad
- Índices compuestos y parciales
- Triggers
- Stored procedures
- Funciones de mantenimiento
- Publicación opcional para Supabase Realtime
- Extensiones `btree_gist` y `pg_trgm`
- Migraciones TypeScript ejecutables con `ts-node`

### IA

- Gemini API mediante Google Generative Language API.
- Modelo por defecto: `gemini-2.5-flash-lite`.
- Modelos fallback configurables: `gemini-2.5-flash`, `gemini-2.0-flash-lite`.

### Deploy

- Vercel para frontend.
- Render para backend.
- Supabase para PostgreSQL.
- GitHub como repositorio fuente.
- `render.yaml` y `vercel.json` para configuración de despliegue.

## Arquitectura

```text
Usuario
  |
  v
React SPA en Vercel
  |
  | HTTP REST
  | Server-Sent Events
  v
API Express en Render
  |
  | SQL
  v
PostgreSQL / Supabase
  |
  | Contexto real autorizado
  v
Gemini API
```

El frontend consume la API mediante servicios HTTP. La sincronización en tiempo real usa `GET /reservations/events`, que mantiene una conexión SSE para refrescar reservas, ocupación, check-ins, check-outs y bloqueos sin recargar la página.

La IA se ejecuta en backend. El frontend nunca decide recomendaciones finales localmente. El backend arma contexto autorizado, lo envía a Gemini y valida la respuesta antes de enviarla al cliente.

## Estructura del Repositorio

```text
.
├── README.md
├── render.yaml
├── database
│   ├── 01_schema.sql
│   └── 02_seed_static.sql
├── luminaBack-main
│   ├── src
│   │   ├── auth
│   │   ├── reservations
│   │   └── shared
│   ├── migrate_*.ts
│   ├── seed_demo_users_and_reservations.ts
│   ├── seed_guard_user.js
│   ├── package.json
│   └── tsconfig.json
└── luminaFront-main
    ├── src
    │   ├── assets
    │   ├── components
    │   ├── data
    │   ├── hooks
    │   ├── services
    │   ├── types
    │   └── utils
    ├── vercel.json
    ├── package.json
    └── vite.config.ts
```

## Modelo de Base de Datos

Tablas principales:

- `users`: usuarios del sistema.
- `roles`: roles disponibles.
- `user_roles`: relación entre usuarios y roles.
- `buildings`: edificios.
- `floors`: pisos.
- `spaces`: escritorios, salas, áreas y elementos visuales del mapa.
- `reservations`: reservas de escritorio, estacionamiento o ambas.
- `parking_zones`: zonas de estacionamiento.
- `parking_spots`: cajones de estacionamiento.
- `user_vehicles`: vehículos registrados por usuario.
- `badges`: catálogo de logros.
- `user_badges`: badges desbloqueados por usuario.
- `user_streaks`: rachas de asistencia.
- `area_blocks`: bloqueos por área.
- `space_blocks`: bloqueos por espacio y horario.
- `audit_logs`: bitácora operativa.

Estados de reserva:

- `confirmada`: reserva creada, aún sin check-in.
- `activa`: reserva con check-in realizado.
- `finalizada`: reserva liberada mediante check-out.
- `cancelada`: reserva cancelada por el usuario.
- `no_show`: reserva vencida sin uso.

Optimización y consistencia:

- Índices parciales para disponibilidad y traslape.
- Índices para consultas administrativas diarias.
- Índices para recomendaciones de IA e historial.
- Constraint para validar estados de reserva.
- Constraint para exigir escritorio o estacionamiento.
- Constraint para exigir vehículo cuando se asigna estacionamiento.
- Trigger para evitar reservas sobre espacios bloqueados.
- Trigger para evitar bloqueos sobre espacios ya reservados.
- Trigger para validar transición de check-out sin exigir espera ni escritorio.
- Función `workhub_checkout_reservation` para liberar reservas activas de escritorio o estacionamiento.
- Función `workhub_expire_finished_reservations`.

## IA con Gemini

El sistema usa Gemini de forma obligatoria en dos módulos:

- Recomendaciones inteligentes en el mapa de nueva reserva.
- Chatbot de WorkHub.

Reglas de IA:

- `AI_PROVIDER` debe ser `gemini` o `google`.
- `GEMINI_API_KEY` es obligatoria.
- Cada solicitud de recomendaciones llama a Gemini.
- El backend no crea recomendaciones finales con lógica local.
- Si Gemini falla, devuelve JSON inválido o recomienda IDs inexistentes, no se inventan resultados.
- Las recomendaciones solo consideran escritorios individuales disponibles.
- No se recomiendan salas, áreas colaborativas, phone booths, work labs ni estacionamientos.
- El chatbot recibe únicamente contexto autorizado por el rol del usuario.
- Las acciones sugeridas por el chatbot se validan contra rutas permitidas por rol.

Contexto enviado para recomendaciones:

- Fecha solicitada.
- Hora de inicio.
- Hora de fin.
- Piso filtrado, si existe.
- Categoría filtrada, si existe.
- Escritorios individuales disponibles.
- Ocupación prevista calculada con historial real.
- Usuarios ocupando espacios en el horario.
- Preferencias históricas del usuario.
- Colaboradores frecuentes cuando existen.
- Coordenadas reales del layout.

Contexto del chatbot por rol:

- Empleado: reservas actuales, historial, vehículos, vehículo principal, badges y recomendaciones.
- Administrador: KPIs, gráficas, bloqueos, reservas detalladas, ocupación y usuarios.
- Guardia: reservas de estacionamiento del día, vehículo, placa, usuario, zona y cajón.

## Flujos Principales

### Nueva Reserva

1. El usuario entra a `/nueva-reserva`.
2. Selecciona tipo de reserva:
   - Escritorio con estacionamiento.
   - Solo escritorio.
   - Solo estacionamiento.
3. Selecciona fecha y horario.
4. Si es martes o jueves, aparece un aviso de incentivo.
5. El sistema consulta disponibilidad.
6. El mapa muestra espacios disponibles, ocupados, bloqueados y recomendados por IA.
7. El usuario selecciona un espacio o continúa con estacionamiento según el tipo elegido.
8. Si la reserva requiere estacionamiento, debe seleccionar o registrar vehículo. No existe anticipación mínima de 24 horas para pedir cajón.
9. El backend crea la reserva.
10. El mapa y listados se actualizan en tiempo real.

### Check-in

1. El usuario ve su reserva del día en dashboard o en mis reservas.
2. El sistema calcula la ventana permitida.
3. Si `CHECK_IN_ALLOWED_CIDRS` está configurado, valida la red.
4. Al hacer check-in, el estado pasa a `activa`.
5. Se actualizan rachas y badges.
6. Se emite evento en tiempo real.

### Check-out

1. Una reserva `activa` muestra el botón `Check-out`.
2. El usuario puede liberar la reserva inmediatamente, aunque el check-in haya ocurrido segundos antes.
3. El backend cambia la reserva a `finalizada`.
4. El espacio deja de contar como ocupado.
5. Se emite evento en tiempo real para actualizar mapa y listados.

### Gestión Administrativa

1. El administrador abre `/admin/gestion`.
2. Selecciona fecha y horario.
3. Selecciona un espacio o sala desde el mapa.
4. Define motivo de bloqueo.
5. Confirma el bloqueo.
6. El bloqueo se refleja en tiempo real para usuarios.
7. Los bloqueos activos pueden liberarse desde la misma vista.

### Guardia

1. El guardia abre `/guardia`.
2. Consulta reservas de estacionamiento del día.
3. Puede buscar usuarios.
4. Puede revisar vehículo, placa, zona, cajón y horario.
5. Si el cajón está en zona Central, el sistema muestra el flujo de aviso a guardias T1 o T2.

## Variables de Entorno

### Backend

Crear `luminaBack-main/.env`:

```env
NODE_ENV=development
PORT=3000

JWT_SECRET=<secret-seguro>
JWT_ALGORITHM=HS256
JWT_EXPIRES_IN=3600

DATABASE_URL=postgresql://<usuario>:<password>@<host>:<puerto>/<database>

ALLOWED_ORIGINS=http://localhost:5173
TRUST_PROXY=1

RESERVATION_TIMEZONE=America/Monterrey
CHECK_IN_ALLOWED_CIDRS=

AI_PROVIDER=gemini
GEMINI_API_KEY=<gemini-api-key>
GEMINI_MODEL=gemini-2.5-flash-lite
GEMINI_FALLBACK_MODELS=gemini-2.5-flash,gemini-2.0-flash-lite
```

### Frontend

Crear `luminaFront-main/.env`:

```env
VITE_API_URL=http://localhost:3000
```

También se soporta `VITE_API_BASE_URL` por compatibilidad con configuraciones anteriores.

No subir archivos `.env`, tokens, contraseñas ni API keys al repositorio.

## Instalación Local

Requisitos:

- Node.js 20 o superior.
- npm.
- PostgreSQL o Supabase.
- API key de Gemini.

Instalar backend:

```bash
cd luminaBack-main
npm install
```

Instalar frontend:

```bash
cd luminaFront-main
npm install
```

Levantar backend:

```bash
cd luminaBack-main
npm run dev
```

Levantar frontend:

```bash
cd luminaFront-main
npm run dev
```

URLs locales:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`
- Health check backend: `http://localhost:3000/health`

## Migraciones y Seeds

Para crear la base desde cero:

```bash
psql "$DATABASE_URL" -f database/01_schema.sql
psql "$DATABASE_URL" -f database/02_seed_static.sql
```

Migraciones recomendadas desde `luminaBack-main`:

```bash
npx ts-node migrate_hu17_remove_friends_parking_only_admin_ai.ts
npx ts-node migrate_hu18_realtime_ai_indexes.ts
npx ts-node migrate_hu19_space_blocks_and_spaces.ts
npx ts-node migrate_hu20_parking_only_db_quality.ts
npx ts-node migrate_hu21_admin_performance_indexes.ts
npx ts-node migrate_hu22_vehicles_room_names_admin_search.ts
npx ts-node migrate_hu23_operational_quality.ts
npx ts-node migrate_hu24_production_db_hardening.ts
npx ts-node migrate_hu25_final_checkout_db_optimizations.ts
npx ts-node migrate_hu26_checkout_parking_immediacy.ts
```

Seeds demo:

```bash
npx ts-node seed_demo_users_and_reservations.ts
node seed_guard_user.js
```

Los seeds demo deben ejecutarse solo en desarrollo, QA o una base preparada para demostración.

## Scripts Disponibles

Backend:

```bash
npm run dev
npm run build
npm start
npm test
npm run test:watch
```

Frontend:

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm test
```

## API Principal

### Autenticación y Perfil

- `POST /auth/login`
- `GET /auth/profile`
- `PATCH /auth/profile`

### Reservas

- `GET /reservations/availability`
- `GET /reservations/occupancy`
- `GET /reservations/recommendations`
- `POST /reservations/assistant`
- `GET /reservations/events`
- `POST /reservations`
- `GET /reservations/my`
- `GET /reservations/my-stats`
- `POST /reservations/:id/check-in`
- `POST /reservations/:id/check-out`
- `DELETE /reservations/:id`

### Vehículos

- `GET /reservations/vehicles`
- `POST /reservations/vehicles`
- `PUT /reservations/vehicles/:id`
- `POST /reservations/vehicles/:id/default`
- `DELETE /reservations/vehicles/:id`

### Pisos y Espacios

- `GET /reservations/floors`
- `GET /reservations/floors/:id/spaces`

### Administración

- `GET /reservations/admin/overview`
- `GET /reservations/admin/audit-logs`
- `POST /reservations/admin/space-blocks`
- `DELETE /reservations/admin/space-blocks/:id`
- `POST /reservations/admin/area-blocks`
- `DELETE /reservations/admin/area-blocks/:id`
- `GET /reservations/users/search`

### Guardia

- `GET /reservations/guard/parking`

## Deploy en Producción

### Supabase

1. Crear proyecto en Supabase.
2. Obtener `DATABASE_URL`.
3. Ejecutar schema y seed estático.
4. Ejecutar migraciones.
5. Configurar Realtime para `reservations`, `space_blocks` y `area_blocks` si se usa Supabase Realtime adicional.
6. Guardar credenciales solo en Render, Vercel o gestor de secretos.

### Backend en Render

El archivo `render.yaml` incluye un servicio web:

- Name: `workhub-mty-api`
- Root Directory: `luminaBack-main`
- Build Command: `npm ci --include=dev && npm run build`
- Start Command: `npm start`
- Health Check Path: `/health`
- Auto Deploy: `true`

Variables requeridas en Render:

```env
NODE_ENV=production
DATABASE_URL=<database-url-produccion>
JWT_SECRET=<secret-seguro>
JWT_ALGORITHM=HS256
JWT_EXPIRES_IN=3600
ALLOWED_ORIGINS=https://<frontend-vercel>
TRUST_PROXY=1
RESERVATION_TIMEZONE=America/Monterrey
AI_PROVIDER=gemini
GEMINI_API_KEY=<gemini-api-key>
GEMINI_MODEL=gemini-2.5-flash-lite
GEMINI_FALLBACK_MODELS=gemini-2.5-flash,gemini-2.0-flash-lite
```

### Frontend en Vercel

Configuración recomendada:

- Root Directory: `luminaFront-main`
- Framework Preset: `Vite`
- Install Command: `npm ci`
- Build Command: `npm run build`
- Output Directory: `dist`

Variable requerida en Vercel:

```env
VITE_API_URL=https://<backend-render>
```

El archivo `luminaFront-main/vercel.json` redirige todas las rutas hacia `index.html`, necesario para una SPA con React Router.

### Flujo de Deploy

1. Commit en Git.
2. Push a GitHub.
3. Render detecta cambios y despliega backend por `autoDeploy`.
4. Vercel detecta cambios y despliega frontend si el proyecto está conectado al repositorio.
5. Validar `/health` del backend.
6. Validar login y flujos críticos en frontend.

## Pruebas y Validación

Validación local más reciente:

- Backend tests: `40 passed`.
- Frontend tests: `24 passed`.
- Backend build: OK.
- Frontend lint: OK.
- Frontend build: OK.
- `git diff --check`: OK.

Comandos:

```bash
cd luminaBack-main
npm test
npm run build

cd ../luminaFront-main
npm run lint
npm test
npm run build
```

Cobertura funcional principal:

- Login y perfil.
- Creación de reservas.
- Reservas con estacionamiento.
- Reservas solo de estacionamiento.
- Validación de vehículos.
- Check-in.
- Check-out.
- Cancelación.
- Incentivos por fecha.
- Recomendaciones con Gemini.
- Rechazo de recomendaciones inválidas.
- Chatbot con contexto por rol.
- Seguridad de acciones del chatbot.
- Dashboard administrativo.
- Bloqueos administrativos.
- Vista guardia.
- Rutas por rol.
- Servicios HTTP del frontend.
- Integración de nueva reserva.

## Seguridad

- No subir `.env`.
- No subir API keys.
- No subir tokens personales.
- Rotar cualquier secreto compartido accidentalmente.
- Usar bases separadas para desarrollo, QA y producción.
- Configurar `ALLOWED_ORIGINS` en producción.
- Configurar `TRUST_PROXY=1` en Render.
- Usar `CHECK_IN_ALLOWED_CIDRS` si el check-in debe restringirse a la red de oficina.
- Mantener `JWT_SECRET` largo y aleatorio.
- Ejecutar migraciones en QA antes de producción.

## Notas Operativas

- El estado `finalizada` representa reservas liberadas mediante check-out.
- Las reservas `finalizada`, `cancelada` y `no_show` no bloquean disponibilidad.
- Las reservas `confirmada` y `activa` sí bloquean disponibilidad.
- Las reservas de estacionamiento requieren vehículo.
- Las reservas de estacionamiento pueden crearse el mismo día; no hay regla de anticipación de 24 horas.
- El check-out puede ejecutarse en cualquier momento después de que la reserva esté `activa`.
- Si el usuario tiene varios vehículos, debe seleccionar cuál usará.
- El chatbot no responde con información fuera del contexto autorizado.
- Las recomendaciones no se cachean como resultado final porque deben generarse con Gemini en cada solicitud.
- El frontend puede cachear datos operativos no críticos para mejorar velocidad.
- Los deploys productivos dependen de que Vercel y Render estén conectados al repositorio de GitHub.

## Estado del Proyecto

- Repositorio: `https://github.com/alexRodArana/WorkHub_MTY`
- Backend: `luminaBack-main`
- Frontend: `luminaFront-main`
- Base de datos recomendada: Supabase/PostgreSQL
- Backend recomendado: Render
- Frontend recomendado: Vercel
- Rama productiva recomendada: `main`
