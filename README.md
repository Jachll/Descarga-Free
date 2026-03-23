# Descargador Multimedia Local (Next.js)

Aplicación web local para analizar URLs de contenido multimedia público, detectar opciones reales de formato/calidad y descargar archivos al navegador.

## Aviso importante

Este proyecto **no evade DRM**, no rompe autenticaciones privadas, ni bypass de paywalls. Está diseñado para trabajar con contenido públicamente accesible y bajo uso legal permitido.

## Stack

- Next.js (App Router) + React + TypeScript
- Tailwind CSS
- API Routes (Node.js)
- `yt-dlp` + `ffmpeg` instalados localmente

## Funcionalidades incluidas

- Campo de URL + validación estricta (`http/https`, sin hosts locales/privados)
- Análisis de metadatos:
  - título
  - miniatura
  - duración
  - extractor/fuente
  - formatos reales detectados
  - resoluciones reales detectadas
- Descarga en modos:
  - video mp4
  - audio mp3 (conversión)
- Selección de calidad:
  - mejor disponible
  - 1080p / 720p / 480p / 360p (solo si existen realmente)
- Barra de progreso y estado por trabajo de descarga
- Manejo robusto de errores
- Rate limiting básico por IP
- Carpeta temporal del sistema (`os.tmpdir`) con limpieza automática tras descarga o timeout

## Arquitectura breve

- `app/page.tsx`: vista principal
- `components/downloader-card.tsx`: UI + flujo cliente (análisis, polling de progreso, descarga en navegador)
- `app/api/analyze/route.ts`: valida URL y obtiene metadatos con `yt-dlp -J`
- `app/api/download/route.ts`: inicia trabajo de descarga asíncrono
- `app/api/progress/route.ts`: consulta estado/progreso de trabajo
- `app/api/file/route.ts`: entrega archivo final al navegador
- `lib/yt-dlp.ts`: integración central con `yt-dlp` y `ffmpeg`
- `lib/job-store.ts`: estado en memoria + limpieza de temporales
- `lib/validation.ts`: validación de inputs
- `lib/rate-limit.ts`: límite básico de solicitudes

## Requisitos previos

1. Node.js 20+
2. npm 10+
3. `yt-dlp` en PATH (o configurar `YT_DLP_BIN`)
4. `ffmpeg` en PATH (o configurar `FFMPEG_BIN`)

### Verificar dependencias externas

```bash
yt-dlp --version
ffmpeg -version
node -v
npm -v
```

## Instalación

```bash
npm install
```

## Variables de entorno

1. Copiar ejemplo:

```bash
cp .env.example .env.local
```

2. Ajustar si hace falta:

- `YT_DLP_BIN` (por defecto: `yt-dlp`)
- `FFMPEG_BIN` (opcional, ruta completa a `ffmpeg.exe`; si está en PATH, déjalo vacío)
- `FFPROBE_BIN` (opcional, ruta completa a `ffprobe.exe`; si está en PATH, déjalo vacío)
- `SOCIAL_COOKIES_FROM_BROWSER` (opcional para Facebook/Instagram: `chrome`, `edge`, `firefox`)
- `SOCIAL_COOKIES_PROFILE` (opcional, por ejemplo `Default`)
- `SOCIAL_COOKIES_FILE` (opcional, ruta a `cookies.txt`; tiene prioridad sobre browser)
- `SOCIAL_USER_AGENT` (opcional para sitios sensibles a fingerprint)
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX_REQUESTS`
- `DOWNLOAD_TIMEOUT_MS`
- `MAX_CONTENT_SECONDS`

## Ejecución en desarrollo

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Ejecución en producción local

```bash
npm run build
npm run start
```

## Flujo de uso

1. Pega URL
2. Clic en `Analizar`
3. Revisa metadatos y opciones reales
4. Selecciona modo/calidad
5. Clic en `Descargar`
6. Sigue barra de progreso
7. El archivo se descarga desde el navegador

## ¿Por qué puede salir error?

Casos comunes:

1. `yt-dlp` no instalado o no disponible en PATH
2. `ffmpeg` no instalado (especialmente para `mp3`)
3. `FFMPEG_BIN`/`FFPROBE_BIN` con valor incorrecto (si usas PATH, no pongas `ffmpeg` literal en `FFMPEG_BIN`)
4. URL inválida o no pública
5. Recurso con DRM o autenticación privada
6. Plataforma no compatible con versión actual de `yt-dlp`
7. Contenido demasiado largo según `MAX_CONTENT_SECONDS`
8. Rate limit alcanzado temporalmente

## Facebook e Instagram

Para mejorar compatibilidad en reels/posts que requieren sesion, usa tus cookies locales del navegador en `.env.local`:

```env
SOCIAL_COOKIES_FROM_BROWSER=chrome
SOCIAL_COOKIES_PROFILE=Default
```

Luego reinicia `npm run dev`.

Si el navegador bloquea la base de cookies, usa archivo `cookies.txt`:

```env
SOCIAL_COOKIES_FILE=C:\ruta\cookies.txt
```

## Seguridad y límites implementados

- Validación de URL y protocolo
- Bloqueo de hosts locales/privados (mitiga SSRF básico)
- Rate limiting por IP
- Timeout de procesamiento
- Restricción de duración de contenido
- Limpieza automática de temporales

## Notas

- El soporte no es universal; depende de compatibilidad real de `yt-dlp` y del origen del contenido.
- Si vas a usar esta app en más equipos/usuarios, añade almacenamiento persistente de jobs y autenticación.

