# Descarga Free

Aplicacion web para analizar URLs de contenido multimedia publico, detectar formatos reales y descargar video MP4 o audio MP3 desde una interfaz moderna construida con Next.js.

## Resumen

Descarga Free esta pensada para ejecutarse localmente o desplegarse como servicio web con backend Node.js. La app valida URLs, consulta metadatos con `yt-dlp`, muestra resoluciones reales, permite descargar en MP4 o convertir a MP3 y expone progreso y errores de forma clara.

## Caracteristicas

- Interfaz responsive con Next.js, React y Tailwind CSS.
- Analisis de metadatos: titulo, miniatura, duracion, fuente y formatos detectados.
- Descarga en `Video MP4` y `Audio MP3`.
- Seleccion de resolucion basada en opciones reales detectadas.
- Progreso de descarga y estados de error legibles.
- Limpieza automatica de archivos temporales.
- Protecciones basicas: validacion estricta de URL, rate limiting y limites de tiempo.
- Soporte opcional para cookies en redes sociales cuando se usa una instancia privada.

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- `yt-dlp`
- `ffmpeg` / `ffprobe`

## Requisitos

- Node.js 20 o superior
- npm 10 o superior
- `yt-dlp` accesible desde PATH o por variable de entorno
- `ffmpeg` y `ffprobe` accesibles desde PATH o por variable de entorno

Comprueba instalacion:

```powershell
yt-dlp --version
ffmpeg -version
ffprobe -version
node -v
npm -v
```

## Desarrollo local

1. Instala dependencias:

```powershell
npm install
```

2. Crea variables locales:

```powershell
Copy-Item .env.example .env.local
```

3. Inicia en desarrollo:

```powershell
npm run dev
```

4. Abre:

[http://localhost:3000](http://localhost:3000)

## Variables de entorno

Variables principales:

- `YT_DLP_BIN`: comando o ruta de `yt-dlp`.
- `FFMPEG_BIN`: ruta completa a `ffmpeg.exe` si no esta en PATH. Si ya esta en PATH, dejalo vacio.
- `FFPROBE_BIN`: ruta completa a `ffprobe.exe` si no esta en PATH. Si ya esta en PATH, dejalo vacio.
- `RATE_LIMIT_WINDOW_MS`: ventana del rate limit.
- `RATE_LIMIT_MAX_REQUESTS`: maximo de solicitudes por ventana.
- `DOWNLOAD_TIMEOUT_MS`: timeout maximo de procesamiento.
- `MAX_CONTENT_SECONDS`: duracion maxima permitida.

Variables opcionales para redes sociales en uso privado:

- `SOCIAL_COOKIES_FILE`
- `SOCIAL_COOKIES_FROM_BROWSER`
- `SOCIAL_COOKIES_PROFILE`
- `SOCIAL_USER_AGENT`

Importante:

- No subas `cookies.txt` ni cookies privadas a GitHub.
- En un despliegue publico no se recomienda usar cookies personales del navegador.

## Despliegue publico

La app ya quedo preparada para desplegarse con Docker en Render:

- [Dockerfile](C:\Users\USUARIO\Documents\CODEX\DESCARGAR VIDEOS\Dockerfile)
- [render.yaml](C:\Users\USUARIO\Documents\CODEX\DESCARGAR VIDEOS\render.yaml)

### Opcion recomendada: Render

1. Entra a [Render](https://render.com/).
2. Crea un nuevo `Web Service`.
3. Conecta el repositorio:
   [https://github.com/Jachll/Descarga-Free](https://github.com/Jachll/Descarga-Free)
4. Render detectara el `Dockerfile`.
5. Despliega usando el `render.yaml`.

Healthcheck:

- `GET /api/health`

Notas para produccion:

- Deja vacias las variables de cookies si el servicio sera publico.
- Asegurate de revisar consumo y limites del hosting, porque `yt-dlp` y `ffmpeg` usan CPU y disco temporal.

## Seguridad y limites

- Solo se aceptan URLs `http/https`.
- Se bloquean hosts locales o privados para reducir riesgo de SSRF.
- Se aplican limites basicos de solicitudes por IP.
- Se limpia almacenamiento temporal de trabajos finalizados.
- No se soporta DRM, paywalls ni recursos privados autenticados ajenos.

## Problemas comunes

- `ffmpeg` o `ffprobe` no encontrados:
  deja `FFMPEG_BIN=` y `FFPROBE_BIN=` vacios si ambas herramientas ya estan en PATH.
- Error con cookies del navegador:
  cierra Chrome/Edge completamente o usa `SOCIAL_COOKIES_FILE`.
- Facebook/Instagram sin audio o sin analisis:
  depende de si el enlace publico expone stream progresivo o requiere sesion.
- Despliegue publico:
  algunos hostings serverless no son buena opcion para `yt-dlp`; por eso este repo esta preparado para Docker.

## Comandos utiles

```powershell
npm run dev
npm run lint
npm run build
```

## Estado del proyecto

Repositorio:

[https://github.com/Jachll/Descarga-Free](https://github.com/Jachll/Descarga-Free)

La rama principal ya esta lista para seguir iterando y desplegar.
