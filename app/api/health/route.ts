export const runtime = "nodejs";

export async function GET() {
  return Response.json(
    {
      ok: true,
      service: "media-downloader-local",
      timestamp: new Date().toISOString()
    },
    { status: 200 }
  );
}
