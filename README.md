# STG Viajes y Turismo

Sitio y administración en Next.js App Router, React, TypeScript y Tailwind CSS. Drizzle accede a PostgreSQL de Supabase desde el servidor. Supabase Auth gestiona las sesiones y Storage conserva las imágenes y los PDF públicos de viajes. Biome revisa y formatea el código.

## Puesta en marcha

Requiere Node.js 22 LTS y un proyecto Supabase.

```powershell
cd Z:\STG-web\stg
npm ci
```

1. Configurar `.env.local` siguiendo [SUPABASE_SETUP.md](SUPABASE_SETUP.md). Usar `.env.example` como referencia; conservar las variables existentes de `.env`.
2. Ejecutar `npm run db:migrate` para crear las tablas y las políticas de Storage. Las migraciones conservan los viajes, fotos, comentarios y administradores existentes.
3. Configurar al menos un administrador en Supabase Auth y `public.app_admins` como explica la guía.
4. Ejecutar `npm run db:check` para comprobar las tablas, la numeración y la existencia de administradores sin generar recibos.
5. Ejecutar `npm run dev` y abrir <http://localhost:3010>. Grafana puede seguir usando 3000.

PowerShell: si la política de ejecución bloquea npm, usar `npm.cmd` en los mismos comandos. No hace falta cambiar esa política.

## Uso

Entrar a `/admin` con el correo y la contraseña del administrador real. Desde allí se gestionan los viajes, fotos, comentarios y **Recibos** (`/admin/recibos`). No hay credenciales incluidas en el código ni acceso administrativo de demostración.

La navegación de administración también incluye **Egresos** (`/admin/egresos`) y **Estadísticas** (`/admin/estadisticas`); todas las secciones comparten la sesión.

En Egresos se registra la fecha del pago, destinatario, concepto, categoría, moneda ARS/USD, importe, cotización, medio de pago y, opcionalmente, referencia y notas. ARS utiliza cotización 1. Para USD se ingresa la cotización del pago; el botón de dólar oficial ofrece una referencia actual. La conversión a ARS se guarda con el egreso. Un reintento del mismo envío no crea otro registro. Para corregir un egreso, anularlo indicando un motivo y cargar el correcto: el registro anulado permanece en el historial y no se suma a las estadísticas.

Las estadísticas muestran ingresos (suma de los totales ARS de los recibos), egresos activos y saldo **ingresos menos egresos**. Los ingresos se asignan a la fecha de emisión del recibo y los egresos a la fecha de pago. Se puede elegir la semana actual (lunes a hoy), el mes actual, el año actual o fechas personalizadas inclusivas, según la hora argentina. El saldo representa los cobros y pagos registrados, sin calcular resultados contables de operaciones no cargadas.

Los gráficos permiten agrupar por día, semana o mes. El modo automático utiliza días hasta 62 días, semanas hasta 366 días y meses para períodos mayores. Se admiten períodos de hasta diez años; la agrupación diaria se limita a un año. Las semanas/meses extremos pueden ser parciales. La tabla desplegable presenta los importes exactos; los gráficos usan valores aproximados solo para dibujar las escalas. `npm run db:check:finance` verifica la consulta real sin modificar datos.

El nuevo sistema comienza en **000001**. Los recibos anteriores de Google Sheets no se importan automáticamente. La migración nunca reinicia un contador existente.

Completar cliente, moneda, importe, reserva, pasajeros, fecha y destino. La forma de pago figura también en el modelo PDF. En ARS, la cotización es 1. En USD se consulta la cotización **oficial de venta** de DolarAPI, mostrando cuándo fue actualizada y permitiendo cambiarla. Si el proveedor falla, se puede ingresar el valor manualmente. No usar separadores de miles al escribir importes; se admite punto o coma decimal.

El historial incluye todos los datos solicitados, búsqueda, moneda, fechas de emisión y paginación. Los horarios se muestran en Argentina. En pantallas pequeñas, deslizar la tabla horizontalmente para ver todas las columnas.

Cada PDF utiliza el modelo suministrado, con dos copias en una página A4. **Abrir / imprimir** abre el visor del navegador; imprimir en A4, tamaño real/100 %. **Descargar** guarda el archivo con su número y cliente. **Compartir** permite descargar para adjuntar por correo/WhatsApp o usar el menú nativo en dispositivos compatibles. En producción se pueden crear enlaces válidos por siete días y abrir WhatsApp o el correo con el mensaje preparado. El usuario elige el destinatario y confirma el envío. Un enlace de localhost no funciona para el cliente remoto.

Los PDF emitidos se guardan completos junto con el recibo en la misma transacción de PostgreSQL, dentro del esquema privado `stg_private`. No se publican en Storage ni se regeneran al descargarlos. La numeración se bloquea durante cada emisión; repetir el mismo envío recupera el recibo existente. Ante una respuesta de red incierta, usar el botón de reintento del mismo formulario sin recargar la página.

## Cotizaciones de viaje

Desde **Administración → Cotizaciones** (`/admin/cotizaciones`) se preparan propuestas en ARS o USD, con precio total para todos los pasajeros, cotización editable, fechas, destino y validez en horas (72 por defecto). ARS utiliza cotización 1; el dólar oficial se puede consultar como referencia. Las fechas calculan las noches y se permite ajustarlas.

