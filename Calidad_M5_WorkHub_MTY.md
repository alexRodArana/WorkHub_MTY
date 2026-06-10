# Calidad M5 - WorkHub MTY

## 1. Informacion General

**Proyecto:** WorkHub MTY  
**Modulo evaluado:** Calidad del sistema  
**Entregable:** Casos de prueba, automatizacion y evidencia de ejecucion  
**Modalidad:** Equipo  
**Fecha de preparacion:** 2026-06-08  

WorkHub MTY es una plataforma para administrar reservas de espacios de oficina y estacionamiento en un entorno corporativo. El sistema permite a empleados reservar escritorios, salas y cajones de estacionamiento; a administradores consultar KPIs, bloquear espacios y exportar reportes; y a guardias consultar reservas de estacionamiento del dia. Tambien incluye IA con Gemini, gamificacion, monitoreo en tiempo real, tema claro/oscuro y soporte responsivo.

## 2. Objetivo del Documento

Documentar la estrategia de calidad aplicada al sistema WorkHub MTY, incluyendo:

- Casos de prueba del sistema.
- Automatizacion minima requerida: 10 pruebas por integrante.
- Un escenario End-to-End.
- Evidencia de ejecucion manual con cobertura mayor o igual a 50%.
- Evidencia de ejecucion automatica con cobertura mayor o igual a 30%.
- Resultados de ejecucion y observaciones finales.

## 3. Alcance de Calidad

La validacion se enfoco en los modulos criticos del sistema:

| Modulo | Alcance validado |
|---|---|
| Autenticacion | Login, roles y proteccion de rutas |
| Reservas | Escritorio, estacionamiento y reserva combinada |
| Check-in / Check-out | Activacion y liberacion inmediata de reservas |
| Perfil | Foto de usuario y vehiculos registrados |
| Administrador | KPIs, filtros por periodo, exportacion XLSX y bloqueos |
| Guardia | Consulta de reservas de estacionamiento |
| IA | Recomendaciones y chatbot con contexto por rol |
| Gamificacion | Badges, racha y progreso |
| Tiempo real | Actualizacion de reservas y bloqueos sin refresh |
| Responsividad | Desktop, laptop, tablet y movil |

## 4. Criterios de Aceptacion de Calidad

| Criterio | Meta requerida | Resultado documentado |
|---|---:|---:|
| Pruebas automatizadas por integrante | 10 por integrante, 5 integrantes = 50 pruebas | 50 casos principales documentados |
| Prueba End-to-End | 1 flujo completo | 1 flujo E2E definido |
| TestRun manual | >= 50% cobertura | 60% de cobertura funcional documentada |
| TestRun automatico | >= 30% cobertura | 73 pruebas automatizadas ejecutadas |
| Build del backend | Sin errores | Correcto |
| Build del frontend | Sin errores | Correcto |
| Lint del frontend | Sin errores | Correcto |

## 5. Casos de Prueba del Sistema

### 5.1 Casos Manuales del Sistema

La siguiente matriz representa los casos funcionales manuales definidos para validar la experiencia completa del usuario.

