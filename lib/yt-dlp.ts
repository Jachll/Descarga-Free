import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { AnalyzeResult, DownloadMode, QualityOption } from "@/types/media";
import { ensureRootDir, jobDir, updateJob } from "@/lib/job-store";

const YT_DLP_BIN = process.env.YT_DLP_BIN ?? "yt-dlp";
const FFMPEG_BIN = process.env.FFMPEG_BIN;
const FFPROBE_BIN_ENV = process.env.FFPROBE_BIN;
const SOCIAL_COOKIES_FROM_BROWSER = process.env.SOCIAL_COOKIES_FROM_BROWSER?.trim();
const SOCIAL_COOKIES_PROFILE = process.env.SOCIAL_COOKIES_PROFILE?.trim();
const SOCIAL_COOKIES_FILE = process.env.SOCIAL_COOKIES_FILE?.trim();
const SOCIAL_USER_AGENT = process.env.SOCIAL_USER_AGENT?.trim();
const DOWNLOAD_TIMEOUT_MS = Number(process.env.DOWNLOAD_TIMEOUT_MS ?? 900000);
const MAX_CONTENT_SECONDS = Number(process.env.MAX_CONTENT_SECONDS ?? 14400);

function isPathLike(value: string) {
  return value.includes("\\") || value.includes("/") || /^[A-Za-z]:/.test(value);
}

function shouldUseFfmpegLocation() {
  if (!FFMPEG_BIN) return false;
  return isPathLike(FFMPEG_BIN) || FFMPEG_BIN.toLowerCase().endsWith(".exe");
}

function resolveFfprobeBinary() {
  if (FFPROBE_BIN_ENV) return FFPROBE_BIN_ENV;
  if (FFMPEG_BIN && shouldUseFfmpegLocation()) {
    const ffmpegName = path.basename(FFMPEG_BIN).toLowerCase();
    if (ffmpegName === "ffmpeg" || ffmpegName === "ffmpeg.exe") {
      return path.join(path.dirname(FFMPEG_BIN), process.platform === "win32" ? "ffprobe.exe" : "ffprobe");
    }
  }
  return "ffprobe";
}

interface YtDlpJson {
  title?: string;
  thumbnail?: string;
  duration?: number;
  extractor_key?: string;
  webpage_url?: string;
  formats?: Array<{
    format_id?: string;
    ext?: string;
    height?: number;
    vcodec?: string;
    acodec?: string;
    filesize?: number;
  }>;
}

function isStoryboardFormat(formatId?: string, ext?: string) {
  if (!formatId) return false;
  return formatId.startsWith("sb") || ext === "mhtml";
}

function isPlayableVideoFormat(format: NonNullable<YtDlpJson["formats"]>[number]) {
  return (
    !isStoryboardFormat(format.format_id, format.ext) &&
    Boolean(format.vcodec) &&
    format.vcodec !== "none" &&
    Boolean(format.height)
  );
}

function isMetaPlatformUrl(rawUrl: string) {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    return (
      host.includes("facebook.com") ||
      host.includes("fb.watch") ||
      host.includes("instagram.com")
    );
  } catch {
    return false;
  }
}

function socialAccessArgs(rawUrl: string) {
  if (!isMetaPlatformUrl(rawUrl)) return [] as string[];

  const args: string[] = [];
  if (SOCIAL_USER_AGENT) {
    args.push("--user-agent", SOCIAL_USER_AGENT);
  }

  if (SOCIAL_COOKIES_FILE) {
    args.push("--cookies", SOCIAL_COOKIES_FILE);
    return args;
  }

  if (SOCIAL_COOKIES_FROM_BROWSER) {
    const source = SOCIAL_COOKIES_PROFILE
      ? `${SOCIAL_COOKIES_FROM_BROWSER}:${SOCIAL_COOKIES_PROFILE}`
      : SOCIAL_COOKIES_FROM_BROWSER;
    args.push("--cookies-from-browser", source);
  }

  return args;
}

function explainSocialCookieError(message: string) {
  const lower = message.toLowerCase();
  if (
    lower.includes("could not copy chrome cookie database") ||
    lower.includes("could not copy edge cookie database") ||
    lower.includes("cookies")
  ) {
    return "No se pudo leer cookies del navegador. Cierra Chrome/Edge completamente o usa SOCIAL_COOKIES_FILE con un cookies.txt y reinicia el servidor.";
  }
  return message;
}

