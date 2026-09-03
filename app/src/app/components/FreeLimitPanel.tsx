"use client";

import type { ReactNode } from "react";
import { getUiText, type UiLanguage } from "@/app/room/[code]/uiText";
import styles from "./FreeLimitPanel.module.css";

type FreeLimitPanelProps = {
  language: UiLanguage;
  purchaseDisabled?: boolean;
  rewardDisabled?: boolean;
  onBuyPremium: () => void;
  onBuySuperPremium: () => void;
  onWatchRewarded: () => void;
  footer?: ReactNode;
};

export default function FreeLimitPanel({
  language,
  purchaseDisabled = false,
  rewardDisabled = false,
  onBuyPremium,
  onBuySuperPremium,
  onWatchRewarded,
  footer,
}: FreeLimitPanelProps) {
  const t = (key: Parameters<typeof getUiText>[1]) => getUiText(language, key);

  return (
    <section className={styles.panel}>
      <h3>{t("freeLimitTitle")}</h3>
      <p>{t("freeLimitText")}</p>

      <div className={styles.separator} />
      <button type="button" className={styles.button} disabled={purchaseDisabled} onClick={onBuyPremium}>
        {t("freeUpgradeButton")}
      </button>
      <p className={styles.description}>{t("premiumPurchaseDescription")}</p>

      <div className={styles.separator} />
      <button type="button" className={styles.button} disabled={purchaseDisabled} onClick={onBuySuperPremium}>
        {t("buySuperPremium")}
      </button>
      <p className={styles.description}>{t("superPremiumPurchaseDescription")}</p>
      <p className={styles.benefitsIntro}>{t("superPremiumBenefitsIntro")}</p>
      <ul className={styles.benefits}>
        {t("superPremiumBenefits").split("|").map((benefit) => (
          <li key={benefit}>{benefit}</li>
        ))}
      </ul>

      <div className={styles.separator} />
      <button type="button" className={styles.button} disabled={rewardDisabled} onClick={onWatchRewarded}>
        <span className={styles.rewardLine}>{t("freeRewardButtonLine1")}</span>
        <span className={styles.rewardLine}>{t("freeRewardButtonLine2")}</span>
      </button>

      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </section>
  );
}
