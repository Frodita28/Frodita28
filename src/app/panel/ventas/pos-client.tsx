"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cartTotal, normalizeGarmentCode, SALE_CHANNELS, type PosItem } from "@/lib/pos";
import { Alert } from "@/components/ui";
import { Icon } from "@/components/icons";
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
      <Alert>Necesitas una licencia activa para vender desde el punto de venta.</Alert>
    );
  }

  return (
    <section className="ui-card" aria-labelledby="pos-title">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 id="pos-title" className="ui-title-section">Punto de venta</h2>
        <span className="ui-num text-[13px] font-medium text-fg-2">{cart.length} {cart.length === 1 ? "prenda" : "prendas"}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          {scanning ? (
            <QrScanner onCode={add} onClose={() => setScanning(false)} />
          ) : (
            <button type="button" className="ui-btn-primary min-h-14 w-full text-xl" onClick={() => { setNotice(null); setScanning(true); }}>
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
              className="ui-input font-mono uppercase"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="GN-XXXXXXXX"
              autoComplete="off"
              autoCapitalize="characters"
              inputMode="text"
              enterKeyHint="done"
              spellCheck={false}
            />
            <button className="ui-btn-secondary whitespace-nowrap" disabled={looking || !manual.trim()}>Agregar</button>
          </form>
          {(notice || looking) && (
            <p role="status" className={`flex items-start gap-2 ${looking || notice?.tone === "ok" ? "text-fg-2" : "text-fg"}`}>
              {!looking && <Icon name={notice?.tone === "ok" ? "check" : "alert"} className={`mt-0.5 h-5 w-5 shrink-0 ${notice?.tone === "ok" ? "text-fg-2" : "text-brand-red"}`} />}
              {looking ? "Buscando prenda…" : notice?.text}
            </p>
          )}
        </div>

        <form action={close} className="space-y-4">
          <input type="hidden" name="codes" value={JSON.stringify(cart.map((i) => i.code))} />
          {cart.length === 0 ? (
            <p className="rounded-ui border border-dashed border-line p-4 text-fg-2">
              Escanea la etiqueta QR de cada prenda que sale. El precio lo fija Gallo Negro en la etiqueta.
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-ui border border-line bg-surface-2">
              {cart.map((i) => (
                <li key={i.code} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{i.name}</p>
                    <p className="mt-1 font-mono text-[13px] text-fg-2">{i.code} · {i.category}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="ui-num whitespace-nowrap">{money(i.unitPrice)}</span>
                    <button
                      type="button"
                      className="ui-btn-sm"
                      onClick={() => setCart((c) => c.filter((x) => x.code !== i.code))}
                      aria-label={`Quitar ${i.code}`}
                    >
                      Quitar
                    </button>
                  </div>
                </li>
              ))}
              <li className="flex items-center justify-between p-4">
                <span className="ui-label">Total</span>
                <span className="ui-num text-2xl">{money(total)}</span>
              </li>
            </ul>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="ui-field-label" htmlFor="channel">Canal</label>
              <select className="ui-input" id="channel" name="channel" defaultValue="presencial">
                {SALE_CHANNELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="ui-field-label" htmlFor="customer_ref">Cliente (opcional)</label>
              <input className="ui-input" id="customer_ref" name="customer_ref" maxLength={120} placeholder="@usuario o nombre" autoComplete="off" autoCapitalize="none" enterKeyHint="next" />
            </div>
          </div>
          <input className="ui-input" name="notes" maxLength={1000} placeholder="Nota (opcional)" aria-label="Nota" />
          <p className="text-[13px] text-fg-2">
            El cliente solo lo ven tú y Gallo Negro; sirve para las misiones de clientes que regresan.
          </p>
          <button className="ui-btn-primary w-full" disabled={cart.length === 0 || closing || looking}>
            {closing ? "Registrando…" : cart.length === 0 ? "Cerrar venta" : `Cerrar venta · ${money(total)}`}
          </button>
        </form>
      </div>
    </section>
  );
}