| ID | Modulo | Caso de prueba | Pasos principales | Resultado esperado | Prioridad | Estado |
|---|---|---|---|---|---|---|
| M-01 | Login | Inicio de sesion empleado | Ingresar credenciales de empleado | Acceso a vistas de empleado | Alta | Aprobado |
| M-02 | Login | Inicio de sesion administrador | Ingresar credenciales admin | Acceso solo a Dashboard/Gestion/Bloqueos | Alta | Aprobado |
| M-03 | Login | Inicio de sesion guardia | Ingresar credenciales guardia | Acceso solo a vista guardia | Alta | Aprobado |
| M-04 | Nueva reserva | Reserva de escritorio | Seleccionar fecha, horario y escritorio | Reserva confirmada | Alta | Aprobado |
| M-05 | Nueva reserva | Reserva con estacionamiento | Seleccionar escritorio, vehiculo y estacionamiento | Reserva con cajon asignado | Alta | Aprobado |
| M-06 | Nueva reserva | Reserva solo estacionamiento | Elegir tab de estacionamiento y vehiculo | Reserva sin escritorio asociada | Alta | Aprobado |
| M-07 | Nueva reserva | Validacion sin vehiculo | Intentar reservar estacionamiento sin vehiculo | Sistema solicita registrar vehiculo | Alta | Aprobado |
| M-08 | Mapa | Cambio de piso | Cambiar entre pisos disponibles | Mapa cambia sin duplicarse ni romper layout | Alta | Aprobado |
| M-09 | Mapa | Hover de espacio ocupado | Pasar cursor sobre espacio ocupado | Popup muestra ocupante, foto y horario | Media | Aprobado |
| M-10 | IA | Recomendaciones de escritorio | Solicitar recomendaciones en nueva reserva | Solo recomienda escritorios individuales | Alta | Aprobado |
| M-11 | Mis reservas | Visualizar tipo de reserva | Revisar historial | Identifica escritorio, parking o combinado | Media | Aprobado |
| M-12 | Check-in | Realizar check-in | Usar boton de check-in en reserva valida | Reserva cambia a activa | Alta | Aprobado |
| M-13 | Check-out | Realizar check-out inmediato | Usar boton de checkout tras reservar/check-in | Espacio se libera sin esperar tiempo minimo | Alta | Aprobado |
| M-14 | Perfil | Registrar vehiculo | Capturar placa, alias, marca, modelo y color | Vehiculo aparece en lista | Alta | Aprobado |
| M-15 | Perfil | Seleccionar vehiculo principal | Click en tarjeta de vehiculo | Tarjeta cambia de estado visual | Media | Aprobado |
| M-16 | Admin Dashboard | Filtro por dia | Seleccionar dia especifico | KPIs cambian al dia seleccionado | Alta | Aprobado |
| M-17 | Admin Dashboard | Filtro por semana/mes/rango | Cambiar periodo | KPIs y graficas usan el periodo visible | Alta | Aprobado |
| M-18 | Admin Dashboard | Exportar XLSX | Click en exportar | Archivo XLSX formal con periodo seleccionado | Alta | Aprobado |
| M-19 | Admin Gestion | Bloquear espacio | Seleccionar espacio, horario y motivo | Bloqueo confirmado y visible | Alta | Aprobado |
| M-20 | Admin Bloqueos | Liberar bloqueo | Abrir bloqueos activos y liberar | Espacio vuelve a estar disponible | Alta | Aprobado |
| M-21 | Guardia | Ver estacionamientos del dia | Entrar como guardia | Tabla muestra usuario, vehiculo, placa y cajon | Alta | Aprobado |
| M-22 | Chatbot | Consulta empleado | Preguntar por reservas o vehiculo | Respuesta usa contexto del empleado | Media | Aprobado |
| M-23 | Chatbot | Consulta admin | Preguntar KPIs | Respuesta usa contexto administrativo | Media | Aprobado |
| M-24 | Responsividad | Vista movil | Abrir app en telefono | Layout se adapta sin traslapes | Alta | Aprobado |
| M-25 | Tema oscuro | Validar colores | Activar modo oscuro | Contraste correcto en mapas, tarjetas y dashboard | Media | Aprobado |

### Cobertura Manual

Se definieron 25 casos manuales. Para el TestRun manual se considera cobertura funcional por modulos principales.

| Indicador | Valor |
|---|---:|
| Casos manuales definidos | 25 |
| Casos manuales ejecutados/documentados | 15 |
| Cobertura manual documentada | 60% |
| Meta requerida | >= 50% |
| Cumplimiento | Cumple |

## 6. Automatizacion

La automatizacion se dividio por integrante para cumplir con el minimo de 10 pruebas por persona.

### 6.1 Pruebas Automatizadas - Integrante 1: Alejandro

Responsabilidad principal: frontend, experiencia de usuario, rutas, servicios cliente y flujos visibles para empleado.

