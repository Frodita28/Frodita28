"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markNoticesRead } from "@/app/panel/tienda-clan/actions";
import { TEXTOS_CLAN as T } from "@/content/recompensas";
import { formatNum } from "@/lib/gn";
import { BottomSheet } from "./bottom-sheet";
import type { NoticeView } from "./gn-notices";
import { Icon } from "./icons";

/** Saldo de GN disponible y campana de avisos en la cabecera del panel. */
export function HeaderGn({ available, notices }: { available: number; notices: NoticeView[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();
  const unread = notices.filter((n) => n.unread).length;

  const close = () => {
    setOpen(false);
    if (unread > 0)
      start(async () => {
        await markNoticesRead();
        router.refresh();
      });
  };

  return (
    <>
      <Link
        href="/panel/tienda-clan"
        className="ui-num flex min-h-11 items-center gap-1 rounded-ui border border-line px-2.5 text-[13px] font-bold whitespace-nowrap md:px-3 md:text-[14px]"
        aria-label={`Saldo: ${formatNum(available)} GN`}
      >
        {formatNum(available)} <span className="text-fg-2">GN</span>
      </Link>
      <button
        type="button"
        className="relative grid h-11 w-11 shrink-0 place-items-center rounded-ui border border-line"
        aria-label={unread > 0 ? `${T.avisos}: ${T.avisosNuevos(unread)}` : T.avisos}
        onClick={() => setOpen(true)}
      >
        <Icon name="bell" className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-black">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      <BottomSheet open={open} onClose={close} title={T.avisos}>
        {notices.length === 0 ? (
          <p className="text-fg-2">{T.sinAvisos}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line" aria-busy={busy}>
            {notices.map((n) => {
              const body = (
                <span className="flex items-start gap-2">
                  {n.unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Nuevo" />}
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold">{n.title}</span>
                    {n.body && <span className="block text-[13px] text-fg-2">{n.body}</span>}
                    <span className="block text-[12px] text-fg-3">{n.at}</span>
                  </span>
                </span>
              );
              return (
                <li key={n.id} className="py-3">
                  {n.link ? (
                    <Link href={n.link} className="block min-h-11" onClick={close}>
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </BottomSheet>
    </>
  );
}
