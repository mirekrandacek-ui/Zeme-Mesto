import {
  Capacitor,
  registerPlugin,
  type PluginListenerHandle,
} from "@capacitor/core";

export type BillingOffer = {
  offerId?: string;
  formattedPrice: string;
  priceCurrencyCode: string;
  priceAmountMicros: number;
};

export type BillingProduct = {
  productId: string;
  name: string;
  description: string;
  formattedPrice?: string;
  priceCurrencyCode?: string;
  priceAmountMicros?: number;
  offers?: BillingOffer[];
};

export type BillingPurchase = {
  productIds: string[];
  purchaseState: number;
  acknowledged: boolean;
  purchaseToken: string;
};

type BillingStatus = {
  ready: boolean;
  responseCode: number;
  debugMessage: string;
};

type ProductsResult = {
  responseCode: number;
  debugMessage: string;
  products: BillingProduct[];
};

export type PurchaseUpdatedEvent = {
  status: "purchased" | "pending" | "cancelled" | "error";
  responseCode: number;
  debugMessage: string;
  productIds: string[];
  purchaseToken?: string;
};

type PurchaseLaunchResult = {
  responseCode: number;
  debugMessage: string;
};

type PurchasesResult = {
  responseCode: number;
  debugMessage: string;
  purchases: BillingPurchase[];
};

interface PlayBillingPlugin {
  connect(): Promise<BillingStatus>;
  getProducts(): Promise<ProductsResult>;
  purchase(options: {
    productId: BillingProduct["productId"];
    offerId?: string;
  }): Promise<PurchaseLaunchResult>;
  getPurchases(): Promise<PurchasesResult>;
  acknowledge(options: { purchaseToken: string }): Promise<BillingStatus>;
  addListener(
    eventName: "purchaseUpdated",
    listener: (event: PurchaseUpdatedEvent) => void,
  ): Promise<PluginListenerHandle>;
}

export async function verifyPlayPurchase(
  productId: string,
  purchaseToken: string,
): Promise<boolean> {
  if (!productId || !purchaseToken) return false;

  const response = await fetch("/api/verify-purchase", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId, purchaseToken }),
  });

  if (!response.ok) return false;

  const result = (await response.json()) as {
    valid?: unknown;
    productId?: unknown;
  };

  return result.valid === true && result.productId === productId;
}

const PlayBilling = registerPlugin<PlayBillingPlugin>("PlayBilling");

export function isPlayBillingAvailable() {
  return Capacitor.getPlatform() === "android";
}

export { PlayBilling };