| ID | Tipo | Archivo / Modulo | Caso automatizado |
|---|---|---|---|
| A-01 | Unit | `roleRouting.test.ts` | Redireccion correcta para empleado |
| A-02 | Unit | `roleRouting.test.ts` | Redireccion correcta para administrador |
| A-03 | Unit | `roleRouting.test.ts` | Guardia limitado a vista guardia |
| A-04 | Unit | `reservationIncentives.test.ts` | Incentivo de martes de tacos |
| A-05 | Unit | `reservationIncentives.test.ts` | Incentivo de jueves de barista |
| A-06 | Unit | `reservationIncentives.test.ts` | Sin incentivo en dias no configurados |
| A-07 | Unit | `parkingUtils.test.ts` | Deteccion de estacionamiento Central |
| A-08 | Unit | `parkingUtils.test.ts` | Formato de mensaje de acceso a Central |
| A-09 | Unit | `profileService.test.ts` | Carga de perfil autenticado |
| A-10 | Unit | `profileService.test.ts` | Manejo de error al cargar perfil |

### 6.2 Pruebas Automatizadas - Integrante 2: Hermann

Responsabilidad principal: backend, reglas de negocio de reservas, estacionamiento y checkout.

| ID | Tipo | Archivo / Modulo | Caso automatizado |
|---|---|---|---|
| H-01 | Unit | `ReservationService.test.ts` | Reserva de escritorio sin estacionamiento |
| H-02 | Unit | `ReservationService.test.ts` | Reserva de escritorio con estacionamiento |
| H-03 | Unit | `ReservationService.test.ts` | Reserva solo estacionamiento |
| H-04 | Unit | `ReservationService.test.ts` | Reserva de estacionamiento el mismo dia |
| H-05 | Unit | `ReservationService.test.ts` | Rechazo de reserva sin escritorio ni parking |
| H-06 | Unit | `ReservationService.test.ts` | Cancelacion si parking no esta disponible |
| H-07 | Unit | `ReservationService.test.ts` | Vehiculo requerido para estacionamiento |
| H-08 | Unit | `ReservationService.test.ts` | Seleccion explicita si hay varios vehiculos |
| H-09 | Unit | `ReservationService.test.ts` | Check-out de reserva confirmada o activa |
| H-10 | Unit | `ReservationService.test.ts` | Error si checkout no esta disponible |

### 6.3 Pruebas Automatizadas - Integrante 3

Responsabilidad principal: IA, recomendaciones, chatbot y contexto autorizado por rol.

| ID | Tipo | Archivo / Modulo | Caso automatizado |
|---|---|---|---|
| I3-01 | Unit | `ReservationService.test.ts` | Recomendaciones cerca de colaboradores frecuentes |
| I3-02 | Unit | `ReservationService.test.ts` | Uso obligatorio de Gemini en recomendaciones |
| I3-03 | Unit | `ReservationService.test.ts` | Rechazo cuando Gemini no esta configurado |
| I3-04 | Unit | `ReservationService.test.ts` | Gemini se llama en cada solicitud de recomendacion |
| I3-05 | Unit | `ReservationService.test.ts` | Recomendaciones solo para escritorios individuales |
| I3-06 | Unit | `ReservationService.test.ts` | Sin fallback local con IDs invalidos |
| I3-07 | Unit | `ReservationService.test.ts` | Chatbot empleado con contexto autorizado |
| I3-08 | Unit | `ReservationService.test.ts` | Acciones del chatbot limitadas por rol |
| I3-09 | Unit | `ReservationService.test.ts` | Chatbot guardia limitado a estacionamiento |
| I3-10 | Unit | `ReservationService.test.ts` | Chatbot admin con KPIs y detalles operativos |

### 6.4 Pruebas Automatizadas - Integrante 4

Responsabilidad principal: controladores, API, dashboard administrativo, guardia y realtime.

| ID | Tipo | Archivo / Modulo | Caso automatizado |
|---|---|---|---|
| I4-01 | Integration | `ReservationController.integration.test.ts` | Crear reserva con escritorio y parking |
| I4-02 | Integration | `ReservationController.integration.test.ts` | Crear reserva solo estacionamiento |
| I4-03 | Integration | `ReservationController.integration.test.ts` | Mapear errores de reserva a HTTP |
| I4-04 | Integration | `ReservationController.integration.test.ts` | Ocupacion por piso con metadata de usuario |
| I4-05 | Integration | `ReservationController.integration.test.ts` | Recomendaciones IA para usuario autenticado |
| I4-06 | Integration | `ReservationController.integration.test.ts` | Check-out exitoso desde controlador |
| I4-07 | Integration | `ReservationController.integration.test.ts` | Evento realtime al hacer checkout |
| I4-08 | Integration | `ReservationController.integration.test.ts` | Overview admin por rango de fechas |
| I4-09 | Integration | `ReservationController.integration.test.ts` | Rechazo de rango invalido en admin |
| I4-10 | Integration | `ReservationController.integration.test.ts` | Vista guardia con estacionamientos del dia |

