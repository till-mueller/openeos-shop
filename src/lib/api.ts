const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3010/api';

export class ShopApiError extends Error {
  status: number;
  code: string | null;

  constructor(message: string, status: number, code: string | null) {
    super(message);
    this.name = 'ShopApiError';
    this.status = status;
    this.code = code;
  }
}

async function parseErrorPayload(res: Response): Promise<{ code: string | null; message: string }> {
  try {
    const json = (await res.json()) as { error?: { code?: string; message?: string } };
    const code = json.error?.code ?? null;
    const message = json.error?.message ?? `Request failed: ${res.status}`;
    return { code, message };
  } catch {
    return { code: null, message: `Request failed: ${res.status}` };
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const { code, message } = await parseErrorPayload(res);
    throw new ShopApiError(message, res.status, code);
  }
  return res.json();
}

async function post<T, B = unknown>(path: string, body: B): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const { code, message } = await parseErrorPayload(res);
    throw new ShopApiError(message, res.status, code);
  }
  return res.json();
}

export interface ShopEvent {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'inactive' | 'test';
  startDate: string | null;
  endDate: string | null;
  organizationName: string;
}

export type ShopWeekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export interface ShopTimeWindow {
  start: string;
  end: string;
}
export type ShopOpeningHours = Partial<Record<ShopWeekday, ShopTimeWindow | null>>;

/** Ein konkretes Öffnungsfenster mit ISO-Zeitpunkten. Kann über Mitternacht laufen. */
export interface ShopWindow {
  start: string;
  end: string;
}

export interface ShopMeta {
  /** 'event': aus dem Veranstaltungszeitraum abgeleitet. 'weekly': Wochentags-Tabelle. */
  hoursMode: 'event' | 'weekly';
  /** Die tatsächlichen Öffnungsfenster — in beiden Modi gefüllt. */
  windows: ShopWindow[];
  /** Nächste Öffnung in der Zukunft, sonst null. */
  nextOpening: string | null;
  openingHours: ShopOpeningHours | null;
  serviceFee: number;
  isOpenNow: boolean;
  testMode: boolean;
}

export interface ShopLegalTexts {
  imprint?: string | null;
  privacy?: string | null;
  terms?: string | null;
  cancellation?: string | null;
}

export interface ShopCategory {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  sortOrder: number;
  parentId: string | null;
}

export interface ProductOption {
  name: string;
  priceModifier: number;
  default?: boolean;
}

export interface ProductOptionGroup {
  name: string;
  type: 'single' | 'multiple' | 'ingredients';
  required: boolean;
  options: ProductOption[];
}

export interface ProductOptions {
  groups: ProductOptionGroup[];
}

export interface SelectedOption {
  group: string;
  option: string;
  priceModifier: number;
  excluded?: boolean;
}

export interface ShopProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  categoryId: string | null;
  sortOrder: number;
  options: ProductOptions | null;
  trackInventory: boolean;
  stockQuantity: number | null;
  stockUnit: string | null;
}

export const shopApi = {
  getShop: (eventId: string) =>
    get<{
      data: {
        event: ShopEvent;
        currency: string;
        vatExempt: boolean;
        legal: ShopLegalTexts | null;
        shop: ShopMeta;
      };
    }>(`/public/shop/${eventId}`),

  getCategories: (eventId: string) =>
    get<{ data: ShopCategory[] }>(`/public/shop/${eventId}/categories`),

  getProducts: (eventId: string) =>
    get<{ data: ShopProduct[] }>(`/public/shop/${eventId}/products`),

  createCheckout: (
    eventId: string,
    body: {
      email: string;
      /** Required — shows up on the order for pickup. */
      customerName: { firstName: string; lastName: string };
      fulfillmentType: 'counter_pickup' | 'table_service';
      tableNumber?: string;
      items: Array<{
        productId: string;
        quantity: number;
        options?: SelectedOption[];
      }>;
    },
  ) =>
    post<{ data: { checkoutId: string; sumupCheckoutUrl: string; returnUrl: string } }>(
      `/public/shop/${eventId}/checkout`,
      body,
    ),

  verifyCheckout: (checkoutId: string) =>
    get<{
      data: {
        status: 'pending' | 'paid' | 'failed' | 'cancelled';
        orderNumber?: string;
        tse?: { fiscalized: boolean; transactionNumber?: number };
      };
    }>(`/public/shop/checkout/${checkoutId}/verify`),
};
