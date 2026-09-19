package com.randis2288.zememesto;

import android.app.AlertDialog;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;

import androidx.activity.OnBackPressedCallback;
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
    private boolean exitDialogVisible = false;
    private OnBackInvokedCallback backInvokedCallback;

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

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            backInvokedCallback = this::showExitGameDialog;
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                backInvokedCallback
            );
        } else {
            getOnBackPressedDispatcher().addCallback(
                this,
                new OnBackPressedCallback(true) {
                    @Override
                    public void handleOnBackPressed() {
                        showExitGameDialog();
                    }
                }
            );
        }

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
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && backInvokedCallback != null
        ) {
            getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(
                backInvokedCallback
            );
            backInvokedCallback = null;
        }

        if (appUpdateManager != null) {
            appUpdateManager.unregisterListener(updateListener);
        }

        super.onDestroy();
    }

    private void showExitGameDialog() {
        if (exitDialogVisible || isFinishing() || isDestroyed()) {
            return;
        }

        exitDialogVisible = true;

        AlertDialog dialog = new AlertDialog.Builder(this)
            .setMessage(localizedText(
                "Ukončit hru?",
                "Exit game?",
                "¿Salir del juego?",
                "Spiel beenden?",
                "Quitter le jeu ?",
                "Sair do jogo?",
                "Keluar dari permainan?",
                "Oyundan çıkılsın mı?",
                "Zakończyć grę?",
                "Uscire dal gioco?"
            ))
            .setNegativeButton(
                localizedText(
                    "Ano", "Yes", "Sí", "Ja", "Oui",
                    "Sim", "Ya", "Evet", "Tak", "Sì"
                ),
                (ignored, which) -> {
                    exitDialogVisible = false;
                    finishAndRemoveTask();
                }
            )
            .setPositiveButton(
                localizedText(
                    "Ne", "No", "No", "Nein", "Non",
                    "Não", "Tidak", "Hayır", "Nie", "No"
                ),
                (ignored, which) -> exitDialogVisible = false
            )
            .create();

        dialog.setOnCancelListener(
            ignored -> exitDialogVisible = false
        );

        dialog.show();
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
            .setTitle(localizedText(
                "Aktualizace je připravená",
                "Update ready",
                "Actualización lista",
                "Update bereit",
                "Mise à jour prête",
                "Atualização pronta",
                "Pembaruan siap",
                "Güncelleme hazır",
                "Aktualizacja gotowa",
                "Aggiornamento pronto"
            ))
            .setMessage(localizedText(
                "Pro dokončení aktualizace se aplikace restartuje.",
                "The app will restart to finish the update.",
                "La aplicación se reiniciará para finalizar la actualización.",
                "Die App wird neu gestartet, um das Update abzuschließen.",
                "L’application redémarrera pour terminer la mise à jour.",
                "O app será reiniciado para concluir a atualização.",
                "Aplikasi akan dimulai ulang untuk menyelesaikan pembaruan.",
                "Güncellemeyi tamamlamak için uygulama yeniden başlatılacak.",
                "Aplikacja uruchomi się ponownie, aby dokończyć aktualizację.",
                "L’app verrà riavviata per completare l’aggiornamento."
            ))
            .setPositiveButton(
                localizedText(
                    "Dokončit", "Finish", "Finalizar", "Abschließen", "Terminer",
                    "Concluir", "Selesaikan", "Tamamla", "Dokończ", "Completa"
                ),
                (ignored, which) -> {
                    completionDialogVisible = false;
                    appUpdateManager.completeUpdate();
                }
            )
            .setNegativeButton(
                localizedText(
                    "Později", "Later", "Más tarde", "Später", "Plus tard",
                    "Mais tarde", "Nanti", "Daha sonra", "Później", "Più tardi"
                ),
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
        String spanish,
        String german,
        String french,
        String portugueseBrazil,
        String indonesian,
        String turkish,
        String polish,
        String italian
    ) {
        String language = Locale.getDefault().getLanguage();
        String country = Locale.getDefault().getCountry();

        if ("cs".equals(language) || "sk".equals(language)) return czech;
        if ("es".equals(language)) return spanish;
        if ("de".equals(language)) return german;
        if ("fr".equals(language)) return french;
        if ("pt".equals(language) && "BR".equalsIgnoreCase(country)) return portugueseBrazil;
        if ("pt".equals(language)) return portugueseBrazil;
        if ("id".equals(language)) return indonesian;
        if ("tr".equals(language)) return turkish;
        if ("pl".equals(language)) return polish;
        if ("it".equals(language)) return italian;

        return english;
    }
}