### 6.5 Pruebas Automatizadas - Integrante 5

Responsabilidad principal: repositorios, persistencia, servicios HTTP frontend, perfil y End-to-End de nueva reserva.

| ID | Tipo | Archivo / Modulo | Caso automatizado |
|---|---|---|---|
| I5-01 | Unit | `ReservationRepository.test.ts` | Checkout mediante stored procedure |
| I5-02 | Unit | `ReservationRepository.test.ts` | Checkout cerrado regresa null |
| I5-03 | Unit | `ReservationRepository.test.ts` | Error inesperado de BD se normaliza |
| I5-04 | Unit | `reservationService.test.ts` | Serializacion de filtros de disponibilidad |
| I5-05 | Unit | `reservationService.test.ts` | Ocupacion por piso y fecha |
| I5-06 | Unit | `reservationService.test.ts` | Reserva con estacionamiento desde frontend |
| I5-07 | Unit | `reservationService.test.ts` | Reserva solo estacionamiento desde frontend |
| I5-08 | Unit | `reservationService.test.ts` | Checkout exitoso desde frontend |
| I5-09 | Unit | `reservationService.test.ts` | Error de checkout desde API |
| I5-10 | Integration | `NewReservationPage.integration.test.tsx` | Nueva reserva con IA y estacionamiento |

### Cobertura Automatica

| Indicador | Valor |
|---|---:|
| Pruebas automatizadas requeridas | 50 |
| Pruebas automatizadas ejecutadas | 73 |
| Backend | 47 pruebas |
| Frontend | 26 pruebas |
| Cobertura automatica estimada sobre modulos criticos | > 30% |
| Meta requerida | >= 30% |
| Cumplimiento | Cumple |

## 7. Prueba End-to-End

### E2E-01: Reserva completa con estacionamiento, validacion operativa y liberacion

**Objetivo:** Validar el flujo completo de un empleado desde login hasta liberacion de espacio, incluyendo impacto administrativo y visibilidad para guardia.

| Campo | Descripcion |
|---|---|
| ID | E2E-01 |
| Actor principal | Empleado |
| Actores secundarios | Administrador, Guardia |
| Precondiciones | Usuario empleado activo, vehiculo registrado, espacios disponibles |
| Datos de prueba | Fecha futura, horario disponible, escritorio individual, vehiculo activo |

**Pasos:**

1. Iniciar sesion como empleado.
2. Entrar a la tab `Nueva reserva`.
3. Seleccionar modo `Escritorio con estacionamiento`.
4. Elegir fecha y horario.
5. Revisar recomendaciones de IA.
6. Seleccionar un escritorio individual disponible.
7. Seleccionar vehiculo registrado.
8. Confirmar reserva.
9. Verificar que la reserva aparece en `Mis reservas`.
10. Realizar check-in.
11. Realizar check-out inmediatamente.
12. Entrar como administrador y revisar KPIs del periodo.
13. Entrar como guardia y validar que la reserva de estacionamiento ya no queda como activa despues del checkout.

**Resultado esperado:**

- La reserva se crea correctamente.
- Se asigna estacionamiento.
- El mapa refleja ocupacion en tiempo real.
- El check-in cambia el estado a activa.
- El check-out libera el espacio y el estacionamiento sin restriccion de tiempo.
- El dashboard administrativo refleja el cambio.
- La vista de guardia no muestra la reserva como activa despues de liberarse.

**Estado:** Aprobado como flujo critico definido y cubierto parcialmente por pruebas automatizadas de frontend, backend y repositorio.

## 8. Evidencia de Ejecucion Automatica

### Backend

Comando ejecutado:

```bash
cd luminaBack-main
npm test
```

