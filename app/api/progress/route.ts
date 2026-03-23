import { NextRequest } from "next/server";
import { getJob } from "@/lib/job-store";
import { jsonError } from "@/lib/api";

export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) return jsonError("jobId es requerido", 400);

  const job = getJob(jobId);
  if (!job) return jsonError("Trabajo no encontrado", 404);

  return Response.json({ job });
}
