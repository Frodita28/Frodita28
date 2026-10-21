import { Pill } from "./status-badge";

export const SALE_STATUS = {
  pending: { label: "Pendiente", tone: "warn" },
  verified: { label: "Verificada", tone: "ok" },
  rejected: { label: "Rechazada", tone: "bad" },
  cancelled: { label: "Anulada", tone: "neutral" },
} as const;

export function SaleStatus({ status }: { status: keyof typeof SALE_STATUS }) {
  const s = SALE_STATUS[status];
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

export type SaleWithItems = {
  id: string;
  reference: string;
  sold_at: string;
  channel: string;
  customer_ref: string | null;
  status: keyof typeof SALE_STATUS;
  rejection_reason: string | null;
  cancel_reason: string | null;
  sale_items: { quantity: number; unit_price: number; products: { name: string } | null }[];
};

export function saleTotal(s: SaleWithItems) {
  return s.sale_items.reduce((sum, i) => sum + i.quantity * Number(i.unit_price), 0);
}

export function saleUnits(s: SaleWithItems) {
  return s.sale_items.reduce((sum, i) => sum + i.quantity, 0);
}
