"use client";

import { useState } from "react";
import type { AnalyzeResult, DownloadMode, JobStatus, QualityOption } from "@/types/media";
import { formatBytes, formatDuration } from "@/lib/utils";

type DownloadState = {
  jobId?: string;
  status?: JobStatus;
  progress: number;
  stage?: string;
  message?: string;
};

export default function DownloaderCard() {
  const [url, setUrl] = useState("");
  const [busyAnalyze, setBusyAnalyze] = useState(false);
  const [meta, setMeta] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<DownloadMode>("video");
  const [quality, setQuality] = useState<QualityOption>("best");
  const [download, setDownload] = useState<DownloadState>({ progress: 0 });

  const qualityChoices: QualityOption[] = meta
    ? meta.availableResolutions.map((r) => (r === "best" ? "best" : r.replace("p", ""))) as QualityOption[]
    : ["best"];

  const qualityLabel = (value: QualityOption) => (value === "best" ? "Mejor disponible" : `${value}p`);

  async function analyze() {
    setBusyAnalyze(true);
    setError(null);
    setMeta(null);
    setDownload({ progress: 0 });

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "No se pudo analizar la URL");

      const data = body.data as AnalyzeResult;
      setMeta(data);

      const nextModes = data.availableModes;
      const nextResolutions = data.availableResolutions.map((r) => (r === "best" ? "best" : r.replace("p", ""))) as QualityOption[];

      if (!data.availableModes.includes(mode)) {
        setMode(nextModes[0] || "video");
      }
      if (!nextResolutions.includes(quality)) {
        setQuality(nextResolutions[0] || "best");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado en análisis");
    } finally {
      setBusyAnalyze(false);
    }
  }

  async function pollJob(jobId: string) {
    return new Promise<void>((resolve, reject) => {
      const timer = setInterval(async () => {
        try {
          const res = await fetch(`/api/progress?jobId=${jobId}`, { cache: "no-store" });
          const body = await res.json();
          if (!res.ok) throw new Error(body.error || "No se pudo leer el progreso");

          const job = body.job;
          setDownload({
            jobId,
            progress: Number(job.progress || 0),
            status: job.status,
            stage: job.stage,
            message: job.message
          });

          if (job.status === "done") {
            clearInterval(timer);
            resolve();
          }

          if (job.status === "error") {
            clearInterval(timer);
            reject(new Error(job.message || "Error en descarga"));
          }
        } catch (error) {
          clearInterval(timer);
          reject(error);
        }
      }, 1000);
    });
  }

  async function triggerBrowserDownload(jobId: string) {
    const res = await fetch(`/api/file?jobId=${jobId}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "No se pudo descargar el archivo" }));
      throw new Error(body.error || "No se pudo descargar el archivo");
    }

    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const fromHeader = disposition.match(/filename="?([^";]+)"?/i)?.[1];
    const fileName = decodeURIComponent(fromHeader || `download-${jobId}`);

    const tempUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = tempUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(tempUrl);
  }

  async function startDownload() {
    if (!meta) return;
    setError(null);
    setDownload({ progress: 2, status: "queued", stage: "Preparando" });

    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: meta.webpageUrl, mode, quality })
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "No se pudo iniciar la descarga");

      const jobId = body.jobId as string;
      setDownload((d) => ({ ...d, jobId }));
      await pollJob(jobId);
      await triggerBrowserDownload(jobId);
      setDownload((d) => ({ ...d, stage: "Descarga finalizada" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al descargar");
      setDownload((d) => ({ ...d, status: "error", stage: "Error" }));
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-soft backdrop-blur md:p-8">
      <h1 className="text-2xl font-bold text-white md:text-3xl">Gestor de Descargas Local</h1>
      <p className="mt-2 text-sm text-slate-300">
        Compatible con contenido públicamente accesible. No soporta DRM, paywalls ni recursos privados autenticados.
      </p>
      <p className="mt-1 text-xs text-slate-400">
        Nota: Facebook e Instagram pueden requerir cookies del navegador para analizar o descargar algunos enlaces.
      </p>

      <div className="mt-6 flex flex-col gap-3 md:flex-row">
        <input
          className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none ring-emerald-400/60 transition placeholder:text-slate-500 focus:ring"
          placeholder="Pega aquí una URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button
          onClick={analyze}
          disabled={busyAnalyze || !url.trim()}
          className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-emerald-950 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busyAnalyze ? "Analizando..." : "Analizar"}
        </button>
      </div>

      {error && <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}

      {meta && (
        <div className="mt-6 grid gap-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4 md:grid-cols-[220px_1fr]">
          <div>
            {meta.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={meta.thumbnail} alt={meta.title} className="h-36 w-full rounded-lg object-cover" />
            ) : (
              <div className="flex h-36 items-center justify-center rounded-lg bg-slate-800 text-xs text-slate-400">Sin miniatura</div>
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-white">{meta.title}</h2>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 md:grid-cols-4">
              <div className="rounded-lg bg-slate-800/70 p-2">
                <span className="block text-slate-400">Duración</span>
                {formatDuration(meta.duration)}
              </div>
              <div className="rounded-lg bg-slate-800/70 p-2">
                <span className="block text-slate-400">Fuente</span>
                {meta.source}
              </div>
              <div className="rounded-lg bg-slate-800/70 p-2">
                <span className="block text-slate-400">Tipos</span>
                {meta.availableModes.map((m) => (m === "video" ? "video mp4" : "audio mp3")).join(", ")}
              </div>
              <div className="rounded-lg bg-slate-800/70 p-2">
                <span className="block text-slate-400">Formatos</span>
                {new Set(meta.options.slice(0, 8).map((o) => o.ext)).size}+
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as DownloadMode)}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              >
                {meta.availableModes.map((m) => (
                  <option key={m} value={m}>
                    {m === "video" ? "Video MP4" : "Audio MP3"}
                  </option>
                ))}
              </select>

              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as QualityOption)}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                disabled={mode !== "video"}
              >
                {qualityChoices.map((q) => (
                  <option key={q} value={q}>
                    {qualityLabel(q)}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={startDownload}
              className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-900"
            >
              Descargar
            </button>
          </div>
        </div>
      )}

      {(download.status || download.progress > 0) && (
        <div className="mt-6 rounded-xl border border-white/10 bg-slate-950/70 p-4">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
            <span>{download.stage || "Procesando"}</span>
            <span>{Math.round(download.progress)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${download.progress}%` }} />
          </div>
          {download.status === "done" && <p className="mt-2 text-xs text-emerald-300">Archivo listo y enviado al navegador.</p>}
          {download.message && <p className="mt-2 text-xs text-rose-300">{download.message}</p>}
        </div>
      )}

      {meta?.options?.length ? (
        <div className="mt-5 max-h-48 overflow-auto rounded-xl border border-white/10 bg-slate-950/50 p-3">
          <p className="mb-2 text-xs text-slate-400">Opciones reales detectadas (muestra parcial):</p>
          <div className="space-y-2 text-xs text-slate-200">
            {meta.options.slice(0, 20).map((o) => (
              <div key={o.formatId} className="grid grid-cols-4 gap-2 rounded bg-slate-800/60 p-2">
                <span>ID: {o.formatId}</span>
                <span>ext: {o.ext}</span>
                <span>res: {o.height ? `${o.height}p` : "audio"}</span>
                <span>tam: {formatBytes(o.filesz)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