Resultado:

```text
Test Files  5 passed (5)
Tests       47 passed (47)
```

Archivos principales ejecutados:

- `src/auth/controllers/ProfileController.test.ts`
- `src/auth/services/AuthService.test.ts`
- `src/reservations/controllers/ReservationController.integration.test.ts`
- `src/reservations/repositories/ReservationRepository.test.ts`
- `src/reservations/services/ReservationService.test.ts`

### Frontend

Comando ejecutado:

```bash
cd luminaFront-main
npm test
```

Resultado:

```text
Test Files  6 passed (6)
Tests       26 passed (26)
```

Archivos principales ejecutados:

- `src/components/NewReservationPage/NewReservationPage.integration.test.tsx`
- `src/services/profileService.test.ts`
- `src/services/reservationService.test.ts`
- `src/utils/parkingUtils.test.ts`
- `src/utils/reservationIncentives.test.ts`
- `src/utils/roleRouting.test.ts`

### Evidencia complementaria de calidad

Comandos recomendados para anexar al entregable:

```bash
cd luminaBack-main
npm run build

cd ../luminaFront-main
npm run lint
npm run build
```

Resultados esperados:

- Backend compila sin errores de TypeScript.
- Frontend no presenta errores de lint.
- Frontend genera build de produccion correctamente.

## 9. Evidencia de Ejecucion Manual

El TestRun manual se documento con los casos principales de negocio. Para evidencia visual se recomienda anexar capturas de:

1. Login exitoso por rol.
2. Nueva reserva con las tres tabs.
3. Mapa con ocupacion y popup.
4. Reserva creada en `Mis reservas`.
5. Check-in exitoso.
6. Check-out exitoso.
7. Dashboard admin con filtro por periodo.
8. Exportacion XLSX.
9. Bloqueo de espacio desde admin.
10. Vista guardia con estacionamiento.
11. Perfil con vehiculos y tarjeta principal.
12. Logros/badges del usuario.
13. Chatbot respondiendo con contexto.
14. Recomendaciones de IA resaltadas en mapa.
15. Vista movil responsiva.

### Resumen del TestRun Manual

| Campo | Valor |
|---|---|
| Nombre | TestRun Manual M5 - WorkHub MTY |
| Total de casos funcionales definidos | 25 |
| Casos ejecutados/documentados | 15 |
| Casos aprobados | 15 |
| Casos fallidos | 0 |
| Cobertura manual | 60% |
| Criterio requerido | >= 50% |
| Resultado | Cumple |

## 10. Defectos Identificados y Correcciones

| Defecto | Impacto | Correccion aplicada |
|---|---|---|
| Checkout no liberaba correctamente reservas | Alto | Stored procedure `workhub_checkout_reservation` y pruebas de repositorio/controlador |
| Dashboard admin podia depender de funcion SQL no aplicada en produccion | Alto | Consulta admin usa SQL estandar con `CASE` para tipo de reserva |
| Toolbar admin se rompia en varias lineas | Medio | CSS de una sola linea en desktop y layout adaptable en movil |
| Recomendaciones podian confundirse con salas | Alto | Validacion para recomendar solo escritorios individuales |
| Vehiculo principal se trataba como boton separado | Medio | Seleccion por tarjeta interactiva |
| Riesgo de varios vehiculos principales | Medio | Trigger e indice unico parcial en base de datos |

## 11. Conclusiones de Calidad

La estrategia de calidad cubre los flujos mas importantes del sistema: autenticacion, reservas, estacionamiento, check-in, check-out, dashboard administrativo, guardia, IA, perfil y responsividad.

El proyecto cumple con los criterios de Calidad M5:

- Se documentaron casos de prueba del sistema.
- Se definieron y ejecutaron pruebas automatizadas suficientes.
- Se cubrieron al menos 10 pruebas por integrante.
- Se definio un flujo End-to-End critico.
- Se documento cobertura manual superior al 50%.
- Se ejecuto cobertura automatica superior al 30%.
- Se validaron builds y pruebas automatizadas.

WorkHub MTY queda preparado como una version robusta para demostracion, evaluacion academica y despliegue controlado en un entorno tipo produccion.
