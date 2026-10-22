"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cartTotal, normalizeGarmentCode, SALE_CHANNELS, type PosItem } from "@/lib/pos";
import { checkoutSale, lookupGarment } from "./actions";
import { QrScanner } from "./scanner";

const money = (n: number) => new Intl.NumberFormat("es-VE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

type Notice = { tone: "ok" | "bad"; text: string } | null;

function readCart(key: string): PosItem[] {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

/**
 * Punto de venta. Se renderiza solo en el navegador (ver ./pos.tsx): el carrito
 * vive en localStorage para sobrevivir a recargas, por ejemplo cuando la cámara
 * nativa del móvil abre el enlace de una etiqueta.
 */
export default function PointOfSaleClient({ userId, initialCode, disabled }: { userId: string; initialCode: string | null; disabled: boolean }) {
  const router = useRouter();
  const storageKey = `gn-pos-cart:${userId}`;
  const [cart, setCart] = useState<PosItem[]>(() => readCart(storageKey));
  const [scanning, setScanning] = useState(false);
  const [manual, setManual] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [looking, startLookup] = useTransition();
  const [closing, startClosing] = useTransition();
  const cartRef = useRef(cart);

  useEffect(() => {
    cartRef.current = cart;
    try {
      localStorage.setItem(storageKey, JSON.stringify(cart));
    } catch {}
  }, [cart, storageKey]);

  const add = useCallback((raw: string) => {
    startLookup(async () => {
      const code = normalizeGarmentCode(raw);
      if (!code) return setNotice({ tone: "bad", text: "Ese código no es un QR de Gallo Negro" });
      if (cartRef.current.some((i) => i.code === code)) return setNotice({ tone: "bad", text: `La prenda ${code} ya está en esta venta` });
      const r = await lookupGarment(code);
      if (!r.ok) return setNotice({ tone: "bad", text: r.error });
      setCart((c) => (c.some((i) => i.code === r.item.code) ? c : [...c, r.item]));
      setNotice({ tone: "ok", text: `${r.item.name} agregada (${r.item.code})` });
    });
  }, []);

  // Código recibido por la URL de la etiqueta (?codigo=GN-…).
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!initialCode || handled.current === initialCode) return;
    handled.current = initialCode;
    add(initialCode);
    router.replace("/panel/ventas");
  }, [initialCode, add, router]);

  function close(formData: FormData) {
    startClosing(async () => {
      const r = await checkoutSale(null, formData);
      if (r?.ok) setCart([]);
      if (r) setNotice({ tone: r.ok ? "ok" : "bad", text: r.message });
      router.refresh();
    });
  }

  const total = cartTotal(cart);

  if (disabled) {
    return (
      <section className="card mb-6 border-warn/40 text-sm text-warn">
        Necesitas una licencia activa para vender desde el punto de venta.
      </section>
    );
  }

  return (
    <section className="card mb-6" aria-labelledby="pos-title">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="pos-title" className="eyebrow">Punto de venta</h2>
        <span className="text-xs text-parchment">{cart.length} {cart.length === 1 ? "prenda" : "prendas"}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          {scanning ? (
            <QrScanner onCode={add} onClose={() => setScanning(false)} />
          ) : (
            <button type="button" className="btn-bronze w-full py-4 text-base" onClick={() => { setNotice(null); setScanning(true); }}>
              Escanear QR de la prenda
            </button>
          )}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              add(manual);
              setManual("");
            }}
          >
            <label htmlFor="manual-code" className="sr-only">Código de la etiqueta</label>
            <input
              id="manual-code"
              className="input font-mono uppercase"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="GN-XXXXXXXX"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
            />
            <button className="btn-ghost whitespace-nowrap" disabled={looking || !manual.trim()}>Agregar</button>
          </form>
          {(notice || looking) && (
            <p role="status" className={`text-sm ${looking ? "text-parchment" : notice?.tone === "ok" ? "text-ok" : "text-bad"}`}>
              {looking ? "Buscando prenda…" : notice?.text}
            </p>
          )}
        </div>

        <form action={close} className="space-y-3">
          <input type="hidden" name="codes" value={JSON.stringify(cart.map((i) => i.code))} />
          {cart.length === 0 ? (
            <p className="rounded-lg border border-dashed border-smoke p-4 text-sm text-parchment">
              Escanea la etiqueta QR de cada prenda que sale. El precio lo fija Gallo Negro en la etiqueta.
            </p>
          ) : (
            <ul className="divide-y divide-ash rounded-lg border border-ash">
              {cart.map((i) => (
                <li key={i.code} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ivory">{i.name}</p>
                    <p className="font-mono text-xs text-parchment">{i.code} · {i.category}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="whitespace-nowrap">{money(i.unitPrice)}</span>
                    <button
                      type="button"
                      className="text-xs text-parchment underline hover:text-bad"
                      onClick={() => setCart((c) => c.filter((x) => x.code !== i.code))}
                      aria-label={`Quitar ${i.code}`}
                    >
                      Quitar
                    </button>
                  </div>
                </li>
              ))}
              <li className="flex items-center justify-between p-3">
                <span className="label mb-0">Total</span>
                <span className="font-display text-xl">{money(total)}</span>
              </li>
            </ul>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="channel">Canal</label>
              <select className="input" id="channel" name="channel" defaultValue="presencial">
                {SALE_CHANNELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="customer_ref">Cliente (opcional)</label>
              <input className="input" id="customer_ref" name="customer_ref" maxLength={120} placeholder="@usuario o nombre" />
            </div>
          </div>
          <input className="input" name="notes" maxLength={1000} placeholder="Nota (opcional)" aria-label="Nota" />
          <p className="text-xs text-parchment">
            El cliente solo lo ven tú y Gallo Negro; sirve para las misiones de clientes que regresan.
          </p>
          <button className="btn-primary w-full py-3" disabled={cart.length === 0 || closing || looking}>
            {closing ? "Registrando…" : cart.length === 0 ? "Cerrar venta" : `Cerrar venta · ${money(total)}`}
          </button>
        </form>
      </div>
    </section>
  );
}