function runCommand(args: string[], timeoutMs = 120_000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(YT_DLP_BIN, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Tiempo de análisis agotado"));
    }, timeoutMs);

    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });

    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`No se pudo ejecutar yt-dlp: ${err.message}`));
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(stderr || "yt-dlp devolvió un error"));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function normalizeResolutions(formats: NonNullable<YtDlpJson["formats"]>) {
  const heights = [
    ...new Set(
      formats
        .filter(isPlayableVideoFormat)
        .map((f) => f.height)
        .filter((h): h is number => Boolean(h))
    )
  ].sort((a, b) => b - a);
  return ["best", ...heights.map((h) => `${h}p`)];
}

function detectModes(formats: NonNullable<YtDlpJson["formats"]>): DownloadMode[] {
  const hasVideo = formats.some(isPlayableVideoFormat);
  const hasAudio = formats.some((f) => f.acodec && f.acodec !== "none");
  const modes: DownloadMode[] = [];
  if (hasVideo) modes.push("video");
  if (hasAudio) modes.push("mp3");
  return modes;
}

export async function analyzeUrl(url: string): Promise<AnalyzeResult> {
  const args = ["-J", "--no-playlist", "--no-warnings", ...socialAccessArgs(url), url];
  let stdout = "";
  try {
    ({ stdout } = await runCommand(args));
  } catch (error) {
    const msg = error instanceof Error ? explainSocialCookieError(error.message) : "Error al analizar la URL";
    if (isMetaPlatformUrl(url) && !SOCIAL_COOKIES_FROM_BROWSER && !SOCIAL_COOKIES_FILE) {
      throw new Error(
        "Facebook/Instagram pueden requerir sesion. Configura SOCIAL_COOKIES_FROM_BROWSER (ej: edge) o SOCIAL_COOKIES_FILE en .env.local y reinicia el servidor."
      );
    }
    throw new Error(msg);
  }
  const parsed = JSON.parse(stdout) as YtDlpJson;

  if (!parsed.title || !parsed.formats?.length) {
    throw new Error("No se pudieron obtener formatos compatibles para esta URL");
  }

  if (parsed.duration && parsed.duration > MAX_CONTENT_SECONDS) {
    throw new Error("El contenido excede la duración permitida para esta instalación local");
  }

  return {
    title: parsed.title,
    thumbnail: parsed.thumbnail,
    duration: parsed.duration,
    webpageUrl: parsed.webpage_url || url,
    source: parsed.extractor_key ?? "Desconocido",
    availableResolutions: normalizeResolutions(parsed.formats),
    availableModes: detectModes(parsed.formats),
    options: parsed.formats
      .filter((f) => f.format_id && f.ext)
      .map((f) => ({
        formatId: f.format_id as string,
        ext: f.ext as string,
        height: f.height,
        acodec: f.acodec,
        vcodec: f.vcodec,
        filesz: f.filesize
      }))
  };
}

function selectorFromQuality(mode: DownloadMode, quality: QualityOption, rawUrl: string) {
  const isMeta = isMetaPlatformUrl(rawUrl);
  if (mode === "mp3") return "bestaudio/best";

  // Meta (Facebook/Instagram) works more reliably with progressive MP4 first.
  if (isMeta) {
    if (quality === "best") {
      return "b[ext=mp4]/b/bv*+ba";
    }
    return `b[height<=${quality}][ext=mp4]/b[ext=mp4]/b[height<=${quality}]/b/bv*[height<=${quality}]+ba`;
  }

  if (quality === "best") {
    return "b[ext=mp4]/bv*[ext=mp4]+ba[ext=m4a]/bv*[ext=mp4]+ba[acodec^=mp4a]/bv*+ba[ext=m4a]/bv*+ba/b[ext=mp4]/b";
  }

  return `b[height<=${quality}][ext=mp4]/b[ext=mp4]/bv*[height<=${quality}][ext=mp4]+ba[ext=m4a]/bv*[height<=${quality}][ext=mp4]+ba[acodec^=mp4a]/bv*[height<=${quality}]+ba[ext=m4a]/bv*[height<=${quality}]+ba/b[height<=${quality}]/b`;
}

function isIntermediateVariant(name: string) {
  // yt-dlp frequently leaves temporary/variant names like ".f137." for stream fragments.
  return /\.f\d+\./i.test(name) || /\.fhls-/i.test(name) || /\.temp\./i.test(name);
}

async function hasAudioStream(filePath: string) {
  const ffprobeBin = resolveFfprobeBinary();
  return new Promise<boolean>((resolve) => {
    const child = spawn(
      ffprobeBin,
      [
        "-v",
        "error",
        "-select_streams",
        "a:0",
        "-show_entries",
        "stream=codec_name",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        filePath
      ],
      { windowsHide: true }
    );

    let stdout = "";
    child.stdout.on("data", (d) => {
      stdout += d.toString();
    });

    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0 && stdout.trim().length > 0));
  });
}

