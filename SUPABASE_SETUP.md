# Conectar STG con Supabase

## 1. Encontrar la conexión de la base

1. Abrir <https://supabase.com/dashboard> y elegir el proyecto que ya usa STG.
2. Presionar **Connect**, en la parte superior del proyecto.
3. Elegir la cadena **URI** y el método **Session pooler**. Es la opción adecuada para el desarrollo local con IPv4. Copiar el texto completo que muestra el panel.
4. Abrir o crear `Z:\STG-web\stg\.env.local` y agregar `DATABASE_URL="CADENA-COPIADA"`.
5. Reemplazar `[YOUR-PASSWORD]` por la contraseña de la **base de datos**. Es distinta de la contraseña de tu cuenta Supabase y del administrador de la web. No dejar los corchetes.
6. Conservar exactamente el host, el usuario y el puerto indicados. No usar la URL HTTPS del proyecto como DATABASE_URL. Si la contraseña incluye caracteres como `@`, `#`, `/` o `:`, codificarlos para URL; no enviarla a una web de terceros para convertirla.

Si no recordás la contraseña, Supabase permite restablecerla desde la configuración de la base. Ese cambio puede afectar otras aplicaciones que usen la misma contraseña; actualizar sus conexiones si corresponde. No pegar credenciales en chats, capturas ni Git.

