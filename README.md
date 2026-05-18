# WorkHub MTY

WorkHub MTY es una aplicación web para administrar reservas de espacios de oficina, estacionamiento, check-in, ocupación en tiempo real y operación administrativa sobre planos interactivos. El proyecto está dividido en una SPA de React y una API REST con Node.js, TypeScript y PostgreSQL/Supabase.

La solución cubre tres perfiles principales:

- Empleados: reservan espacios, solicitan estacionamiento como parte de una reserva, consultan ocupación, hacen check-in y administran su perfil.
- Administradores: revisan KPIs operativos y bloquean espacios o salas desde un mapa de gestión.
- Guardia: consulta únicamente las reservas de estacionamiento del día.

## Tabla de Contenido

- [Características](#características)
- [Stack Tecnológico](#stack-tecnológico)
- [Arquitectura](#arquitectura)
- [Estructura del Repositorio](#estructura-del-repositorio)
- [Requisitos](#requisitos)
- [Variables de Entorno](#variables-de-entorno)
- [Instalación](#instalación)
- [Base de Datos y Migraciones](#base-de-datos-y-migraciones)
- [Ejecución Local](#ejecución-local)
- [Scripts](#scripts)
- [Roles y Accesos](#roles-y-accesos)
- [Flujos Principales](#flujos-principales)
- [IA con Gemini](#ia-con-gemini)
- [API Principal](#api-principal)
- [Pruebas y Calidad](#pruebas-y-calidad)
- [Notas de Seguridad](#notas-de-seguridad)

## Características

- Autenticación con JWT y protección por roles.
- Reservas por fecha, horario, piso y tipo de espacio.
- Estacionamiento ligado obligatoriamente a una reserva de oficina.
- Mapa interactivo por piso con imagen de fondo, zonas, escritorios y salas.
- Hover contextual sobre espacios con piso, nombre, ocupante, foto y horario.
- Avatares sobre lugares reservados en el mapa.
- Recomendaciones de reserva con IA usando Gemini.
- Recomendaciones visuales en el mapa con brillo y explicación breve al hacer hover.
- Las recomendaciones de IA solo consideran escritorios individuales, no salas ni áreas colaborativas.
- Chatbot con Gemini para consultas de reservas, recomendaciones e insights autorizados.
- Monitoreo en tiempo real mediante Server-Sent Events para reservas, cancelaciones, check-ins y bloqueos.
- Check-in con ventana configurable y validación opcional por CIDR.
- Perfil de usuario con carga de foto desde desktop o móvil.
- Gamificación con badges, progreso y animaciones al desbloquear logros.
- Dashboard de empleado con reserva del día, racha, acciones rápidas e historial.
- Dashboard administrador con KPIs, gráficas, distribución por piso, categoría, hora y usuarios activos.
- Gestión administrador con mapa completo para bloquear/liberar espacios por fecha y horario.
- Vista guardia exclusiva para estacionamientos reservados del día.
- Tema claro/oscuro con paleta consistente.
- Diseño responsivo para desktop y móvil.
- Mensajes de error y confirmación con auto-cierre y animación.

## Stack Tecnológico

### Frontend

- React 18
- TypeScript
- Vite
- React Router
- CSS Modules
- Vitest
- Testing Library
- MSW para pruebas de servicios

### Backend

- Node.js
- Express
- TypeScript
- PostgreSQL con `pg`
- Supabase/PostgreSQL como base de datos
- JWT con `jsonwebtoken`
- `bcrypt` para contraseñas
- `express-rate-limit` para login
- Vitest
- Supertest

### IA

- Gemini API mediante Google Generative Language API.
- Modelo por defecto: `gemini-2.5-flash-lite`.
- Modelos fallback configurables.

## Arquitectura

```text
WorkHub MTY
├── luminaFront-main
│   ├── React SPA
│   ├── Componentes de vistas
│   ├── Servicios HTTP
│   ├── Hooks de tiempo real
│   └── Pruebas frontend
│
├── luminaBack-main
│   ├── API Express
│   ├── Autenticación y perfil
│   ├── Reservas, disponibilidad y check-in
│   ├── Admin, guardia y gamificación
│   ├── Recomendaciones y chatbot con Gemini
│   ├── Repositorios PostgreSQL
│   └── Migraciones y seeds
│
└── README.md
```

La comunicación frontend-backend ocurre por HTTP REST. Los cambios operativos se propagan al cliente mediante Server-Sent Events desde `GET /reservations/events`.

## Estructura del Repositorio

```text
.
├── README.md
├── luminaBack-main
│   ├── src
│   │   ├── auth
│   │   ├── reservations
│   │   └── shared
│   ├── migrate_*.ts
│   ├── seed_demo_users_and_reservations.ts
│   ├── seed_guard_user.js
│   └── package.json
└── luminaFront-main
    ├── src
    │   ├── components
    │   ├── data
    │   ├── hooks
    │   ├── services
    │   ├── types
    │   └── utils
    └── package.json
```

## Requisitos

- Node.js 20 o superior.
- npm.
- PostgreSQL compatible con `DATABASE_URL`.
- API key de Gemini para recomendaciones y chatbot.
- Un ambiente de base de datos de desarrollo o QA antes de usar migraciones destructivas.

## Variables de Entorno

Crear `luminaBack-main/.env`:

```env
# JWT
JWT_SECRET=<secret-seguro>
JWT_ALGORITHM=HS256
JWT_EXPIRES_IN=3600

# Servidor
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173
TRUST_PROXY=1

# Base de datos
DATABASE_URL=postgresql://<usuario>:<password>@<host>:<puerto>/<database>

# Reservas y check-in
RESERVATION_TIMEZONE=America/Monterrey
CHECK_IN_ALLOWED_CIDRS=10.0.0.0/8,192.168.0.0/16
# CHECK_IN_WINDOW_OVERRIDE_MINUTES=30

# IA
AI_PROVIDER=gemini
GEMINI_API_KEY=<gemini-api-key>
GEMINI_MODEL=gemini-2.5-flash-lite
GEMINI_FALLBACK_MODELS=gemini-2.5-flash,gemini-2.0-flash-lite
# GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
```

Crear `luminaFront-main/.env` si la API no corre en `http://localhost:3000`:

```env
VITE_API_URL=http://localhost:3000
```

No subas archivos `.env` ni claves reales al repositorio.

## Instalación

Instalar dependencias del backend:

```bash
cd luminaBack-main
npm install
```

Instalar dependencias del frontend:

```bash
cd ../luminaFront-main
npm install
```

## Base de Datos y Migraciones

Ejecutar migraciones desde `luminaBack-main`.

Migraciones principales del estado actual:

```bash
npx ts-node migrate_hu17_remove_friends_parking_only_admin_ai.ts
npx ts-node migrate_hu18_realtime_ai_indexes.ts
npx ts-node migrate_hu19_space_blocks_and_spaces.ts
```

Estas migraciones cubren:

- Eliminación del sistema de amigos.
- Eliminación de reservas independientes de estacionamiento.
- Obligatoriedad de `space_id` en reservas.
- Índices para disponibilidad, ocupación, IA y tiempo real.
- Tabla `space_blocks` para bloqueos por espacio.
- Tabla `area_blocks` para bloqueos por área.
- Rol `guardia`.
- Validación y carga de espacios esperados por piso.
- Actualización de conteos reales en `floors.total_spaces`.

Para datos demo:

```bash
npx ts-node seed_demo_users_and_reservations.ts
node seed_guard_user.js
```

Ejecuta seeds solo en bases de desarrollo o QA.

## Ejecución Local

Backend:

```bash
cd luminaBack-main
npm run dev
```

Frontend:

```bash
cd luminaFront-main
npm run dev
```

URLs por defecto:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

## Scripts

Backend:

```bash
npm run dev      # API en modo desarrollo
npm run build    # Compila TypeScript a dist
npm start        # Ejecuta dist/index.js
npm test         # Pruebas backend
npm run test:watch
```

Frontend:

```bash
npm run dev      # Vite dev server
npm run build    # TypeScript + build de Vite
npm run preview  # Preview del build
npm run lint     # ESLint
npm test         # Pruebas frontend
```

## Roles y Accesos

### Employee

Rutas disponibles:

- `/dashboard`
- `/nueva-reserva`
- `/mis-reservas`
- `/logros`
- `/perfil`

Capacidades:

- Reservar espacios.
- Solicitar estacionamiento como complemento de una reserva.
- Ver disponibilidad y ocupación en mapa.
- Usar recomendaciones de IA.
- Hacer check-in.
- Cancelar reservas.
- Gestionar foto de perfil.
- Ver logros y racha.

### Admin / Administrador

Rutas disponibles:

- `/admin`
- `/admin/gestion`

Capacidades:

- Consultar KPIs y gráficas operativas.
- Revisar ocupación por piso, categoría, hora y estado.
- Ver usuarios con más actividad.
- Bloquear espacios o salas por fecha y horario desde el mapa.
- Liberar bloqueos.

### Guard / Guardia

Ruta disponible:

- `/guardia`

Capacidades:

- Ver únicamente reservas de estacionamiento del día.
- Consultar usuario, horario, código de reserva, zona y cajón.

El guardia no tiene acceso a dashboard, reservas, perfil, logros ni administración.

## Flujos Principales

### Nueva Reserva

1. El usuario selecciona fecha, horario, piso y categoría.
2. El frontend consulta disponibilidad.
3. El mapa muestra espacios disponibles, ocupados y ocupantes reales.
4. Gemini selecciona recomendaciones solo entre escritorios individuales disponibles.
5. El usuario selecciona un espacio.
6. Opcionalmente solicita estacionamiento si cumple la regla de anticipación.
7. Se crea la reserva y se actualiza el mapa en tiempo real.

### Gestión Administrador

1. El administrador abre `/admin/gestion`.
2. Define fecha, hora de inicio, hora de fin y motivo.
3. Selecciona un espacio o sala directamente en el mapa.
4. Se abre el modal de confirmación.
5. Al confirmar, el espacio queda bloqueado para ese rango.
6. El bloqueo se refleja en tiempo real para otros usuarios.

### Check-in

1. El usuario ve la reserva del día en el dashboard.
2. El sistema calcula si está dentro de la ventana permitida.
3. Si `CHECK_IN_ALLOWED_CIDRS` está configurado, valida la red.
4. El check-in cambia el estado a `activa`.
5. Se recalculan rachas y badges.

## IA con Gemini

El proyecto usa Gemini para dos flujos:

- Recomendaciones visuales en el mapa de nueva reserva.
- Chatbot dentro de la aplicación.

Reglas implementadas:

- La API requiere `GEMINI_API_KEY`.
- `AI_PROVIDER` debe ser `gemini` o `google`.
- Cada solicitud de recomendaciones consulta Gemini obligatoriamente.
- Las recomendaciones finales se seleccionan por Gemini, no por un fallback local ni por caché.
- Si Gemini devuelve IDs inválidos, se descartan.
- No existe fallback local que invente recomendaciones finales.
- Solo se envían a Gemini candidatos que sean escritorios individuales:
  - `priority_category = escritorio`
  - `layout_type = desk`
  - `is_active = true`
  - `visual_only = false`
- El chatbot recibe contexto autorizado y tiene instrucciones de no inventar reservas, espacios ni datos operativos.
- Si Gemini no está configurado, no responde válido o no está disponible, el backend devuelve error en lugar de fabricar una respuesta local.

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
- `DELETE /reservations/:id`

### Pisos y Espacios

- `GET /reservations/floors`
- `GET /reservations/floors/:id/spaces`

### Administración

- `GET /reservations/admin/overview`
- `POST /reservations/admin/space-blocks`
- `DELETE /reservations/admin/space-blocks/:id`
- `POST /reservations/admin/area-blocks`
- `DELETE /reservations/admin/area-blocks/:id`

### Guardia

- `GET /reservations/guard/parking`

## Reglas de Negocio

- Toda reserva requiere un espacio reservable.
- El estacionamiento no puede reservarse de forma independiente.
- El estacionamiento requiere al menos 24 horas de anticipación.
- Un usuario no puede tener reservas de oficina traslapadas.
- Un usuario no puede tener estacionamientos traslapados.
- Un espacio ocupado o bloqueado no aparece como disponible.
- Los bloqueos administrativos se evalúan por fecha y traslape de horario.
- Las recomendaciones IA no recomiendan salas.
- El guardia solo puede acceder a la vista de guardia.

## Pruebas y Calidad

Validaciones recomendadas antes de subir cambios:

```bash
cd luminaBack-main
npm test
npm run build

cd ../luminaFront-main
npm run lint
npm test
npm run build
```

Estado validado localmente:

- Backend tests: `20 passed`.
- Backend build: OK.
- Frontend lint: OK.
- Frontend tests: `15 passed`.
- Frontend build: OK.

La cobertura incluye:

- Autenticación y perfil.
- Creación de reservas.
- Reglas de estacionamiento.
- Rechazo de reservas sin espacio.
- Recomendaciones con Gemini.
- Filtro de recomendaciones solo para escritorios individuales.
- Descarte de IDs inválidos devueltos por Gemini.
- Chatbot con contexto autorizado.
- Ocupación y disponibilidad.
- Admin overview y bloqueos.
- Guardia y estacionamiento.
- Rutas por rol.
- Integración de nueva reserva en frontend.

## Notas de Seguridad

- No subir `.env`, tokens, passwords ni API keys.
- Rotar cualquier secreto que haya sido compartido fuera de un gestor seguro.
- Usar una base de datos separada para desarrollo, QA y producción.
- Probar migraciones destructivas en QA antes de producción.
- Configurar `ALLOWED_ORIGINS` en producción.
- Configurar `TRUST_PROXY=1` en plataformas con proxy administrado.
- Definir `CHECK_IN_ALLOWED_CIDRS` si el check-in debe limitarse a la red de oficina.

## Estado Actual

- Rama de trabajo: `admin-space-management-badges`.
- Repositorio remoto: `https://github.com/alexRodArana/WorkHub_MTY`.
- La aplicación está preparada para correr localmente con backend en `3000` y frontend en `5173`.
