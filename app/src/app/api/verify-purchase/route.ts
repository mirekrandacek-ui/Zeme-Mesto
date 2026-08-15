import { GoogleAuth } from "google-auth-library";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const PACKAGE_NAME = "com.randis2288.zememesto";

const ALLOWED_PRODUCT_IDS = new Set([
  "premium",
  "super_premium",
  "category_film_serial",
  "category_actor",
  "category_music",
  "category_sport",
  "category_brand",
  "category_auto_moto",
  "category_river_mountain",
  "category_job",
  "category_color",
]);

type VerifyPurchaseBody = {
  purchaseToken?: unknown;
  productId?: unknown;
};

type GoogleProductPurchaseV2 = {
  purchaseStateContext?: {
    purchaseState?: string;
  };
  acknowledgementState?: string;
  productLineItem?: Array<{
    productId?: string;
  }>;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as VerifyPurchaseBody;

    if (
      typeof body.purchaseToken !== "string" ||
      body.purchaseToken.length < 10 ||
      typeof body.productId !== "string" ||
      !ALLOWED_PRODUCT_IDS.has(body.productId)
    ) {
      return NextResponse.json(
        {
          valid: false,
          error: "invalid_request",
        },
        { status: 400 }
      );
    }

    const serviceAccountJson =
      process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;

    if (!serviceAccountJson) {
      console.error(
        "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not configured."
      );

      return NextResponse.json(
        {
          valid: false,
          error: "server_not_configured",
        },
        { status: 503 }
      );
    }

    let credentials: object;

    try {
      credentials = JSON.parse(serviceAccountJson) as object;
    } catch {
      console.error(
        "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not valid JSON."
      );

      return NextResponse.json(
        {
          valid: false,
          error: "server_configuration_invalid",
        },
        { status: 503 }
      );
    }

    const auth = new GoogleAuth({
      credentials,
      scopes: [
        "https://www.googleapis.com/auth/androidpublisher",
      ],
    });

    const authClient = await auth.getClient();

    const url =
      "https://androidpublisher.googleapis.com/androidpublisher/v3/" +
      `applications/${PACKAGE_NAME}/purchases/productsv2/tokens/` +
      encodeURIComponent(body.purchaseToken);

    const googleResponse =
      await authClient.request<GoogleProductPurchaseV2>({
        url,
        method: "GET",
      });

    const purchaseState =
      googleResponse.data.purchaseStateContext?.purchaseState;

    const productIds =
      googleResponse.data.productLineItem
        ?.map((item) => item.productId)
        .filter((productId): productId is string => Boolean(productId)) ??
      [];

    const valid =
      purchaseState === "PURCHASED" &&
      productIds.includes(body.productId);

    return NextResponse.json({
      valid,
      productId: valid ? body.productId : null,
      purchaseState: purchaseState ?? null,
      acknowledgementState:
        googleResponse.data.acknowledgementState ?? null,
    });
  } catch (error) {
    console.error("Google Play purchase verification failed:", error);

    const googleStatus =
      typeof error === "object" &&
      error !== null &&
      "response" in error &&
      typeof (error as { response?: { status?: unknown } }).response?.status ===
        "number"
        ? (error as { response: { status: number } }).response.status
        : null;

    return NextResponse.json(
      {
        valid: false,
        error: "verification_failed",
        googleStatus,
      },
      { status: 502 }
    );
  }
}
