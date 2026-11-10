"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markNoticesRead } from "@/app/panel/tienda-clan/actions";
import { TEXTOS_CLAN as T } from "@/content/recompensas";
import { Icon } from "./icons";

export type NoticeView = { id: number; title: string; body: string; link: string | null; unread: boolean; at: string };

/** Centro de avisos del programa (GN liberados, canjes, vencimientos, edición nueva, subida de rango). */
export function GnNotices({ items }: { items: NoticeView[] }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const unread = items.filter((i) => i.unread).length;
  if (items.length === 0) return null;
  return (
    <details className="ui-card group" open={unread > 0}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-bold">
          <Icon name="bolt" className="h-5 w-5 text-gold" />
          {T.avisos}
          {unread > 0 && <span className="rounded-full bg-gold px-2 py-0.5 text-[12px] font-bold text-black">{T.avisosNuevos(unread)}</span>}
        </span>
        <Icon name="chevronDown" className="h-5 w-5 text-fg-2 transition-transform group-open:rotate-180" />
      </summary>
      <ul className="mt-3 flex flex-col divide-y divide-line">
        {items.map((n) => (
          <li key={n.id} className="py-3">
            {n.link ? (
              <Link href={n.link} className="block min-h-11">
                <NoticeBody n={n} />
              </Link>
            ) : (
              <NoticeBody n={n} />
            )}
          </li>
        ))}
      </ul>
      {unread > 0 && (
        <button
          type="button"
          className="ui-btn-sm mt-2"
          disabled={busy}
          onClick={() =>
            start(async () => {
              await markNoticesRead();
              router.refresh();
            })
          }
        >
          {T.marcarLeidos}
        </button>
      )}
    </details>
  );
}

function NoticeBody({ n }: { n: NoticeView }) {
  return (
    <span className="flex items-start gap-2">
      {n.unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-gold" aria-label="Nuevo" />}
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold">{n.title}</span>
        {n.body && <span className="block text-[13px] text-fg-2">{n.body}</span>}
        <span className="block text-[12px] text-fg-3">{n.at}</span>
      </span>
    </span>
  );
}