El transporte clásico permite un tramo de ida. El mixto permite hasta seis tramos (aéreo, bus, tren o crucero); **Ida y vuelta** agrega el itinerario inverso, en orden inverso. Se admiten hasta ocho alternativas de hospedaje: cada precio es el total del paquete con esa opción, no un adicional ni una suma de hoteles. También se puede indicar sin hospedaje, pensión, cantidades totales de equipaje, asistencia, traslados, excursiones y aclaraciones.

**Vista previa A4** genera un borrador sin guardar ni consumir números. **Guardar cotización y PDF** crea una cotización numerada desde 000001, independiente de recibos y estadísticas. Datos y PDF se guardan de forma atómica en el esquema privado; reintentar una respuesta incierta usa el mismo identificador. Los documentos emitidos no se sobrescriben. En el historial se puede buscar, abrir/imprimir, descargar o **Usar como base** para una nueva propuesta. El PDF puede adjuntarse por WhatsApp/correo y, en dispositivos compatibles, compartirse desde el menú nativo.

El PDF sigue el estilo del modelo con logo, amarillo y azul, resumen, transporte, hospedaje y servicios. El ejemplo habitual ocupa una hoja A4; el contenido extenso continúa en hojas A4 numeradas, sin recortes. Los emojis o símbolos no imprimibles se rechazan sin guardar un documento parcial.

Aplicar `npm run db:migrate` antes de publicar esta versión. `npm run test:quotations` prueba el formulario con API simulada; `npm run pdf:quotation` genera ejemplos en `.artifacts`, sin registrar cotizaciones reales.

## Organización

| Carpeta | Responsabilidad |
| --- | --- |
| `src/app` | Rutas Next.js y API HTTP |
| `src/components/site`, `src/components/admin` | Sitio público y administración existente |
| `src/features/receipts` | Formulario, historial, acciones y validaciones compartidas |
| `src/server` | Autorización, emisión transaccional y PDF |
| `src/db`, `drizzle` | Modelo Drizzle y migraciones versionadas |
| `assets/receipts` | Plantilla PDF sin los datos personales del ejemplo |
| `tests` | Pruebas de negocio, PostgreSQL local y navegador |

Las credenciales PostgreSQL se usan únicamente en el servidor. Cada operación administrativa valida el token con Supabase Auth y la pertenencia a `app_admins`. Los enlaces compartidos utilizan un token aleatorio cuyo hash se guarda con la caducidad. Cualquier persona que tenga el enlace puede leer ese comprobante hasta su vencimiento.

## Validación

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

`npm test` usa PostgreSQL embebido (PGlite) y prueba cálculos decimales, validación, fechas, migraciones, numeración, reintentos y reversión completa si falla el PDF. No conecta con la base real. La concurrencia real entre múltiples servidores requiere verificación en una base de prueba remota.

Para probar la interfaz con API/Auth simuladas, dejar `npm run dev` ejecutándose y, en otra terminal:

```powershell
npx playwright install chromium
npm run test:ui
npm run test:navigation
npm run test:finance
```

También puede usarse Chrome instalado definiendo `STG_BROWSER_EXECUTABLE` con su ruta. `STG_TEST_BASE_URL` cambia la URL objetivo; `STG_TEST_OUTPUT_DIR` cambia la carpeta de capturas (por defecto `.artifacts`). Las pruebas no envían mensajes ni generan recibos reales.

## Publicación y mantenimiento

Usar un servidor compatible con Next.js/Node; este proyecto necesita API y no es un sitio estático exportable. Configurar las mismas variables en el hosting, añadir el dominio HTTPS real a `NEXT_PUBLIC_SITE_URL`, ejecutar migraciones y después `npm run build` y `npm start`. Si el hosting asigna un puerto, ejecutar `npx next start --port $env:PORT` en PowerShell o el equivalente del proveedor.

Conservar copias de seguridad de PostgreSQL: incluyen recibos y PDF. Aproximadamente 80 KB por PDF con la plantilla actual; revisar espacio al crecer. Los archivos públicos de viajes en Storage tienen su propia copia de seguridad. Los borradores que antes estaban solo en localStorage/IndexedDB permanecen ligados al navegador, equipo y puerto originales; no se importan solos al cambiar de URL. No borrar la versión anterior hasta recuperar esos borradores, si existen.

Para cambiar el próximo número antes de la primera emisión, existe `npm run db:numbering -- NUMERO`; rechaza el cambio cuando ya hay recibos. No es necesario ejecutarlo para comenzar en 000001.

## Documentación oficial para aprender

- [Next.js: App Router](https://nextjs.org/docs/app): páginas, layouts y API.
- [TypeScript](https://www.typescriptlang.org/docs/): tipos y comprobación antes de ejecutar.
- [Drizzle con PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql): consultas tipadas y migraciones.
- [Tailwind CSS 3](https://v3.tailwindcss.com/docs): versión usada para conservar el diseño existente.
- [Supabase](https://supabase.com/docs): PostgreSQL, Auth y Storage.
- [Biome](https://biomejs.dev/guides/getting-started/): formato y análisis estático.
- [DolarAPI: dólar oficial](https://dolarapi.com/docs/argentina/operations/get-dolar-oficial): fuente de la cotización.
