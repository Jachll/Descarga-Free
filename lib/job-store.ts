import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { DownloadJob } from "@/types/media";

const jobs = new Map<string, DownloadJob>();
const ROOT_DIR = path.join(os.tmpdir(), "media-downloader-local", "jobs");

export function getJob(id: string) {
  return jobs.get(id);
}

export function createJob(id: string): DownloadJob {
  const job: DownloadJob = {
    id,
    status: "queued",
    progress: 0,
    stage: "En cola",
    createdAt: Date.now()
  };
  jobs.set(id, job);
  return job;
}

export function updateJob(id: string, patch: Partial<DownloadJob>) {
  const current = jobs.get(id);
  if (!current) return;
  jobs.set(id, { ...current, ...patch });
}

export function removeJob(id: string) {
  jobs.delete(id);
}

export async function ensureRootDir() {
  await fs.mkdir(ROOT_DIR, { recursive: true });
  return ROOT_DIR;
}

export function jobDir(id: string) {
  return path.join(ROOT_DIR, id);
}

export async function cleanupJobFiles(id: string) {
  const dir = jobDir(id);
  await fs.rm(dir, { recursive: true, force: true });
  removeJob(id);
}

setInterval(async () => {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (job.status === "done" && now - job.createdAt > 30 * 60 * 1000) {
      await cleanupJobFiles(id).catch(() => undefined);
      continue;
    }

    if ((job.status === "error" || job.status === "queued") && now - job.createdAt > 15 * 60 * 1000) {
      await cleanupJobFiles(id).catch(() => undefined);
    }
  }
}, 60_000).unref();
