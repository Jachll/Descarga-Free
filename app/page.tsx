import DownloaderCard from "@/components/downloader-card";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-10 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,.18),transparent_34%),radial-gradient(circle_at_90%_10%,rgba(34,211,238,.15),transparent_30%),radial-gradient(circle_at_50%_90%,rgba(59,130,246,.12),transparent_34%)]" />
      <div className="relative mx-auto max-w-5xl">
        <DownloaderCard />
      </div>
    </main>
  );
}
