// Punto de venta con QR: utilidades compartidas por el servidor y el navegador.
// La base de datos (public.normalize_garment_code) vuelve a validar todo.

/** Alfabeto de los códigos: sin I, L, O ni U para poder escribirlos a mano sin confusiones. */
const ALPHABET = "0-9A-HJKMNP-TV-Z";
const EXACT = new RegExp(`^GN-?([${ALPHABET}]{8})$`);
const EMBEDDED = new RegExp(`(?:^|[^0-9A-Z])GN-([${ALPHABET}]{8})(?![0-9A-Z])`);

/** Código normalizado (GN-XXXXXXXX) a partir de lo escrito o de la URL leída en el QR, o null. */
export function normalizeGarmentCode(input: string | null | undefined): string | null {
  const upper = (input ?? "").toUpperCase();
  const m = upper.trim().match(EXACT) ?? upper.match(EMBEDDED);
  return m ? `GN-${m[1]}` : null;
}

/**
 * Lo que codifica la etiqueta: la URL del punto de venta con el código, para que
 * la cámara nativa del móvil también abra la venta. El lector del punto de venta
 * extrae el código de la URL o acepta el código solo.
 */
export function garmentQrPayload(origin: string | null, code: string) {
  return origin ? `${origin.replace(/\/$/, "")}/panel/ventas?codigo=${code}` : code;
}

export type PosItem = { code: string; name: string; sku: string; category: string; unitPrice: number };

export const cartTotal = (items: PosItem[]) => items.reduce((s, i) => s + i.unitPrice, 0);

export const SALE_CHANNELS = [
  ["presencial", "Presencial"],
  ["instagram", "Instagram"],
  ["whatsapp", "WhatsApp"],
  ["tiktok", "TikTok"],
  ["evento", "Evento"],
  ["otro", "Otro"],
] as const;
export type SaleChannel = (typeof SALE_CHANNELS)[number][0];

/** Minutos en los que el licenciado puede anular una venta del punto de venta (igual que en cancel_sale). */
export const POS_UNDO_MINUTES = 15;

export function canUndoPosSale(createdAt: string, now = new Date()) {
  return now.getTime() - new Date(createdAt).getTime() < POS_UNDO_MINUTES * 60_000;
}
