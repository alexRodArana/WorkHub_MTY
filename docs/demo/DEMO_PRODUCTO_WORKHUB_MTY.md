# Demo de Producto - WorkHub MTY

Este documento deja lista la presentacion del sistema como producto. La base de datos se preparo con perfiles reales de demostracion, fotos de perfil tipo avatar, vehiculos, reservas, badges y bloqueos administrativos.

## Estado de la Base de Demo

Seed ejecutado:

```bash
cd luminaBack-main
npx ts-node seed_production_demo_data.ts
```

Resultado validado:

- 16 usuarios demo activos.
- 13 empleados con perfil, foto y vehiculo registrado.
- 2 usuarios guardia.
- 1 administrador.
- 50 reservas demo.
- Reservas de escritorio, escritorio con estacionamiento y solo estacionamiento.
- Estados variados: confirmada, activa, finalizada, cancelada y no_show.
- 2 bloqueos administrativos activos.
- Badges precargadas en usuarios seleccionados.
- Usuario especial listo para desbloquear una badge en vivo.

Todas las cuentas demo usan la misma contrasena:

```text
WorkHubDemo123!
```

## Perfiles Principales para Presentar

| Rol | Usuario | Correo | Uso recomendado |
|---|---|---|---|
| Empleado principal | Ana Garcia | `ana.garcia@lumina.demo` | Dashboard, mapa con avatar, checkout, perfil con 2 vehiculos y logros |
| Empleado para badge en vivo | Lucia Moreno | `lucia.moreno@lumina.demo` | Crear una nueva reserva para desbloquear badge |
| Administrador | Admin Demo | `admin.demo@lumina.demo` | KPIs, filtros, exportacion XLSX, gestion y bloqueos |
| Guardia | Guardia Demo | `guardia.demo@lumina.demo` | Estacionamientos reservados del dia |
| Empleado con varias reservas | Diego Martinez | `diego.martinez@lumina.demo` | Historial, ocupacion y recomendaciones |

## Guion Recomendado de Presentacion

Duracion sugerida: 10 a 15 minutos.

### 1. Login y propuesta de valor

Cuenta:

```text
ana.garcia@lumina.demo
WorkHubDemo123!
```

Mostrar:

- Login corporativo.
- Acceso por rol.
- Dashboard del empleado.
- Resumen de reservas, racha y accesos rapidos.

Mensaje:

> WorkHub MTY centraliza reservas de oficina y estacionamiento para facilitar el regreso ordenado a la oficina, evitando friccion operativa y dando visibilidad en tiempo real.

### 2. Nueva reserva con mapa e IA

Ruta:

```text
/nueva-reserva
```

Mostrar:

- Tres modos de reserva:
  - Escritorio + estacionamiento.
  - Solo escritorio.
  - Solo estacionamiento.
- Selector de fecha y horario.
- Mapa por piso.
- Avatares de usuarios en espacios ocupados.
- Espacios recomendados por IA.
- Incentivo por dia si aplica.

Accion recomendada:

- Cambiar entre pisos.
- Hacer hover sobre un espacio ocupado.
- Seleccionar un escritorio disponible.
- Explicar que la IA solo recomienda escritorios individuales y usa contexto real.

### 3. Checkout en vivo

Cuenta:

```text
ana.garcia@lumina.demo
```

Estado preparado:

- Ana tiene una reserva activa el 10/06/2026 de 09:00 a 11:00 en `PB-10` con estacionamiento.

Accion:

1. Ir a `Mis reservas`.
2. Buscar la reserva activa.
3. Presionar checkout.
4. Confirmar que el espacio se libera.

Mensaje:

> El checkout no tiene espera minima; si el usuario se va antes, libera escritorio y estacionamiento inmediatamente.

### 4. Desbloquear badge durante la presentacion

Cuenta:

```text
lucia.moreno@lumina.demo
WorkHubDemo123!
```

Estado preparado:

- Lucia tiene 4 reservas historicas.
- Tiene la badge `Bienvenido`.
- No tiene `Cafecito en la Mano`.
- Al crear una quinta reserva, debe desbloquear `Cafecito en la Mano`.

Accion:

1. Iniciar sesion como Lucia.
2. Ir a `Nueva reserva`.
3. Elegir `Solo escritorio`.
4. Seleccionar una fecha futura y horario disponible.
5. Seleccionar un escritorio recomendado o disponible.
6. Confirmar reserva.
7. Mostrar la animacion de badge desbloqueada.
8. Ir a `Logros` para ver la badge con color.

Mensaje:

> La gamificacion incentiva el uso recurrente de la oficina y permite visualizar progreso de adopcion.

### 5. Perfil y vehiculos

Cuenta:

```text
ana.garcia@lumina.demo
```

Mostrar:

- Foto de perfil.
- Departamento y datos del empleado.
- Vehiculos registrados.
- Cambio de vehiculo principal haciendo click en la tarjeta.
- Botones editar/eliminar.

Mensaje:

> El registro de vehiculos permite asignar estacionamiento correctamente y mostrar informacion clara a guardias.

### 6. Dashboard administrativo

Cuenta:

```text
admin.demo@lumina.demo
WorkHubDemo123!
```

Ruta:

```text
/admin
```

Mostrar:

- KPIs operativos.
- Filtro por dia, semana, mes y rango.
- Busqueda de usuario.
- Graficas y tarjetas expandibles.
- Exportacion XLSX del periodo visible.

Accion:

