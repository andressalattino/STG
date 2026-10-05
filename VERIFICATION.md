# Verificación del cambio — 2 de octubre de 2026

## Comprobado

- Egresos y estadísticas: migración `0004_eager_karma` aplicada mediante Drizzle al Supabase autorizado. Tabla privada con RLS, permisos directos de anon/authenticated revocados, restricciones de importes y anulación e índice por fecha de pago. No se cargaron egresos de prueba en la base real.
- `tests/finance.test.ts`: cálculo decimal, grandes sumas sin perder centavos, fechas válidas, ARS a 1, idempotencia, anulación auditable, saldo negativo, agregación PostgreSQL diaria/semanal/mensual, días vacíos y límites inclusivos en Argentina. Aislamiento de los roles públicos comprobado con PGlite.
- `test:finance`: formulario ARS/USD, reintento del mismo envío ante respuesta incierta, historial, anulación, filtros de fechas, agrupación, gráficos, tabla de detalle y escritorio/celular. API/Auth simuladas, sin emisiones ni pagos reales.
- Asesores de Supabase: la tabla de egresos usa RLS sin políticas de acceso directo de forma deliberada; las API de Next validan administrador antes de consultar con Drizzle. Índices nuevos sin uso todavía son informativos. El asesor también informa una configuración de Auth preexistente: [protección de contraseñas filtradas desactivada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection); no se cambiaron planes ni ajustes de Auth como parte de esta función.

- `npm run build`: compilación de producción, TypeScript y generación de rutas correctas.
- `npm run lint`: Biome sin errores ni advertencias.
- `npm test`: cálculos decimales, validación, fechas de Argentina, migraciones, numeración desde 000001, reintentos sin duplicación y reversión de la transacción cuando falla el PDF. PostgreSQL embebido mediante PGlite, sin usar datos remotos.
- Políticas SQL comprobadas localmente: los roles anónimo y autenticado no acceden al esquema de recibos; solo un administrador puede subir archivos a los buckets públicos autorizados. Los esquemas administrados por Supabase se representan con estructuras mínimas en estas pruebas.
- `npm run test:ui`: Chrome de escritorio y viewport móvil. Inicio de sesión, cotización automática y manual, emisión, actualización de historial, descarga, alternativa de compartir en local, error del proveedor y reinicio de ARS a 1. API y Auth simuladas; sin envíos de mensajes ni altas de recibos reales.
- Acceso HTTP anónimo al servidor Next real: nueve rutas administrativas responden 401. Enlace compartido con formato inválido responde 404. Sin escrituras en base remota.
- `npm run db:generate`: sin diferencias respecto del esquema Drizzle guardado.
- PDF de ejemplo revisado visualmente: una página A4 de 595 × 842 puntos, dos copias, logotipo y diseño del modelo original, importes en ARS/USD con datos ficticios.
- `npm audit --omit=dev`: cero vulnerabilidades informadas al ejecutar la revisión.

## Conexión al nuevo Supabase

El usuario autorizó usar `andressalattino's Project` (`noumohegwglspdnjjrwj`) de la organización `andressalattino's Org`. El destino estaba vacío: sin tablas de aplicación, usuarios de Auth ni objetos de Storage. Se aplicaron las cuatro migraciones Drizzle mediante la integración de Supabase y se registraron sus hashes y fechas en el historial de Drizzle para evitar que vuelvan a ejecutarse.

Se verificaron las ocho tablas de aplicación con RLS, el contador inicial 1, cero recibos emitidos y los tres buckets públicos de viajes. Los roles anon y authenticated no tienen acceso al esquema privado de recibos. La URL y clave publicable del nuevo proyecto están guardadas en `.env.local`, excluido de Git.

La API Auth responde desde el equipo local. La API pública rechaza el esquema privado de recibos con HTTP 406. El asesor de seguridad reportó únicamente información sobre RLS sin políticas: es deliberado en las tablas que se consultan exclusivamente desde el servidor. Referencia: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy. Se agregó un índice a la clave foránea de los enlaces compartidos para resolver el aviso de rendimiento.