Referencia: [Conectar a PostgreSQL, documentación oficial](https://supabase.com/docs/guides/database/connecting-to-postgres).

## 2. Variables públicas

El proyecto existente ya puede tener estas variables en `.env`. No hace falta duplicarlas:

```env
NEXT_PUBLIC_SUPABASE_URL="https://TU-PROYECTO.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="TU-CLAVE-PUBLICABLE"
```

Se obtienen en el panel del proyecto, sección de conexión/API Keys. Se usa la clave publicable (o la clave anon pública del proyecto existente), nunca `service_role` en una variable `NEXT_PUBLIC_`. Las antiguas variables `VITE_*` ya no se utilizan.

## 3. Crear las tablas

Desde la carpeta del proyecto:

```powershell
npm run db:migrate
```

Las migraciones crean las tablas de contenido si faltan, los recibos privados, su contador inicial **000001** y las políticas/buckets para archivos públicos de viajes. Mantienen los registros anteriores. No es necesario ejecutar los antiguos archivos SQL sueltos: ahora el historial de migraciones está en `drizzle/`.

Los buckets `trip-images`, `passenger-images` y `trip-pdfs` son para contenido público del sitio. Los recibos se guardan en PostgreSQL privado, nunca en esos buckets. Los buckets ya existentes conservan su configuración.

## 4. Habilitar al administrador

Si ya tenés un usuario en Auth y su fila en `public.app_admins`, podés seguir usando ese acceso.

Si falta, ir a **Authentication → Users → Add user** y crear el usuario con tu correo y una contraseña propia. Copiar su UUID y ejecutar en el SQL Editor:

```sql
insert into public.app_admins (user_id)
values ('REEMPLAZAR-CON-UUID-DEL-USUARIO')
on conflict (user_id) do nothing;
```

No se concede permiso de administrador solo por poder iniciar sesión. La web valida ambas cosas. El correo y la contraseña de ese usuario son los que se ingresan en `/admin`.

### Recuperar la contraseña de la web

El inicio de sesión incluye **Olvidé mi contraseña**, que abre `/admin/recuperar`. La solicitud y el cambio se realizan desde el navegador mediante Supabase Auth. No se usan formularios temporales ni se guardan contraseñas en archivos.

En Supabase → Authentication → URL Configuration, configurar **Site URL** como `http://localhost:3010` durante el desarrollo y agregar `http://localhost:3010/admin/recuperar` a **Redirect URLs**. El puerto 3000 de este equipo corresponde a Grafana. Al publicar, reemplazar las direcciones locales por el dominio HTTPS real.

La página admite el enlace de recuperación copiado directamente del correo. También permite pegar la dirección completa de una redirección local anterior, incluido su fragmento `#`, para recuperar el acceso mientras se corrige la configuración de URL. Las credenciales se verifican con Supabase; no se envían a las direcciones pegadas ni se guardan en el almacenamiento del navegador. No copiar esos enlaces en chats.

Un correo enviado no confirma un cambio de contraseña. El cambio solo se completa cuando Supabase acepta la contraseña nueva y aparece **Contraseña actualizada**. Si el enlace venció o se usó, solicitar uno nuevo; si aparece un límite de correos, esperar antes de reenviar.

## 5. Comprobar y arrancar

```powershell
npm run db:check
npm run dev
```

Abrir <http://localhost:3010/admin/recibos>. Reiniciar Next si se cambiaron las variables de entorno. La comprobación no emite recibos de prueba ni muestra credenciales. La primera emisión real será 000001 si la base sigue vacía.

## 6. Compartir enlaces cuando se publique

Definir `NEXT_PUBLIC_SITE_URL` con el dominio HTTPS real del sitio, sin ruta. Recompilar y reiniciar. Los enlaces creados desde **Compartir** vencen a los siete días. En local se puede descargar, imprimir y adjuntar el archivo manualmente; no se deben enviar enlaces localhost a los clientes.

## Problemas habituales

- `Falta DATABASE_URL`: guardar `.env.local` en la raíz de `stg`, no en `src` ni en el proyecto de práctica `sistema-recibos-stg`.
- Error de contraseña: verificar la contraseña PostgreSQL, su codificación y que se reemplazaron los corchetes.
- `Tenant or user not found`: volver a copiar la URI del panel, incluido el usuario `postgres.REFERENCIA` y el host del pooler.
- Error de conexión: comprobar que el proyecto no esté pausado, que la red permita el puerto del pooler y que la URI sea Session pooler.
- Sesión sin permisos: verificar `public.app_admins` y que el UUID corresponda al usuario correcto.
- Tablas inexistentes: ejecutar las migraciones contra el mismo proyecto indicado por las variables públicas.
- Subidas denegadas: comprobar usuario administrador, políticas de Storage y buckets. Las fotos admiten hasta 8 MB y los PDF públicos hasta 20 MB.

## Cambiar de cuenta o de proyecto

La carpeta `Z:\STG-web\stg` puede quedarse donde está. Una cuenta de Supabase administra organizaciones y proyectos; el código de la web se conecta a un proyecto mediante sus variables de entorno.

Si hay datos que conservar, revisar primero la [transferencia entre organizaciones](https://supabase.com/docs/guides/platform/project-transfer). Requiere ser propietario de la organización de origen y miembro de la de destino; Supabase también verifica el cupo de proyectos del plan de destino. El [límite gratuito](https://supabase.com/docs/guides/platform/billing-on-supabase) es de dos proyectos activos entre las organizaciones donde el usuario es Owner o Administrator. Los proyectos pausados no cuentan. Crear otra organización por sí solo no aumenta ese límite.

Para conectar un **proyecto nuevo vacío**, actualizar juntos `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `DATABASE_URL` en `.env.local`, ejecutar `npm run db:migrate`, crear/habilitar al administrador y verificar con `npm run db:check`. Esto crea la estructura, no copia los datos del proyecto anterior.

Para migrar **datos existentes** a un proyecto distinto, antes de cambiar la conexión hay que respaldar/restaurar la base (incluidos usuarios de Auth y permisos) y copiar por separado los objetos de Storage. También deben actualizarse las URL de imágenes/PDF que apunten al dominio anterior y revisarse la configuración de Auth. Un backup SQL no incluye los archivos de Storage. Conservar el origen y las copias hasta validar recuentos y archivos en el destino. Ver [migraciones dentro de Supabase](https://supabase.com/docs/guides/platform/migrating-within-supabase).
