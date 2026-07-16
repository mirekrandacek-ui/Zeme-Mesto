package com.randis2288.zememesto;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@CapacitorPlugin(name = "PlayBilling")
public class PlayBillingPlugin extends Plugin implements PurchasesUpdatedListener {

    private BillingClient billingClient;
    private final Map<String, ProductDetails> productDetailsById =
        new HashMap<>();

    private void ensureBillingClient() {
        if (billingClient != null) {
            return;
        }

        billingClient = BillingClient.newBuilder(getContext())
            .setListener(this)
            .enablePendingPurchases(
                PendingPurchasesParams.newBuilder()
                    .enableOneTimeProducts()
                    .build()
            )
            .enableAutoServiceReconnection()
            .build();
    }

    @PluginMethod
    public void connect(PluginCall call) {
        ensureBillingClient();

        if (billingClient.isReady()) {
            resolveStatus(call, true, BillingClient.BillingResponseCode.OK, "Billing je připojený.");
            return;
        }

        billingClient.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult billingResult) {
                boolean ready =
                    billingResult.getResponseCode() == BillingClient.BillingResponseCode.OK;

                resolveStatus(
                    call,
                    ready,
                    billingResult.getResponseCode(),
                    billingResult.getDebugMessage()
                );
            }

            @Override
            public void onBillingServiceDisconnected() {
                // Automatické obnovení spojení zajišťuje Billing Library.
            }
        });
    }


    @PluginMethod
    public void getProducts(PluginCall call) {
        ensureBillingClient();

        if (!billingClient.isReady()) {
            call.reject("Billing není připojený.");
            return;
        }

        List<QueryProductDetailsParams.Product> products = Arrays.asList(
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId("premium")
                .setProductType(BillingClient.ProductType.INAPP)
                .build(),
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId("super_premium")
                .setProductType(BillingClient.ProductType.INAPP)
                .build()
        );

        QueryProductDetailsParams params =
            QueryProductDetailsParams.newBuilder()
                .setProductList(products)
                .build();

        billingClient.queryProductDetailsAsync(
            params,
            (billingResult, queryResult) -> {
                com.getcapacitor.JSArray resultProducts =
                    new com.getcapacitor.JSArray();

                productDetailsById.clear();

                for (ProductDetails details : queryResult.getProductDetailsList()) {
                    productDetailsById.put(details.getProductId(), details);

                    JSObject product = new JSObject();
                    product.put("productId", details.getProductId());
                    product.put("name", details.getName());
                    product.put("description", details.getDescription());

                    List<ProductDetails.OneTimePurchaseOfferDetails> offers =
                        details.getOneTimePurchaseOfferDetailsList();

                    if (offers != null && !offers.isEmpty()) {
                        ProductDetails.OneTimePurchaseOfferDetails offer =
                            offers.get(0);

                        product.put(
                            "formattedPrice",
                            offer.getFormattedPrice()
                        );
                        product.put(
                            "priceCurrencyCode",
                            offer.getPriceCurrencyCode()
                        );
                        product.put(
                            "priceAmountMicros",
                            offer.getPriceAmountMicros()
                        );
                    }

                    resultProducts.put(product);
                }

                JSObject result = new JSObject();
                result.put(
                    "responseCode",
                    billingResult.getResponseCode()
                );
                result.put(
                    "debugMessage",
                    billingResult.getDebugMessage()
                );
                result.put("products", resultProducts);
                call.resolve(result);
            }
        );
    }


    @PluginMethod
    public void purchase(PluginCall call) {
        String productId = call.getString("productId");

        if (!"premium".equals(productId) &&
            !"super_premium".equals(productId)) {
            call.reject("Neplatné ID produktu.");
            return;
        }

        ProductDetails details = productDetailsById.get(productId);

        if (details == null) {
            call.reject("Produkt není načtený.");
            return;
        }

        List<ProductDetails.OneTimePurchaseOfferDetails> offers =
            details.getOneTimePurchaseOfferDetailsList();

        if (offers == null || offers.isEmpty()) {
            call.reject("Produkt nemá dostupnou nabídku.");
            return;
        }

        String requestedOfferId = call.getString("offerId");
        ProductDetails.OneTimePurchaseOfferDetails selectedOffer = null;

        for (ProductDetails.OneTimePurchaseOfferDetails offer : offers) {
            if (requestedOfferId == null && offer.getOfferId() == null) {
                selectedOffer = offer;
                break;
            }

            if (requestedOfferId != null &&
                requestedOfferId.equals(offer.getOfferId())) {
                selectedOffer = offer;
                break;
            }
        }

        if (selectedOffer == null) {
            call.reject("Požadovaná nabídka není dostupná.");
            return;
        }

        BillingFlowParams.ProductDetailsParams productParams =
            BillingFlowParams.ProductDetailsParams.newBuilder()
                .setProductDetails(details)
                .setOfferToken(selectedOffer.getOfferToken())
                .build();

        BillingFlowParams flowParams =
            BillingFlowParams.newBuilder()
                .setProductDetailsParamsList(
                    java.util.Collections.singletonList(productParams)
                )
                .build();

        getActivity().runOnUiThread(() -> {
            BillingResult result =
                billingClient.launchBillingFlow(getActivity(), flowParams);

            JSObject response = new JSObject();
            response.put("responseCode", result.getResponseCode());
            response.put("debugMessage", result.getDebugMessage());
            call.resolve(response);
        });
    }

    @PluginMethod
    public void getPurchases(PluginCall call) {
        ensureBillingClient();

        if (!billingClient.isReady()) {
            call.reject("Billing není připojený.");
            return;
        }

        QueryPurchasesParams params =
            QueryPurchasesParams.newBuilder()
                .setProductType(BillingClient.ProductType.INAPP)
                .build();

        billingClient.queryPurchasesAsync(
            params,
            (billingResult, purchases) -> {
                com.getcapacitor.JSArray resultPurchases =
                    new com.getcapacitor.JSArray();

                for (Purchase purchase : purchases) {
                    JSObject purchaseItem = new JSObject();
                    com.getcapacitor.JSArray productIds =
                        new com.getcapacitor.JSArray();

                    for (String productId : purchase.getProducts()) {
                        productIds.put(productId);
                    }

                    purchaseItem.put("productIds", productIds);
                    purchaseItem.put(
                        "purchaseState",
                        purchase.getPurchaseState()
                    );
                    purchaseItem.put(
                        "acknowledged",
                        purchase.isAcknowledged()
                    );

                    resultPurchases.put(purchaseItem);
                }

                JSObject result = new JSObject();
                result.put(
                    "responseCode",
                    billingResult.getResponseCode()
                );
                result.put(
                    "debugMessage",
                    billingResult.getDebugMessage()
                );
                result.put("purchases", resultPurchases);
                call.resolve(result);
            }
        );
    }

    private void resolveStatus(
        PluginCall call,
        boolean ready,
        int responseCode,
        String debugMessage
    ) {
        JSObject result = new JSObject();
        result.put("ready", ready);
        result.put("responseCode", responseCode);
        result.put("debugMessage", debugMessage);
        call.resolve(result);
    }

    @Override
    public void onPurchasesUpdated(
        BillingResult billingResult,
        List<Purchase> purchases
    ) {
        if (billingResult.getResponseCode() != BillingClient.BillingResponseCode.OK ||
            purchases == null) {
            emitPurchaseResult(
                billingResult.getResponseCode() ==
                    BillingClient.BillingResponseCode.USER_CANCELED
                    ? "cancelled"
                    : "error",
                billingResult,
                null
            );
            return;
        }

        for (Purchase purchase : purchases) {
            if (purchase.getPurchaseState() == Purchase.PurchaseState.PENDING) {
                emitPurchaseResult("pending", billingResult, purchase);
                continue;
            }

            if (purchase.getPurchaseState() != Purchase.PurchaseState.PURCHASED) {
                emitPurchaseResult("error", billingResult, purchase);
                continue;
            }

            if (purchase.isAcknowledged()) {
                emitPurchaseResult("purchased", billingResult, purchase);
                continue;
            }

            AcknowledgePurchaseParams params =
                AcknowledgePurchaseParams.newBuilder()
                    .setPurchaseToken(purchase.getPurchaseToken())
                    .build();

            billingClient.acknowledgePurchase(params, acknowledgeResult -> {
                emitPurchaseResult(
                    acknowledgeResult.getResponseCode() ==
                        BillingClient.BillingResponseCode.OK
                        ? "purchased"
                        : "error",
                    acknowledgeResult,
                    purchase
                );
            });
        }
    }

    private void emitPurchaseResult(
        String status,
        BillingResult billingResult,
        Purchase purchase
    ) {
        JSObject result = new JSObject();
        result.put("status", status);
        result.put("responseCode", billingResult.getResponseCode());
        result.put("debugMessage", billingResult.getDebugMessage());

        com.getcapacitor.JSArray productIds =
            new com.getcapacitor.JSArray();

        if (purchase != null) {
            for (String productId : purchase.getProducts()) {
                productIds.put(productId);
            }
        }

        result.put("productIds", productIds);
        notifyListeners("purchaseUpdated", result);
    }
}