DATABASE_URL está guardada en `.env.local` mediante un formulario local, sin mostrar credenciales. Se verificó la conexión Session pooler desde el equipo: `npm run db:check` informa cero recibos, próximo número 000001 y cero administradores. `npm run db:migrate` completó correctamente contra Supabase sin repetir las migraciones ya registradas. El endpoint real Next.js `/api/content/trips` respondió HTTP 200 con la lista vacía usando Drizzle y la base remota. Las nueve rutas administrativas volvieron a rechazar peticiones anónimas con HTTP 401.

El usuario creó y confirmó el acceso de `stglorena@hotmail.com`. Se verificó en la base que esa cuenta tiene el correo confirmado y su fila en `app_admins`. `stgturismo@hotmail.com` no está registrado. Después de recuperar el acceso, el usuario confirmó que pudo ingresar y que funciona. Las pruebas automatizadas de emisión siguen usando datos simulados; no se emitieron comprobantes de prueba contra la base real.

## Continuidad de sesión entre administración y recibos

El editor y los recibos ahora comparten un layout persistente en `/admin`; la recuperación de contraseña permanece fuera de ese layout. Cambiar de sección conserva el panel y la sesión validada, además del borrador del editor. La comprobación inicial de permisos muestra un estado de carga y es independiente de las consultas de viajes y fotos. Un fallo temporal del servidor muestra una opción de reintento, sin presentar un login incorrectamente. Las comprobaciones pendientes se invalidan al cerrar sesión o iniciar otra validación; también se escucha el cierre de sesión de Supabase.

`npm run test:navigation` pasó con Auth y API simuladas: un solo login, navegación de ida y vuelta sin insertar el formulario de login en el DOM, conservación del borrador, restauración de sesión con contenido inaccesible, reintento tras un error de autorización HTTP 503 y cierre de sesión explícito. También pasaron nuevamente `test:ui`, `test:auth`, `typecheck` y `lint`.

El formulario temporal de recuperación registró `fetch failed` al comunicarse con Supabase y no confirmó un cambio de contraseña. Se reemplazó ese flujo por `/admin/recuperar`, accesible desde **Olvidé mi contraseña**. Usa Supabase Auth desde el navegador, valida los enlaces, conserva la sesión de recuperación solo en memoria y elimina credenciales de la dirección al recibir una redirección. Pasaron `npm run test:auth` con Auth simulada (solicitud, verificación, actualización, redirección y límite de correos), `npm run test:ui`, `npm run typecheck` y `npm run lint`; no se enviaron correos ni se cambiaron contraseñas reales durante las pruebas. La configuración de redirección remota todavía debe apuntar al puerto 3010; la página admite pegar el enlace del correo o una redirección anterior al puerto 3000 mientras se corrige esa configuración.

El respaldo `db_cluster-03-09-2026@16-15-21.backup.gz` se inspeccionó sin ejecutarlo: contiene esquemas administrados de Supabase, cero usuarios de Auth, un bucket y cero objetos de Storage; no incluye tablas de aplicación de STG. No se restauró ni se modificó el proyecto anterior.

La prueba local concurrente verifica reintentos idénticos, pero PGlite serializa operaciones. Aún no se comprobó concurrencia entre servidores independientes contra el PostgreSQL remoto.

No se desplegó la web ni se probó un enlace público real de siete días. Compartir por correo o WhatsApp queda bajo control del usuario, mediante archivo o enlace.

El análisis completo de dependencias mantiene cuatro avisos moderados de desarrollo provenientes de la cadena `drizzle-kit → @esbuild-kit → esbuild`. La solución automática propuesta por npm implica retroceder Drizzle Kit a una versión incompatible con el esquema actual; no se aplicó ese cambio. No aparecen esos paquetes en las dependencias de producción. Reevaluar la actualización de Drizzle Kit cuando exista una versión estable compatible que retire esa dependencia.

El servidor de pruebas local utiliza el puerto 3010. No se modificó Grafana ni el proyecto de práctica `sistema-recibos-stg`.
