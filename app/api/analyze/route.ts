import { NextRequest } from "next/server";
import { analyzeSchema, assertSafePublicUrl } from "@/lib/validation";
import { analyzeUrl } from "@/lib/yt-dlp";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIp, jsonError } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const ratelimit = checkRateLimit(`analyze:${ip}`);
    if (!ratelimit.ok) {
      return jsonError("Demasiadas solicitudes. Intenta de nuevo en unos segundos.", 429);
    }

    const payload = await req.json();
    const parsed = analyzeSchema.safeParse(payload);
    if (!parsed.success) {
      return jsonError(parsed.error.issues[0]?.message || "Payload inválido", 400);
    }

    const url = assertSafePublicUrl(parsed.data.url);
    const data = await analyzeUrl(url);
    return Response.json({ data });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido en análisis";
    return jsonError(msg, 400);
  }
}
