import Link from "next/link";
import { prisma } from "@/lib/db";
import { requirePageUser } from "@/lib/dal";
import { parseCameraStreams } from "@/lib/camera-streams";
import { CameraViewer } from "@/components/CameraViewer";

export const dynamic = "force-dynamic";

export default async function CameraPage() {
  await requirePageUser(["admin", "sales", "reviewer"]);
  const settings = await prisma.appSettings.findUnique({
    where: { id: "default" },
    select: { cameraStreams: true },
  });
  const streams = parseCameraStreams(settings?.cameraStreams);

  return (
    <div className="space-y-6 anim-lock">
      <div>
        <p className="label">Winkel</p>
        <h1 className="display text-2xl sm:text-3xl font-semibold mt-1">
          Camerabeeld
        </h1>
        <p className="text-sm text-[var(--text-dim)] mt-1">
          Live beeld uit de Automatenshop in Diksmuide.
        </p>
      </div>

      {streams.length ? (
        <CameraViewer streams={streams} />
      ) : (
        <section className="panel p-4 sm:p-6 space-y-3">
          <p className="text-sm text-[var(--text-dim)]">
            Er zijn nog geen camera&apos;s ingesteld. Zet in UniFi Protect per
            camera <span className="mono">Share Livestream</span> aan en plak de
            links bij{" "}
            <Link href="/settings" className="text-[var(--accent)]">
              Instellingen
            </Link>
            , één per regel, als{" "}
            <span className="mono">naam = https://monitor.ui.com/…</span>
          </p>
        </section>
      )}
    </div>
  );
}
