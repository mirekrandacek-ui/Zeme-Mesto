package com.randis2288.zememesto;

import android.app.AlertDialog;
import android.os.Bundle;
import android.util.Log;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;

import com.getcapacitor.BridgeActivity;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.InstallStateUpdatedListener;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.InstallStatus;
import com.google.android.play.core.install.model.UpdateAvailability;

import java.util.Locale;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "ZemeMestoUpdate";

    private AppUpdateManager appUpdateManager;
    private boolean updateCheckInProgress = false;
    private boolean updateFlowStarted = false;
    private boolean completionDialogVisible = false;

    private final ActivityResultLauncher<IntentSenderRequest> updateLauncher =
        registerForActivityResult(
            new ActivityResultContracts.StartIntentSenderForResult(),
            result -> {
                if (result.getResultCode() != RESULT_OK) {
                    updateFlowStarted = false;

                    Log.i(
                        TAG,
                        "Aktualizace nebyla potvrzena. Kód: "
                            + result.getResultCode()
                    );
                }
            }
        );

    private final InstallStateUpdatedListener updateListener = state -> {
        if (state.installStatus() == InstallStatus.DOWNLOADED) {
            runOnUiThread(this::showCompleteUpdateDialog);
            return;
        }

        if (
            state.installStatus() == InstallStatus.CANCELED
                || state.installStatus() == InstallStatus.FAILED
        ) {
            updateFlowStarted = false;
        }
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PlayBillingPlugin.class);
        super.onCreate(savedInstanceState);

        appUpdateManager = AppUpdateManagerFactory.create(this);
        appUpdateManager.registerListener(updateListener);
    }

    @Override
    public void onResume() {
        super.onResume();
        checkForAppUpdate();
    }

    @Override
    public void onDestroy() {
        if (appUpdateManager != null) {
            appUpdateManager.unregisterListener(updateListener);
        }

        super.onDestroy();
    }

    private void checkForAppUpdate() {
        if (appUpdateManager == null || updateCheckInProgress) {
            return;
        }

        updateCheckInProgress = true;

        appUpdateManager
            .getAppUpdateInfo()
            .addOnSuccessListener(appUpdateInfo -> {
                updateCheckInProgress = false;

                if (appUpdateInfo.installStatus() == InstallStatus.DOWNLOADED) {
                    showCompleteUpdateDialog();
                    return;
                }

                if (
                    !updateFlowStarted
                        && appUpdateInfo.updateAvailability()
                            == UpdateAvailability.UPDATE_AVAILABLE
                        && appUpdateInfo.isUpdateTypeAllowed(
                            AppUpdateType.FLEXIBLE
                        )
                ) {
                    updateFlowStarted = true;

                    try {
                        appUpdateManager.startUpdateFlowForResult(
                            appUpdateInfo,
                            updateLauncher,
                            AppUpdateOptions
                                .newBuilder(AppUpdateType.FLEXIBLE)
                                .build()
                        );
                    } catch (Exception error) {
                        updateFlowStarted = false;
                        Log.e(TAG, "Aktualizaci se nepodařilo spustit.", error);
                    }
                }
            })
            .addOnFailureListener(error -> {
                updateCheckInProgress = false;
                Log.e(TAG, "Kontrola aktualizace selhala.", error);
            });
    }

    private void showCompleteUpdateDialog() {
        if (
            completionDialogVisible
                || appUpdateManager == null
                || isFinishing()
                || isDestroyed()
        ) {
            return;
        }

        completionDialogVisible = true;

        AlertDialog dialog = new AlertDialog.Builder(this)
            .setTitle(
                localizedText(
                    "Aktualizace je připravená",
                    "Update ready",
                    "Actualización lista"
                )
            )
            .setMessage(
                localizedText(
                    "Pro dokončení aktualizace se aplikace restartuje.",
                    "The app will restart to finish the update.",
                    "La aplicación se reiniciará para finalizar la actualización."
                )
            )
            .setPositiveButton(
                localizedText("Dokončit", "Finish", "Finalizar"),
                (ignored, which) -> {
                    completionDialogVisible = false;
                    appUpdateManager.completeUpdate();
                }
            )
            .setNegativeButton(
                localizedText("Později", "Later", "Más tarde"),
                (ignored, which) -> completionDialogVisible = false
            )
            .create();

        dialog.setOnCancelListener(
            ignored -> completionDialogVisible = false
        );

        dialog.show();
    }

    private String localizedText(
        String czech,
        String english,
        String spanish
    ) {
        String language = Locale.getDefault().getLanguage();

        if ("es".equals(language)) {
            return spanish;
        }

        if ("cs".equals(language) || "sk".equals(language)) {
            return czech;
        }

        return english;
    }
}
