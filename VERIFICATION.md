# Verificación del cambio — 6 de octubre de 2026

## Cotizaciones

- Migración `0005_mute_sunfire` aplicada con Drizzle al proyecto autorizado. Tres tablas privadas con RLS y sin SELECT de anon/authenticated. Contador independiente en 1, cero cotizaciones de prueba en producción.
- Ocho pruebas de dominio/servicio pasaron, incluidas cotizaciones: validaciones condicionales, moneda, fechas, inversión del itinerario, validez, numeración, reintentos, conflicto por datos distintos, rollback ante error de PDF, integridad SHA-256 y exclusión de ingresos estadísticos.
- `test:quotations` pasó con Auth/API simuladas: consulta de dólar, noches automáticas, varias opciones, regreso invertido, vista previa sin guardar, respuesta perdida y reintento con el mismo UUID, descarga, historial, reutilización, sin hospedaje, solo ida, ARS a 1 y móvil sin desbordamiento horizontal.
- `test:navigation` pasó nuevamente. Los cuatro métodos/endpoints de cotizaciones rechazan peticiones anónimas con 401 y `Cache-Control: no-store`. `lint`, TypeScript y build de producción pasaron.
- PDF de ejemplo revisado visualmente en A4: una página para el modelo y continuación numerada para texto extenso. No se emitió un comprobante real para las pruebas. El logo se incluye explícitamente en el rastreo de archivos de Next para las funciones de Vercel.
- Advisor de seguridad: sin nuevos avisos WARN por las tablas. RLS sin políticas es intencional en tablas atendidas solo por el servidor. Persiste el aviso previo de protección de contraseñas filtradas: [documentación](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Las verificaciones históricas que siguen describen el estado al momento de cada etapa; la web original fue publicada posteriormente por el usuario en `https://stg-turismo.vercel.app`.

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

## Contratos - 20 de octubre de 2026

Se agregó `/admin/contratos` con carga diferida, formulario de viaje, hoteles/habitaciones/comidas, excursiones, vuelos y pasajeros; valores individuales, total del grupo, seña y resto en ARS/USD con cotización editable. El historial permite buscar por número, pasajero, DNI o destino. Las correcciones conservan el número e incrementan la versión, sin modificar documentos anteriores; las versiones desactualizadas no pueden sobrescribir una más reciente.

La migración `0006_contracts` se generó con Drizzle y se aplicó a la base configurada. La comprobación de solo lectura confirmó cero contratos y PDF, próximo número 000001, RLS habilitado y ningún permiso público sobre las tres tablas nuevas. Los avisos informativos del asesor sobre ausencia de políticas son esperados en estas tablas privadas: solo el servidor autorizado accede a ellas. No se crearon contratos ni movimientos financieros reales.

Pasaron `build`, `typecheck`, `lint`, las 18 pruebas de negocio/base/PDF y las seis pruebas de navegador: contratos, continuidad de sesión, recuperación, recibos, finanzas y cotizaciones. Auth/API se simulan en las pruebas de interfaz. Se ajustó una espera de la prueba de finanzas para comprobar los gráficos del período actualizado en lugar del estado anterior. Las cuatro operaciones de API de contratos rechazaron solicitudes anónimas con HTTP 401.

Los PDF de ejemplo se renderizaron con Poppler y se inspeccionaron visualmente. El habitual ocupa una hoja A4 con ambas firmas; el extenso ocupa tres páginas A4, con encabezados de continuación, tablas y firmas sin recortes ni páginas dedicadas únicamente a firmar. Los ejemplos no son contratos registrados. El servidor de producción local para esta revisión utiliza el puerto 3011.

### Ajustes aprobados de contratos - una sola hoja A4

Se reemplazó vuelos por Transporte (Aéreo con especificaciones o Bus Cama/Semicama), se incorporaron los cuatro regímenes de comida solicitados y las variantes Single, Doble/Triple matrimonial e individual y Cuádruple. El total puede sobrescribirse y volver al cálculo automático; el saldo y equivalente en pesos usan el total elegido. Se limitó cada contrato a seis pasajeros y tres hoteles, tanto en el formulario como en la validación del servidor.

La plantilla v2 genera exactamente una página A4 de 595,28 × 841,89 puntos, con cuerpo entre 9,5 y 8,5 puntos, ambos teléfonos y dos líneas separadas para las firmas. Reemplaza la continuación en varias páginas descrita en la etapa anterior. Si el contenido no entra, responde HTTP 400 sin guardado ni consumo de numeración; una prueba transaccional comprueba el rollback. Los PDF históricos permanecen intactos. No se requirió otra migración para estos ajustes.

Pasaron nuevamente la compilación de producción, TypeScript, Biome, las 19 pruebas de negocio/base/PDF y las seis pruebas de navegador (contratos, navegación, recibos, finanzas, cotizaciones y recuperación). La interfaz verifica límites de cantidad, ambas variantes de transporte, precio manual persistente y restablecimiento automático, recuperación tras rechazo por extensión, reintento idempotente y versiones. Auth/API simuladas; no se crearon documentos ni movimientos reales. Los ejemplos normal y de seis pasajeros/tres hoteles se renderizaron con Poppler y se revisaron visualmente: una página A4 cada uno, sin recortes ni superposiciones. La versión actualizada está ejecutándose en localhost:3011.

### Número de reserva manual y filas sin usar

Se agregó un número de reserva opcional de hasta 60 caracteres, independiente del contador de contratos y conservado con los datos de cada versión. Los registros anteriores se adaptan con el campo vacío sin modificar sus PDF. La plantilla imprime siempre tres filas de hoteles y seis de pasajeros; las filas sin usar quedan vacías, sin crear datos ni alterar los totales. Los ejemplos parcial y completo se renderizaron y revisaron visualmente en una sola hoja A4. Las 19 pruebas y Biome pasaron, incluida compatibilidad con datos anteriores, persistencia de la reserva y el caso sin hoteles/con un pasajero.

La compilación de producción con TypeScript y `test:contracts` también pasaron. El navegador comprobó el guardado de una reserva con ceros iniciales y su conservación al crear una nueva versión, sin agregar filas ficticias a la solicitud ni alterar el total. La versión se dejó ejecutándose en localhost:3011. La prueba usó Auth/API simuladas, sin registros reales.
