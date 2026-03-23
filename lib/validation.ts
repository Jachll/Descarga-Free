import { z } from "zod";

const privateHosts = [/^localhost$/i, /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[0-1])\./, /^192\.168\./, /^::1$/i];

export const analyzeSchema = z.object({
  url: z
    .string()
    .trim()
    .min(10, "URL demasiado corta")
    .max(2048, "URL demasiado larga")
    .url("URL inválida")
});

export const downloadSchema = z.object({
  url: z.string().trim().url(),
  mode: z.enum(["video", "mp3"]),
  quality: z
    .string()
    .trim()
    .regex(/^(best|\d{3,4})$/, "Calidad inválida")
    .default("best")
});

export function assertSafePublicUrl(url: string) {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Solo se permiten URLs http/https.");
  }

  const host = parsed.hostname.toLowerCase();
  if (privateHosts.some((rx) => rx.test(host))) {
    throw new Error("No se permiten hosts locales o privados.");
  }

  return parsed.toString();
}
