import { NextRequest } from "next/server";
import { nanoid } from "nanoid";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIp, jsonError } from "@/lib/api";
import { downloadSchema, assertSafePublicUrl } from "@/lib/validation";
import { createJob, updateJob } from "@/lib/job-store";
import { runDownload } from "@/lib/yt-dlp";
import type { QualityOption } from "@/types/media";

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const ratelimit = checkRateLimit(`download:${ip}`);
    if (!ratelimit.ok) {
      return jsonError("Demasiadas descargas en poco tiempo.", 429);
    }

    const payload = await req.json();
    const parsed = downloadSchema.safeParse(payload);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message || "Payload inválido", 400);
    }

    const url = assertSafePublicUrl(parsed.data.url);
    const jobId = nanoid(12);
    createJob(jobId);

    runDownload(jobId, url, parsed.data.mode, parsed.data.quality as QualityOption).catch((error) => {
      const message = error instanceof Error ? error.message : "Error al descargar";
      updateJob(jobId, { status: "error", stage: "Error", message });
    });

    return Response.json({ jobId });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido en descarga";
    return jsonError(msg, 400);
  }
}
