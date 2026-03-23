import fs from "node:fs";
import { NextRequest } from "next/server";
import { cleanupJobFiles, getJob } from "@/lib/job-store";
import { jsonError } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) return jsonError("jobId es requerido", 400);

  const job = getJob(jobId);
  if (!job || job.status !== "done" || !job.filePath || !job.fileName) {
    return jsonError("Archivo no disponible todavía", 404);
  }

  const stream = fs.createReadStream(job.filePath);

  stream.on("close", () => {
    // cleanup after sending file to browser
    setTimeout(() => {
      cleanupJobFiles(jobId).catch(() => undefined);
    }, 10_000);
  });

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": job.mimeType || "application/octet-stream",
      "Content-Length": String(job.fileSize || 0),
      "Content-Disposition": `attachment; filename="${encodeURIComponent(job.fileName)}"`
    }
  });
}
