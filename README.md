# Catálogo de videojuegos

Aplicación web estática con un backend Node.js/Express y MongoDB. GitHub Pages aloja gratis la web estática, pero **no ejecuta Express ni aloja la base de datos**. Para conservar el panel de administración, las imágenes y los datos, el backend debe estar desplegado por separado en un servicio compatible con Node.js y conectado a MongoDB.

## Publicar la web en GitHub Pages

1. Sube este proyecto a un repositorio de GitHub. El workflow de Pages se ejecuta al actualizar la rama `main`; si tu rama principal tiene otro nombre, cambia la rama en `.github/workflows/pages.yml`.
2. Despliega el backend (consulta la sección siguiente) y copia su URL pública HTTPS.
3. En `public/js/config.js`, configura la URL base del backend, sin `/` al final:

   ```js
   window.CATALOG_API_BASE_URL = 'https://tu-backend.example.com';
   ```

   No pongas aquí contraseñas ni claves. La URL del backend es pública; `ADMIN_KEY` debe permanecer como variable privada del servicio backend.
4. En GitHub, abre **Settings → Pages** y elige **GitHub Actions** como origen de publicación.
5. Envía los cambios a `main`. Al terminar el workflow, GitHub mostrará la dirección pública, normalmente `https://USUARIO.github.io/REPOSITORIO/`.

Los recursos del sitio usan rutas relativas para funcionar tanto en esa URL de proyecto como en un dominio propio. El panel se encuentra en `/REPOSITORIO/admin.html`.

## Desplegar el backend

Usa un proveedor que permita ejecutar una aplicación Node.js desde este repositorio. Configura su comando de inicio como `npm start` y establece estas variables en la configuración privada del proveedor:

- `MONGODB_URI`: cadena de conexión de MongoDB Atlas u otro MongoDB accesible desde el backend.
- `ADMIN_KEY`: contraseña larga y única para el panel de administración.
- `CORS_ORIGINS`: orígenes permitidos, separados por comas y sin `/` final. Por ejemplo:

  ```text
  https://USUARIO.github.io,https://catalogo.tudominio.com
  ```

- `DB_NAME` (opcional): nombre de la base de datos. Por defecto es `Catálogo_videojuegos`.
- `PORT` normalmente lo asigna el proveedor; el servidor lo detecta automáticamente.

Configura en MongoDB los permisos de red necesarios para que el backend pueda conectarse. No publiques `MONGODB_URI` ni `ADMIN_KEY` en GitHub, en `public/js/config.js` ni en ningún archivo enviado a Pages.

El servidor aplica CORS según `CORS_ORIGINS` y acepta los preflight necesarios para las operaciones del panel y la carga de imágenes. Si el navegador informa un error CORS, verifica que el origen coincida exactamente con el sitio (esquema y dominio, sin ruta ni barra final).

## Usar un dominio propio

Pages ofrece una dirección gratuita `github.io`. Para usar un dominio propio, debes ser titular de un dominio y configurarlo en **Settings → Pages → Custom domain**; el registro y la renovación del dominio pueden tener costo. Configura también los registros DNS indicados por GitHub. Si usas un dominio personalizado, agrega su origen a `CORS_ORIGINS` y, si corresponde, crea `public/CNAME` con el dominio antes de desplegar.

## Ejecutar localmente

1. Crea un archivo `.env` con `MONGODB_URI` y `ADMIN_KEY`.
2. Ejecuta `npm install` y luego `npm start`.
3. Abre `http://localhost:3000`. El panel está en `/admin.html`.

Para desarrollo, `public/js/config.js` puede quedar vacío: así el frontend usa la API servida por el mismo Express.
