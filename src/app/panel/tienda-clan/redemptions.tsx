"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, type BadgeTone } from "@/components/ui";
import { TEXTOS_CLAN as T } from "@/content/recompensas";
import { formatGn } from "@/lib/gn";
import { cancelRedemption, confirmReceived } from "./actions";

export type RedemptionView = {
  id: string;
  name: string;
  price: number;
  status: string;
  createdAt: string;
  note: string | null;
  substitute: string | null;
};

const TONE: Record<string, BadgeTone> = {
  entregado: "success",
  rechazado: "alert",
  cancelado: "neutral",
  enviado: "accent",
};

const ORDEN = ["solicitado", "aprobado", "en_preparacion", "enviado", "entregado"];

export function RedemptionList({ items }: { items: RedemptionView[] }) {
  if (items.length === 0) return <p className="ui-card text-fg-2">{T.sinCanjes}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((r) => (
        <RedemptionItem key={r.id} r={r} />
      ))}
    </ul>
  );
}

function RedemptionItem({ r }: { r: RedemptionView }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: (id: string) => Promise<{ ok: true; message?: string } | { ok: false; error: string }>) =>
    start(async () => {
      const res = await fn(r.id);
      setMsg(res.ok ? { ok: true, text: res.message ?? "" } : { ok: false, text: res.error });
      if (res.ok) router.refresh();
    });
  const paso = ORDEN.indexOf(r.status === "sustituido" ? "aprobado" : r.status);

  return (
    <li className="ui-card flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold [overflow-wrap:anywhere]">{r.name}</p>
          <p className="ui-num text-[13px] text-fg-2">
            {formatGn(r.price)} · {r.createdAt}
          </p>
        </div>
        <Badge tone={TONE[r.status] ?? "neutral"}>{T.estados[r.status] ?? r.status}</Badge>
      </div>
      {paso >= 0 && (
        <ol className="grid grid-cols-5 gap-1" aria-label="Avance del canje">
          {ORDEN.map((s, i) => (
            <li key={s} className={`h-1.5 rounded-full ${i <= paso ? "bg-gold" : "bg-surface-2"}`}>
              <span className="sr-only">
                {T.estados[s]} {i <= paso ? "(hecho)" : ""}
              </span>
            </li>
          ))}
        </ol>
      )}
      {r.substitute && <p className="text-[13px] text-fg-2">Sustituido por: {r.substitute}</p>}
      {r.note && (r.status === "rechazado" || r.status === "cancelado") && <p className="text-[13px] text-fg-2">Motivo: {r.note}</p>}
      {msg && (
        <p role="status" className={`text-[13px] ${msg.ok ? "text-success" : "text-fg"}`}>
          {msg.text}
        </p>
      )}
      {r.status === "solicitado" && (
        <button type="button" className="ui-btn-sm self-start" disabled={busy} onClick={() => run(cancelRedemption)}>
          {T.cancelar}
        </button>
      )}
      {r.status === "enviado" && (
        <button type="button" className="ui-btn-primary w-full sm:w-auto sm:self-start" disabled={busy} onClick={() => run(confirmReceived)}>
          {T.recibido}
        </button>
      )}
    </li>
  );
}