- Cambiar periodo a `Dia`.
- Seleccionar la fecha actual.
- Expandir una metrica.
- Exportar XLSX.

Mensaje:

> La vista admin convierte la ocupacion en informacion accionable para Workplace: demanda por piso, espacios subutilizados, cancelaciones, no-shows y estacionamiento.

### 7. Gestion y bloqueos

Cuenta:

```text
admin.demo@lumina.demo
```

Rutas:

```text
/admin/gestion
/admin/bloqueos
```

Mostrar:

- Mapa completo sin recomendaciones IA.
- Seleccion de espacio para bloquear.
- Panel derecho con fecha, horario y motivo.
- Confirmacion de bloqueo.
- Pestaña separada de bloqueos activos.
- Liberar bloqueo.

Accion:

- Seleccionar un escritorio disponible.
- Escribir motivo: `Mantenimiento de demo`.
- Confirmar bloqueo.
- Ir a `Bloqueos`.
- Mostrar el bloqueo y liberarlo si se desea.

### 8. Vista guardia

Cuenta:

```text
guardia.demo@lumina.demo
WorkHubDemo123!
```

Ruta:

```text
/guardia
```

Mostrar:

- Solo acceso a vista Guardia.
- Reservas de estacionamiento del dia.
- Busqueda por nombre, placa, cajon o zona.
- Usuario, vehiculo, placa, horario, zona y cajon.

Mensaje:

> Guardia tiene una vista acotada al dato operativo que necesita, sin acceso a informacion administrativa o de empleado.

### 9. Chatbot con IA

Mostrar por rol:

- Empleado: preguntar por reservas, vehiculos o badges.
- Admin: preguntar por KPIs o ocupacion.
- Guardia: preguntar por estacionamientos del dia.

Preguntas sugeridas:

```text
Que reservas tengo hoy?
Que vehiculo tengo registrado?
Que badges tengo desbloqueadas?
Cual es la ocupacion de hoy?
Quien tiene estacionamiento reservado hoy?
```

Mensaje:

> El asistente usa Gemini con contexto autorizado por rol. Si el contexto no contiene un dato, debe decirlo en vez de inventar.

## Casos de Prueba para Demostracion

| ID | Caso | Rol | Resultado esperado | Screenshot |
|---|---|---|---|---|
| TC-01 | Login por rol | Todos | Acceso redirige a la vista correspondiente | `docs/demo/screenshots/TC-01-login/01-login.png` |
| TC-02 | Dashboard empleado | Empleado | KPIs personales y accesos rapidos visibles | `docs/demo/screenshots/TC-02-dashboard-empleado/01-dashboard-empleado.png` |
| TC-03 | Nueva reserva con mapa e IA | Empleado | Mapa completo, avatares y recomendaciones IA | `docs/demo/screenshots/TC-03-nueva-reserva-ia-mapa/01-nueva-reserva-ia-mapa.png` |
| TC-04 | Mis reservas y checkout | Empleado | Reservas visibles y checkout disponible | `docs/demo/screenshots/TC-04-mis-reservas-checkout/01-mis-reservas-checkout.png` |
| TC-05 | Logros/badges | Empleado | Badges con progreso y estados visuales | `docs/demo/screenshots/TC-05-logros-badges/01-logros-badges.png` |
| TC-06 | Perfil y vehiculos | Empleado | Perfil, foto y vehiculos registrados | `docs/demo/screenshots/TC-06-perfil-vehiculos/01-perfil-vehiculos.png` |
| TC-07 | Dashboard admin | Admin | KPIs, filtros y exportacion disponibles | `docs/demo/screenshots/TC-07-admin-dashboard-kpis/01-admin-dashboard-kpis.png` |
| TC-08 | Gestion de bloqueos | Admin | Mapa y panel para bloquear espacio | `docs/demo/screenshots/TC-08-admin-gestion-bloqueo/01-admin-gestion-bloqueo.png` |
| TC-09 | Bloqueos activos | Admin | Bloqueos separados del mapa y liberables | `docs/demo/screenshots/TC-09-admin-bloqueos-activos/01-admin-bloqueos-activos.png` |
| TC-10 | Guardia estacionamiento | Guardia | Tabla de estacionamientos del dia | `docs/demo/screenshots/TC-10-guardia-estacionamiento/01-guardia-estacionamiento.png` |
| TC-11 | Responsividad movil | Empleado | Nueva reserva usable en movil | `docs/demo/screenshots/TC-11-responsive-mobile/01-mobile-nueva-reserva.png` |

## Checklist Antes de Presentar

1. Ejecutar backend y frontend o abrir produccion.
2. Confirmar login con Ana, Lucia, Admin y Guardia.
3. No hacer la reserva de Lucia antes de la presentacion si se quiere mostrar la badge en vivo.
4. Verificar que Ana tenga una reserva activa para checkout.
5. Verificar que hay bloqueos demo en Admin > Bloqueos.
6. Probar una pregunta del chatbot con una cuenta de empleado.
7. Tener abierto el README y esta guia por si preguntan por arquitectura, stack o pruebas.

## Orden de Impacto Recomendado

1. Login y dashboard empleado.
2. Mapa con IA y avatares.
3. Reserva en vivo con Lucia para desbloquear badge.
4. Checkout en vivo con Ana.
5. Perfil y vehiculos.
6. Dashboard admin y XLSX.
7. Gestion de bloqueos.
8. Vista guardia.
9. Chatbot por rol.

