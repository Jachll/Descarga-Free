import { NextRequest } from "next/server";

export function clientIp(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "local";
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