async function pickOutputFile(dir: string, files: string[], mode: DownloadMode) {
  const filtered = files.filter(
    (f) =>
      !f.endsWith(".part") &&
      !f.endsWith(".tmp") &&
      !f.endsWith(".ytdl") &&
      !f.endsWith(".json")
  );

  if (mode === "video") {
    const videoCandidates = filtered.filter((f) =>
      [".mp4", ".mkv", ".webm", ".mov"].some((ext) => f.toLowerCase().endsWith(ext))
    );

    const preferred = [...videoCandidates].sort((a, b) => {
      const aScore = (a.toLowerCase().endsWith(".mp4") ? 20 : 0) + (isIntermediateVariant(a) ? 0 : 10);
      const bScore = (b.toLowerCase().endsWith(".mp4") ? 20 : 0) + (isIntermediateVariant(b) ? 0 : 10);
      return bScore - aScore;
    });

    // Pick first file that actually contains an audio track.
    for (const candidate of preferred) {
      const fullPath = path.join(dir, candidate);
      if (await hasAudioStream(fullPath)) {
        return candidate;
      }
    }

    for (const candidate of preferred) {
      if (!isIntermediateVariant(candidate)) {
        return candidate;
      }
    }

    return preferred[0];
  }

  if (mode === "mp3") {
    const audioPriority = [".mp3", ".m4a", ".aac", ".opus", ".webm"];
    for (const ext of audioPriority) {
      const found = filtered.find((f) => f.toLowerCase().endsWith(ext));
      if (found) return found;
    }
  }

  return filtered[0];
}

function parseProgress(line: string) {
  const match = line.match(/(\d{1,3}(?:\.\d+)?)%/);
  if (!match) return undefined;
  const num = Number(match[1]);
  if (Number.isNaN(num)) return undefined;
  return Math.min(100, Math.max(0, num));
}

export async function runDownload(jobId: string, url: string, mode: DownloadMode, quality: QualityOption) {
  await ensureRootDir();
  const dir = jobDir(jobId);
  await fs.mkdir(dir, { recursive: true });

  const selector = selectorFromQuality(mode, quality, url);
  const outputTemplate = path.join(dir, "%(title).120B-%(id)s.%(ext)s");
  const args = [
    "--no-playlist",
    "--no-warnings",
    "--newline",
    "--restrict-filenames",
    ...socialAccessArgs(url),
    "-f",
    selector,
    "-o",
    outputTemplate,
    url
  ];

  if (shouldUseFfmpegLocation()) {
    args.unshift(FFMPEG_BIN!);
    args.unshift("--ffmpeg-location");
  }

  if (mode === "video") {
    // Keep final container as MP4 while preserving merged A/V streams.
    args.unshift("mp4");
    args.unshift("--merge-output-format");
  }

  if (mode === "mp3") {
    args.unshift("--audio-quality", "0");
    args.unshift("--audio-format", "mp3");
    args.unshift("--extract-audio");
  }

  updateJob(jobId, { status: "running", stage: "Descargando", progress: 1 });

  await new Promise<void>((resolve, reject) => {
    const child = spawn(YT_DLP_BIN, args, { windowsHide: true });
    let stderrBuffer = "";

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Tiempo de descarga agotado"));
    }, DOWNLOAD_TIMEOUT_MS);

    const handleLine = (raw: Buffer) => {
      const line = raw.toString().trim();
      const pct = parseProgress(line);
      if (pct !== undefined) {
        updateJob(jobId, { progress: pct, stage: "Descargando" });
      }
      if (line.includes("[ExtractAudio]")) {
        updateJob(jobId, { stage: "Convirtiendo audio" });
      }
    };

    child.stdout.on("data", handleLine);
    child.stderr.on("data", (raw) => {
      const line = raw.toString();
      stderrBuffer += line;
      handleLine(raw);
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`No se pudo iniciar la descarga: ${err.message}`));
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const compactError = stderrBuffer
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.startsWith("ERROR:"))
          .slice(-1)[0];
        reject(new Error(explainSocialCookieError(compactError || "La descarga falló o el recurso no es compatible")));
        return;
      }
      resolve();
    });
  });

  const files = await fs.readdir(dir);
  const output = await pickOutputFile(dir, files, mode);
  if (!output) {
    throw new Error("No se pudo localizar el archivo generado");
  }

  const filePath = path.join(dir, output);
  const stat = await fs.stat(filePath);
  updateJob(jobId, {
    status: "done",
    stage: "Listo para descargar",
    progress: 100,
    filePath,
    fileName: output,
    fileSize: stat.size,
    mimeType: output.endsWith(".mp3") ? "audio/mpeg" : "application/octet-stream"
  });
}
