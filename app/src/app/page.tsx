"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase";
import {
  isNativeAdMobAvailable,
  showFreeBannerAdForNativeApp,
  showFreeRewardedAdForNativeApp,
} from "@/lib/admob";
import {
  acknowledgePlayPurchase,
  isPlayBillingAvailable,
  PlayBilling,
  type BillingProduct,
  verifyPlayPurchase,
} from "@/lib/playBilling";
import {
  getFreeQuotaState,
  unlockFreeRoundBlock,
} from "@/lib/freeQuota";
import { getOrCreateLetterDeckOwnerId } from "@/lib/letterDeckOwner";
import { getUiText as getRoomUiText } from "@/app/room/[code]/uiText";

type Tier = "free" | "premium" | "super_premium";
type UiLanguage = "cs" | "en" | "es" | "de" | "fr" | "pt-BR" | "id" | "tr" | "pl" | "it";
type RoomLanguage =
  | UiLanguage
  | "pt-BR"
  | "de"
  | "fr"
  | "id"
  | "tr"
  | "pl"
  | "it";

const FREE_CATEGORIES = ["Země", "Město", "Jméno"];

const PREMIUM_CATEGORIES = ["Země", "Město", "Jméno", "Zvíře", "Věc", "Rostlina"];

const EXTENDED_CATEGORIES = [
  "Film / Seriál",
  "Herec / Herečka",
  "Zpěvák / Zpěvačka / Kapela",
  "Sport",
  "Značka",
  "Auto / Moto",
  "Řeka / Hora",
  "Povolání",
  "Barva",
];


function createRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createCreatorToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function tierLabel(tier: Tier) {
  if (tier === "premium") return "Premium";
  if (tier === "super_premium") return "Super Premium";
  return "Free";
}

const ENABLED_UI_LANGUAGES: readonly UiLanguage[] = [
  "en",
  "cs",
  "de",
  "es",
  "fr",
  "it",
  "pl",
  "pt-BR",
  "tr",
  "id",
];

const ENABLED_GAME_LANGUAGES: readonly RoomLanguage[] = [
  "en",
  "cs",
  "de",
  "es",
  "fr",
  "it",
  "pl",
  "pt-BR",
  "tr",
  "id",
];

function isRoomLanguage(value: string | null): value is RoomLanguage {
  return ENABLED_GAME_LANGUAGES.includes(value as RoomLanguage);
}

const LANGUAGE_FLAGS: Record<RoomLanguage, string> = {
  cs: "🇨🇿",
  en: "🇬🇧",
  es: "🇪🇸",
  "pt-BR": "🇧🇷",
  de: "🇩🇪",
  fr: "🇫🇷",
  id: "🇮🇩",
  tr: "🇹🇷",
  pl: "🇵🇱",
  it: "🇮🇹",
};

const LANGUAGE_NAMES: Record<
  UiLanguage,
  Record<RoomLanguage, string>
> = {
  cs: {
    cs: "Čeština",
    en: "Angličtina",
    es: "Španělština",
    "pt-BR": "Brazilská portugalština",
    de: "Němčina",
    fr: "Francouzština",
    id: "Indonéština",
    tr: "Turečtina",
    pl: "Polština",
    it: "Italština",
  },
  en: {
    cs: "Czech",
    en: "English",
    es: "Spanish",
    "pt-BR": "Brazilian Portuguese",
    de: "German",
    fr: "French",
    id: "Indonesian",
    tr: "Turkish",
    pl: "Polish",
    it: "Italian",
  },
  es: {
    cs: "Checo",
    en: "Inglés",
    es: "Español",
    "pt-BR": "Portugués de Brasil",
    de: "Alemán",
    fr: "Francés",
    id: "Indonesio",
    tr: "Turco",
    pl: "Polaco",
    it: "Italiano",
  },
  de: {
    cs: "Tschechisch",
    en: "Englisch",
    es: "Spanisch",
    "pt-BR": "Brasilianisches Portugiesisch",
    de: "Deutsch",
    fr: "Französisch",
    id: "Indonesisch",
    tr: "Türkisch",
    pl: "Polnisch",
    it: "Italienisch",
  },

  fr: {
    cs: "Tchèque",
    en: "Anglais",
    es: "Espagnol",
    "pt-BR": "Portugais du Brésil",
    de: "Allemand",
    fr: "Français",
    id: "Indonésien",
    tr: "Turc",
    pl: "Polonais",
    it: "Italien",
  },

  "pt-BR": {
    cs: "Tcheco",
    en: "Inglês",
    es: "Espanhol",
    "pt-BR": "Português do Brasil",
    de: "Alemão",
    fr: "Francês",
    id: "Indonésio",
    tr: "Turco",
    pl: "Polonês",
    it: "Italiano",
  },

  id: {
    cs: "Ceko",
    en: "Inggris",
    es: "Spanyol",
    "pt-BR": "Portugis Brasil",
    de: "Jerman",
    fr: "Prancis",
    id: "Indonesia",
    tr: "Turki",
    pl: "Polandia",
    it: "Italia",
  },

  tr: {
    cs: "Çekçe",
    en: "İngilizce",
    es: "İspanyolca",
    "pt-BR": "Brezilya Portekizcesi",
    de: "Almanca",
    fr: "Fransızca",
    id: "Endonezce",
    tr: "Türkçe",
    pl: "Lehçe",
    it: "İtalyanca",
  },

  pl: {
    cs: "Czeski",
    en: "Angielski",
    es: "Hiszpański",
    "pt-BR": "Portugalski brazylijski",
    de: "Niemiecki",
    fr: "Francuski",
    id: "Indonezyjski",
    tr: "Turecki",
    pl: "Polski",
    it: "Włoski",
  },
  it: {
    cs: "Ceco",
    en: "Inglese",
    es: "Spagnolo",
    "pt-BR": "Portoghese brasiliano",
    de: "Tedesco",
    fr: "Francese",
    id: "Indonesiano",
    tr: "Turco",
    pl: "Polacco",
    it: "Italiano",
  },
};

function languageOptionLabel(
  optionLanguage: RoomLanguage,
  uiLanguage: UiLanguage
) {
  return `${LANGUAGE_FLAGS[optionLanguage]} ${LANGUAGE_NAMES[uiLanguage][optionLanguage]}`;
}

const HOME_TEXT = {
  cs: {
    appTitleFirstLine: "Země Město",
    appTitleSecondLine: "",
    applicationLanguage: "Jazyk aplikace",
    creatingRoom: "vytvářím místnost…",
    roomCreateError: "❌ Místnost se nepodařilo vytvořit. Zkus to znovu.",
    uniqueRoomCodeError:
      "❌ Nepodařilo se vytvořit unikátní kód místnosti. Zkus to znovu.",
    roomCodeRequired: "❗ Zadej kód místnosti.",
    yourMode: "Tvůj režim",
    active: "Aktivní",
    gameLanguage: "Jazyk hry",
    gameLanguageHelp:
      "V tomto jazyce budeš psát odpovědi a zvolí se podle něj typ abecedy.",
    diacriticsHelp:
      "Diakritika se neřeší – odpovědi s háčky a čárkami i bez nich se berou stejně.",
    likeApp: "Líbí se vám aplikace?",
    haveRoomCode: "Mám kód místnosti",
    roomCode: "Kód místnosti",
    join: "Připojit se",
    privacyPolicy: "Zásady ochrany soukromí",
    intro: "Vytvoř místnost, pošli odkaz ostatním hráčům a hrajte společně.",
    billingNotReady: "Google Play Billing zatím není připravený.",
    productUnavailable: "Produkt zatím není dostupný.",
    purchaseWindowError: "Nákupní okno se nepodařilo otevřít.",
    purchaseStartError: "Nákup se nepodařilo spustit.",
    freeDescription:
      "Reklamy, až 3 hráči. Pevné kategorie: Země, Město, Jméno.",
    premiumDescription:
      "Max. 5 hráčů. Pevně dané základní kategorie: Země, Město, Jméno, Zvíře, Věc, Rostlina.",
    superPremiumDescription:
      "Neomezený počet hráčů, volba počtu a pořadí kategorií, časový limit na kolo, nastavení počtu kol a možnost vytvořit až 5 vlastních kategorií.",
    superPremiumCategories:
      "Kategorie: Země, Město, Jméno, Zvíře, Věc, Rostlina, Film / Seriál, Herec / Herečka, Zpěvák / Zpěvačka / Kapela, Sport, Značka, Auto / Moto, Řeka / Hora, Povolání, Barva.",
    creating: "Vytvářím…",
    createRoom: "Vytvořit místnost",
    hideOtherModes: "Skrýt další režimy",
    showOtherModes: "Zobrazit další režimy",
    includedInSuperPremium: "Součást Super Premium",
    buyPremium: "Koupit Premium",
    superPremiumPurchaseDescription:
      "Neomezený počet hráčů, všechny základní i rozšířené kategorie v ceně, volba počtu a pořadí kategorií, časový limit na kolo, nastavení počtu kol a možnost vytvořit až 5 vlastních kategorií.",
    upgradeToSuperPremium: "Upgradovat na Super Premium",
    upgradeToSuperPremiumFor: "Upgradovat na Super Premium za",
    buySuperPremium: "Koupit Super Premium",
    ratingUnavailable:
      "Hodnocení bude dostupné po vydání aplikace na Google Play.",
  },
  en: {
    appTitleFirstLine: "Stop:",
    appTitleSecondLine: "Categories Word Game",
    applicationLanguage: "Application language",
    creatingRoom: "creating room…",
    roomCreateError: "❌ The room could not be created. Try again.",
    uniqueRoomCodeError:
      "❌ Could not create a unique room code. Try again.",
    roomCodeRequired: "❗ Enter a room code.",
    yourMode: "Your mode",
    active: "Active",
    gameLanguage: "Game language",
    gameLanguageHelp:
      "You will write answers in this language and it will choose the alphabet type.",
    diacriticsHelp:
      "Accents do not matter – accented and non-accented answers count the same.",
    likeApp: "Do you like the app?",
    haveRoomCode: "I have a room code",
    roomCode: "Room code",
    join: "Join",
    privacyPolicy: "Privacy Policy",
    intro: "Create a room, share the link with other players and play together.",
    billingNotReady: "Google Play Billing is not ready.",
    productUnavailable: "The product is not available.",
    purchaseWindowError: "The purchase window could not be opened.",
    purchaseStartError: "The purchase could not be started.",
    freeDescription:
      "Ads, up to 3 players. Fixed categories: Country, City, Name.",
    premiumDescription:
      "Up to 5 players. Fixed basic categories: Country, City, Name, Animal, Thing, Plant.",
    superPremiumDescription:
      "Unlimited players, category selection and ordering, optional time limit per round, number of rounds, and up to 5 custom categories.",
    superPremiumCategories:
      "Categories: Country, City, Name, Animal, Thing, Plant, Film / Series, Actor / Actress, Singer / Band, Sport, Brand, Car / Motorbike, River / Mountain, Job, Colour.",
    creating: "Creating…",
    createRoom: "Create room",
    hideOtherModes: "Hide other modes",
    showOtherModes: "Show other modes",
    includedInSuperPremium: "Included in Super Premium",
    buyPremium: "Buy Premium",
    superPremiumPurchaseDescription:
      "Unlimited players, all basic and extended categories included, category selection and ordering, optional time limit per round, number of rounds, and up to 5 custom categories.",
    upgradeToSuperPremium: "Upgrade to Super Premium",
    upgradeToSuperPremiumFor: "Upgrade to Super Premium for",
    buySuperPremium: "Buy Super Premium",
    ratingUnavailable:
      "Rating will be available after the app is released on Google Play.",
  },
  es: {
    appTitleFirstLine: "Basta:",
    appTitleSecondLine: "Juego de Categorías",
    applicationLanguage: "Idioma de la aplicación",
    creatingRoom: "creando sala…",
    roomCreateError:
      "❌ No se pudo crear la sala. Inténtalo de nuevo.",
    uniqueRoomCodeError:
      "❌ No se pudo crear un código de sala único. Inténtalo de nuevo.",
    roomCodeRequired: "❗ Introduce el código de la sala.",
    yourMode: "Tu modo",
    active: "Activo",
    gameLanguage: "Idioma del juego",
    gameLanguageHelp:
      "Escribirás las respuestas en este idioma y se elegirá el tipo de alfabeto según él.",
    diacriticsHelp:
      "Los acentos no importan – las respuestas con o sin acento cuentan igual.",
    likeApp: "¿Te gusta la aplicación?",
    haveRoomCode: "Tengo un código de sala",
    roomCode: "Código de sala",
    join: "Unirse",
    privacyPolicy: "Política de privacidad",
    intro: "Crea una sala, comparte el enlace con los demás jugadores y jugad juntos.",
    billingNotReady: "Google Play Billing no está preparado.",
    productUnavailable: "El producto no está disponible.",
    purchaseWindowError: "No se pudo abrir la ventana de compra.",
    purchaseStartError: "No se pudo iniciar la compra.",
    freeDescription:
      "Con anuncios, hasta 3 jugadores. Categorías fijas: País, Ciudad, Nombre.",
    premiumDescription:
      "Hasta 5 jugadores. Categorías básicas fijas: País, Ciudad, Nombre, Animal, Cosa, Planta.",
    superPremiumDescription:
      "Jugadores sin límite, selección y orden de categorías, límite de tiempo por ronda, número de rondas y hasta 5 categorías propias.",
    superPremiumCategories:
      "Categorías: País, Ciudad, Nombre, Animal, Cosa, Planta, Película / Serie, Actor / Actriz, Cantante / Banda, Deporte, Marca, Coche / Moto, Río / Montaña, Profesión, Color.",
    creating: "Creando…",
    createRoom: "Crear sala",
    hideOtherModes: "Ocultar otros modos",
    showOtherModes: "Mostrar otros modos",
    includedInSuperPremium: "Incluido en Super Premium",
    buyPremium: "Comprar Premium",
    superPremiumPurchaseDescription:
      "Jugadores sin límite, todas las categorías básicas y ampliadas incluidas, selección y orden de categorías, límite de tiempo por ronda, número de rondas y hasta 5 categorías propias.",
    upgradeToSuperPremium: "Pasar a Super Premium",
    upgradeToSuperPremiumFor: "Pasar a Super Premium por",
    buySuperPremium: "Comprar Super Premium",
    ratingUnavailable:
      "La valoración estará disponible después del lanzamiento en Google Play.",
  },

  de: {
    appTitleFirstLine: "Stadt Land Fluss:",
    appTitleSecondLine: "Wortspiel",
    applicationLanguage: "App-Sprache",
    creatingRoom: "Raum wird erstellt…",
    roomCreateError:
      "❌ Der Raum konnte nicht erstellt werden. Versuche es erneut.",
    uniqueRoomCodeError:
      "❌ Es konnte kein eindeutiger Raumcode erstellt werden. Versuche es erneut.",
    roomCodeRequired: "❗ Gib einen Raumcode ein.",
    yourMode: "Dein Modus",
    active: "Aktiv",
    gameLanguage: "Spielsprache",
    gameLanguageHelp:
      "Du schreibst die Antworten in dieser Sprache. Das passende Alphabet wird automatisch ausgewählt.",
    diacriticsHelp:
      "Sonderzeichen sind optional – Antworten mit und ohne sie werden gleich gewertet.",
    likeApp: "Gefällt dir die App?",
    haveRoomCode: "Ich habe einen Raumcode",
    roomCode: "Raumcode",
    join: "Beitreten",
    privacyPolicy: "Datenschutzerklärung",
    intro:
      "Erstelle einen Raum, teile den Link mit den anderen Spielern und spielt gemeinsam.",
    billingNotReady: "Google Play Billing ist noch nicht bereit.",
    productUnavailable: "Das Produkt ist derzeit nicht verfügbar.",
    purchaseWindowError: "Das Kauffenster konnte nicht geöffnet werden.",
    purchaseStartError: "Der Kauf konnte nicht gestartet werden.",
    freeDescription:
      "Werbung, bis zu 3 Spieler. Feste Kategorien: Land, Stadt, Name.",
    premiumDescription:
      "Bis zu 5 Spieler. Feste Grundkategorien: Land, Stadt, Name, Tier, Gegenstand, Pflanze.",
    superPremiumDescription:
      "Unbegrenzt viele Spieler, Auswahl und Reihenfolge der Kategorien, optionales Zeitlimit pro Runde, Anzahl der Runden und bis zu 5 eigene Kategorien.",
    superPremiumCategories:
      "Kategorien: Land, Stadt, Name, Tier, Gegenstand, Pflanze, Film / Serie, Schauspieler / Schauspielerin, Sänger / Sängerin / Band, Sportart, Marke, Auto / Motorrad, Fluss / Berg, Beruf, Farbe.",
    creating: "Wird erstellt…",
    createRoom: "Raum erstellen",
    hideOtherModes: "Weitere Modi ausblenden",
    showOtherModes: "Weitere Modi anzeigen",
    includedInSuperPremium: "In Super Premium enthalten",
    buyPremium: "Premium kaufen",
    superPremiumPurchaseDescription:
      "Unbegrenzt viele Spieler, alle Grund- und Zusatzkategorien enthalten, Auswahl und Reihenfolge der Kategorien, optionales Zeitlimit pro Runde, Anzahl der Runden und bis zu 5 eigene Kategorien.",
    upgradeToSuperPremium: "Auf Super Premium upgraden",
    upgradeToSuperPremiumFor: "Auf Super Premium upgraden für",
    buySuperPremium: "Super Premium kaufen",
    ratingUnavailable:
      "Die Bewertung ist verfügbar, sobald die App bei Google Play veröffentlicht wurde.",
  },

  fr: {
    appTitleFirstLine: "Petit Bac:",
    appTitleSecondLine: "Jeu de catégories",
    applicationLanguage: "Langue de l’application",
    creatingRoom: "création de la salle…",
    roomCreateError: "❌ Impossible de créer la salle. Réessaie.",
    uniqueRoomCodeError: "❌ Impossible de créer un code de salle unique. Réessaie.",
    roomCodeRequired: "❗ Saisis un code de salle.",
    yourMode: "Ton mode",
    active: "Actif",
    gameLanguage: "Langue du jeu",
    gameLanguageHelp: "Tu écriras les réponses dans cette langue et l’alphabet adapté sera choisi automatiquement.",
    diacriticsHelp: "Les accents ne sont pas obligatoires – les réponses avec ou sans accents comptent de la même façon.",
    likeApp: "Tu aimes l’application ?",
    haveRoomCode: "J’ai un code de salle",
    roomCode: "Code de salle",
    join: "Rejoindre",
    privacyPolicy: "Politique de confidentialité",
    intro: "Crée une salle, partage le lien avec les autres joueurs et jouez tous ensemble.",
    billingNotReady: "La facturation Google Play n’est pas encore prête.",
    productUnavailable: "Le produit n’est pas disponible.",
    purchaseWindowError: "Impossible d’ouvrir la fenêtre d’achat.",
    purchaseStartError: "Impossible de démarrer l’achat.",
    freeDescription: "Publicités, jusqu’à 3 joueurs. Catégories fixes : Pays, Ville, Prénom.",
    premiumDescription: "Jusqu’à 5 joueurs. Catégories de base fixes : Pays, Ville, Prénom, Animal, Objet, Plante.",
    superPremiumDescription: "Nombre de joueurs illimité, sélection et ordre des catégories, limite de temps facultative par manche, nombre de manches et jusqu’à 5 catégories personnalisées.",
    superPremiumCategories: "Catégories : Pays, Ville, Prénom, Animal, Objet, Plante, Film / Série, Acteur / Actrice, Chanteur / Chanteuse / Groupe, Sport, Marque, Voiture / Moto, Rivière / Montagne, Métier, Couleur.",
    creating: "Création…",
    createRoom: "Créer une salle",
    hideOtherModes: "Masquer les autres modes",
    showOtherModes: "Afficher les autres modes",
    includedInSuperPremium: "Inclus dans Super Premium",
    buyPremium: "Acheter Premium",
    superPremiumPurchaseDescription: "Nombre de joueurs illimité, toutes les catégories de base et supplémentaires incluses, sélection et ordre des catégories, limite de temps facultative par manche, nombre de manches et jusqu’à 5 catégories personnalisées.",
    upgradeToSuperPremium: "Passer à Super Premium",
    upgradeToSuperPremiumFor: "Passer à Super Premium pour",
    buySuperPremium: "Acheter Super Premium",
    ratingUnavailable: "L’évaluation sera disponible après la publication de l’application sur Google Play.",
  },

  "pt-BR": {
    appTitleFirstLine: "Stop:",
    appTitleSecondLine: "Adedonha",
    applicationLanguage: "Idioma do aplicativo",
    creatingRoom: "criando sala…",
    roomCreateError: "❌ Não foi possível criar a sala. Tente novamente.",
    uniqueRoomCodeError: "❌ Não foi possível criar um código de sala exclusivo. Tente novamente.",
    roomCodeRequired: "❗ Digite o código da sala.",
    yourMode: "Seu modo",
    active: "Ativo",
    gameLanguage: "Idioma do jogo",
    gameLanguageHelp: "Você escreverá as respostas neste idioma, e o alfabeto adequado será escolhido automaticamente.",
    diacriticsHelp: "Os acentos não são obrigatórios – respostas com ou sem acentos valem da mesma forma.",
    likeApp: "Você gostou do aplicativo?",
    haveRoomCode: "Tenho um código de sala",
    roomCode: "Código da sala",
    join: "Entrar",
    privacyPolicy: "Política de Privacidade",
    intro: "Crie uma sala, compartilhe o link com os outros jogadores e joguem juntos.",
    billingNotReady: "O faturamento do Google Play ainda não está pronto.",
    productUnavailable: "O produto não está disponível.",
    purchaseWindowError: "Não foi possível abrir a janela de compra.",
    purchaseStartError: "Não foi possível iniciar a compra.",
    freeDescription: "Anúncios, até 3 jogadores. Categorias fixas: País, Cidade, Nome.",
    premiumDescription: "Até 5 jogadores. Categorias básicas fixas: País, Cidade, Nome, Animal, Objeto, Planta.",
    superPremiumDescription: "Jogadores ilimitados, seleção e ordem das categorias, limite de tempo opcional por rodada, número de rodadas e até 5 categorias personalizadas.",
    superPremiumCategories: "Categorias: País, Cidade, Nome, Animal, Objeto, Planta, Filme / Série, Ator / Atriz, Cantor / Cantora / Banda, Esporte, Marca, Carro / Moto, Rio / Montanha, Profissão, Cor.",
    creating: "Criando…",
    createRoom: "Criar sala",
    hideOtherModes: "Ocultar outros modos",
    showOtherModes: "Mostrar outros modos",
    includedInSuperPremium: "Incluído no Super Premium",
    buyPremium: "Comprar Premium",
    superPremiumPurchaseDescription: "Jogadores ilimitados, todas as categorias básicas e adicionais incluídas, seleção e ordem das categorias, limite de tempo opcional por rodada, número de rodadas e até 5 categorias personalizadas.",
    upgradeToSuperPremium: "Fazer upgrade para Super Premium",
    upgradeToSuperPremiumFor: "Fazer upgrade para Super Premium por",
    buySuperPremium: "Comprar Super Premium",
    ratingUnavailable: "A avaliação estará disponível depois que o aplicativo for publicado no Google Play.",
  },
  id: {
    appTitleFirstLine: "ABC Lima Dasar:",
    appTitleSecondLine: "Permainan Kata",
    applicationLanguage: "Bahasa aplikasi",
    creatingRoom: "membuat ruang…",
    roomCreateError: "❌ Ruang tidak dapat dibuat. Coba lagi.",
    uniqueRoomCodeError: "❌ Kode ruang unik tidak dapat dibuat. Coba lagi.",
    roomCodeRequired: "❗ Masukkan kode ruang.",
    yourMode: "Mode kamu",
    active: "Aktif",
    gameLanguage: "Bahasa permainan",
    gameLanguageHelp: "Jawaban akan ditulis dalam bahasa ini, dan alfabet yang sesuai akan dipilih secara otomatis.",
    diacriticsHelp: "Tanda diakritik tidak wajib – jawaban dengan atau tanpa tanda diakritik dinilai sama.",
    likeApp: "Suka aplikasi ini?",
    haveRoomCode: "Saya punya kode ruang",
    roomCode: "Kode ruang",
    join: "Gabung",
    privacyPolicy: "Kebijakan Privasi",
    intro: "Buat ruang, bagikan tautannya kepada pemain lain, lalu bermain bersama.",
    billingNotReady: "Google Play Billing belum siap.",
    productUnavailable: "Produk tidak tersedia.",
    purchaseWindowError: "Jendela pembelian tidak dapat dibuka.",
    purchaseStartError: "Pembelian tidak dapat dimulai.",
    freeDescription: "Iklan, maksimal 3 pemain. Kategori tetap: Negara, Kota, Nama.",
    premiumDescription: "Maksimal 5 pemain. Kategori dasar tetap: Negara, Kota, Nama, Hewan, Benda, Tumbuhan.",
    superPremiumDescription: "Jumlah pemain tak terbatas, pilihan dan urutan kategori, batas waktu opsional per ronde, jumlah ronde, dan hingga 5 kategori buatan sendiri.",
    superPremiumCategories: "Kategori: Negara, Kota, Nama, Hewan, Benda, Tumbuhan, Film / Serial, Aktor / Aktris, Penyanyi / Grup Musik, Olahraga, Merek, Mobil / Motor, Sungai / Gunung, Pekerjaan, Warna.",
    creating: "Membuat…",
    createRoom: "Buat ruang",
    hideOtherModes: "Sembunyikan mode lain",
    showOtherModes: "Tampilkan mode lain",
    includedInSuperPremium: "Termasuk dalam Super Premium",
    buyPremium: "Beli Premium",
    superPremiumPurchaseDescription: "Jumlah pemain tak terbatas, semua kategori dasar dan tambahan tersedia, pilihan dan urutan kategori, batas waktu opsional per ronde, jumlah ronde, dan hingga 5 kategori buatan sendiri.",
    upgradeToSuperPremium: "Tingkatkan ke Super Premium",
    upgradeToSuperPremiumFor: "Tingkatkan ke Super Premium seharga",
    buySuperPremium: "Beli Super Premium",
    ratingUnavailable: "Penilaian akan tersedia setelah aplikasi dirilis di Google Play.",
  },
  tr: {
    appTitleFirstLine: "İsim Şehir:",
    appTitleSecondLine: "Kelime Oyunu",
    applicationLanguage: "Uygulama dili",
    creatingRoom: "oda oluşturuluyor…",
    roomCreateError: "❌ Oda oluşturulamadı. Tekrar dene.",
    uniqueRoomCodeError: "❌ Benzersiz oda kodu oluşturulamadı. Tekrar dene.",
    roomCodeRequired: "❗ Oda kodunu gir.",
    yourMode: "Modun",
    active: "Aktif",
    gameLanguage: "Oyun dili",
    gameLanguageHelp: "Yanıtlar bu dilde yazılacak ve uygun alfabe otomatik olarak seçilecek.",
    diacriticsHelp: "Türkçe karakterler zorunlu değildir – yanıtlar Türkçe karakterlerle veya bunlar olmadan aynı şekilde değerlendirilir.",
    likeApp: "Uygulamayı beğendin mi?",
    haveRoomCode: "Oda kodum var",
    roomCode: "Oda kodu",
    join: "Katıl",
    privacyPolicy: "Gizlilik Politikası",
    intro: "Bir oda oluştur, bağlantıyı diğer oyuncularla paylaş ve birlikte oyna.",
    billingNotReady: "Google Play Billing henüz hazır değil.",
    productUnavailable: "Ürün kullanılamıyor.",
    purchaseWindowError: "Satın alma penceresi açılamadı.",
    purchaseStartError: "Satın alma başlatılamadı.",
    freeDescription: "Reklamlı, en fazla 3 oyuncu. Sabit kategoriler: Ülke, Şehir, İsim.",
    premiumDescription: "En fazla 5 oyuncu. Sabit temel kategoriler: Ülke, Şehir, İsim, Hayvan, Eşya, Bitki.",
    superPremiumDescription: "Sınırsız oyuncu, kategori seçimi ve sıralaması, tur başına isteğe bağlı süre sınırı, tur sayısı ve en fazla 5 özel kategori.",
    superPremiumCategories: "Kategoriler: Ülke, Şehir, İsim, Hayvan, Eşya, Bitki, Film / Dizi, Oyuncu, Şarkıcı / Müzik Grubu, Spor, Marka, Araba / Motosiklet, Nehir / Dağ, Meslek, Renk.",
    creating: "Oluşturuluyor…",
    createRoom: "Oda oluştur",
    hideOtherModes: "Diğer modları gizle",
    showOtherModes: "Diğer modları göster",
    includedInSuperPremium: "Super Premium'a dahil",
    buyPremium: "Premium satın al",
    superPremiumPurchaseDescription: "Sınırsız oyuncu, tüm temel ve ek kategoriler, kategori seçimi ve sıralaması, tur başına isteğe bağlı süre sınırı, tur sayısı ve en fazla 5 özel kategori.",
    upgradeToSuperPremium: "Super Premium'a yükselt",
    upgradeToSuperPremiumFor: "Şu fiyata Super Premium'a yükselt",
    buySuperPremium: "Super Premium satın al",
    ratingUnavailable: "Uygulama Google Play'de yayınlandıktan sonra puanlama kullanılabilir olacak.",
  },
  pl: {
    appTitleFirstLine: "Państwa Miasta:",
    appTitleSecondLine: "Gra słowna",
    applicationLanguage: "Język aplikacji",
    creatingRoom: "tworzenie pokoju…",
    roomCreateError: "❌ Nie udało się utworzyć pokoju. Spróbuj ponownie.",
    uniqueRoomCodeError: "❌ Nie udało się utworzyć unikalnego kodu pokoju. Spróbuj ponownie.",
    roomCodeRequired: "❗ Wpisz kod pokoju.",
    yourMode: "Twój tryb",
    active: "Aktywny",
    gameLanguage: "Język gry",
    gameLanguageHelp: "W tym języku będziesz wpisywać odpowiedzi; na jego podstawie zostanie wybrany alfabet.",
    diacriticsHelp: "Znaki diakrytyczne nie mają znaczenia – odpowiedzi z polskimi znakami i bez nich są uznawane tak samo.",
    likeApp: "Podoba Ci się aplikacja?",
    haveRoomCode: "Mam kod pokoju",
    roomCode: "Kod pokoju",
    join: "Dołącz",
    privacyPolicy: "Polityka prywatności",
    intro: "Utwórz pokój, udostępnij link innym graczom i grajcie razem.",
    billingNotReady: "Płatności w Google Play nie są gotowe.",
    productUnavailable: "Produkt jest niedostępny.",
    purchaseWindowError: "Nie udało się otworzyć okna zakupu.",
    purchaseStartError: "Nie udało się rozpocząć zakupu.",
    freeDescription: "Reklamy, maks. 3 graczy. Stałe kategorie: Państwo, Miasto, Imię.",
    premiumDescription: "Maks. 5 graczy. Stałe kategorie podstawowe: Państwo, Miasto, Imię, Zwierzę, Rzecz, Roślina.",
    superPremiumDescription: "Nieograniczona liczba graczy, wybór i kolejność kategorii, opcjonalny limit czasu na rundę, liczba rund oraz do 5 własnych kategorii.",
    superPremiumCategories: "Kategorie: Państwo, Miasto, Imię, Zwierzę, Rzecz, Roślina, Film / Serial, Aktor / Aktorka, Piosenkarz / Zespół, Sport, Marka, Samochód / Motocykl, Rzeka / Góra, Zawód, Kolor.",
    creating: "Tworzenie…",
    createRoom: "Utwórz pokój",
    hideOtherModes: "Ukryj pozostałe tryby",
    showOtherModes: "Pokaż pozostałe tryby",
    includedInSuperPremium: "Wliczone w Super Premium",
    buyPremium: "Kup Premium",
    superPremiumPurchaseDescription: "Nieograniczona liczba graczy, wszystkie kategorie podstawowe i rozszerzone w cenie, wybór i kolejność kategorii, opcjonalny limit czasu na rundę, liczba rund oraz do 5 własnych kategorii.",
    upgradeToSuperPremium: "Przejdź na Super Premium",
    upgradeToSuperPremiumFor: "Przejdź na Super Premium za",
    buySuperPremium: "Kup Super Premium",
    ratingUnavailable: "Ocena będzie dostępna po wydaniu aplikacji w Google Play.",
  },

  it: {
    appTitleFirstLine: "Nomi Cose Città",
    appTitleSecondLine: "Gioco di parole",
    applicationLanguage: "Lingua dell’app",
    creatingRoom: "creazione della stanza…",
    roomCreateError: "❌ Impossibile creare la stanza. Riprova.",
    uniqueRoomCodeError: "❌ Impossibile creare un codice stanza univoco. Riprova.",
    roomCodeRequired: "❗ Inserisci il codice della stanza.",
    yourMode: "La tua modalità",
    active: "Attivo",
    gameLanguage: "Lingua di gioco",
    gameLanguageHelp: "In questa lingua inserirai le risposte; in base ad essa verrà scelto l’alfabeto.",
    diacriticsHelp: "I segni diacritici non contano: le risposte con o senza accenti sono considerate equivalenti.",
    likeApp: "Ti piace l’app?",
    haveRoomCode: "Ho un codice stanza",
    roomCode: "Codice stanza",
    join: "Entra",
    privacyPolicy: "Informativa sulla privacy",
    intro: "Crea una stanza, condividi il link con gli altri giocatori e giocate insieme.",
    billingNotReady: "I pagamenti Google Play non sono pronti.",
    productUnavailable: "Il prodotto non è disponibile.",
    purchaseWindowError: "Impossibile aprire la finestra di acquisto.",
    purchaseStartError: "Impossibile avviare l’acquisto.",
    freeDescription: "Pubblicità, massimo 3 giocatori. Categorie fisse: Nazione, Città, Nome.",
    premiumDescription: "Massimo 5 giocatori. Categorie base fisse: Nazione, Città, Nome, Animale, Cosa, Pianta.",
    superPremiumDescription: "Numero illimitato di giocatori, scelta e ordine delle categorie, limite di tempo facoltativo per turno, numero di turni e fino a 5 categorie personalizzate.",
    superPremiumCategories: "Categorie: Nazione, Città, Nome, Animale, Cosa, Pianta, Film / Serie TV, Attore / Attrice, Cantante / Gruppo, Sport, Marca, Auto / Moto, Fiume / Montagna, Professione, Colore.",
    creating: "Creazione…",
    createRoom: "Crea stanza",
    hideOtherModes: "Nascondi le altre modalità",
    showOtherModes: "Mostra le altre modalità",
    includedInSuperPremium: "Incluso in Super Premium",
    buyPremium: "Acquista Premium",
    superPremiumPurchaseDescription: "Numero illimitato di giocatori, tutte le categorie base ed estese incluse, scelta e ordine delle categorie, limite di tempo facoltativo per turno, numero di turni e fino a 5 categorie personalizzate.",
    upgradeToSuperPremium: "Passa a Super Premium",
    upgradeToSuperPremiumFor: "Passa a Super Premium per",
    buySuperPremium: "Acquista Super Premium",
    ratingUnavailable: "La valutazione sarà disponibile dopo la pubblicazione dell’app su Google Play.",
  },

} as const;

type HomeTextKey = keyof typeof HOME_TEXT.cs;

function getHomeText(language: UiLanguage, key: HomeTextKey) {
  return HOME_TEXT[language][key];
}

function uniqueNonEmpty(values: unknown[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (typeof value !== "string") continue;

    const cleaned = value.trim();
    if (!cleaned) continue;

    const key = cleaned.toLocaleLowerCase("cs-CZ");
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

export default function Home() {
  const router = useRouter();

  const [status, setStatus] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [freeRoundsRemaining, setFreeRoundsRemaining] = useState(3);
  const [rewardedBusy, setRewardedBusy] = useState(false);

  const [tier, setTier] = useState<Tier>("free");
  const [language, setLanguage] = useState<UiLanguage>("cs");
  const [gameLanguage, setGameLanguage] = useState<RoomLanguage>("cs");
  const [gameLanguageManuallySelected, setGameLanguageManuallySelected] =
    useState(false);
  const [nativeFreeBannerShown, setNativeFreeBannerShown] = useState(false);
  const [showOtherModes, setShowOtherModes] = useState(false);
  const [billingProducts, setBillingProducts] = useState<BillingProduct[]>([]);
  const [billingReady, setBillingReady] = useState(false);
  const [purchaseBusy, setPurchaseBusy] =
    useState<"premium" | "super_premium" | null>(null);

  const en = language === "en";
  const es = language === "es";
  const h = (key: HomeTextKey) => getHomeText(language, key);
  const freeQuotaExhausted =
    tier === "free" && freeRoundsRemaining <= 0;

  useEffect(() => {
    const syncFreeQuota = () => {
      setFreeRoundsRemaining(getFreeQuotaState().remainingRounds);
    };

    syncFreeQuota();
    window.addEventListener("focus", syncFreeQuota);
    window.addEventListener("pageshow", syncFreeQuota);

    return () => {
      window.removeEventListener("focus", syncFreeQuota);
      window.removeEventListener("pageshow", syncFreeQuota);
    };
  }, []);

  useEffect(() => {
    const savedUiLanguage = window.localStorage.getItem("zm_uiLanguage");
    const savedGameLanguage = window.localStorage.getItem("zm_gameLanguage");
    const deviceLanguage = window.navigator.language.toLowerCase();

    const detectedLanguage: UiLanguage =
      deviceLanguage.startsWith("cs") || deviceLanguage.startsWith("sk")
        ? "cs"
        : deviceLanguage.startsWith("es")
          ? "es"
          : deviceLanguage.startsWith("de")
            ? "de"
            : deviceLanguage.startsWith("fr")
              ? "fr"
              : deviceLanguage.startsWith("pt")
                ? "pt-BR"
                : deviceLanguage.startsWith("id")
                  ? "id"
                  : deviceLanguage.startsWith("tr")
                    ? "tr"
                    : deviceLanguage.startsWith("pl")
                      ? "pl"
                      : deviceLanguage.startsWith("it")
                        ? "it"
                        : "en";

    const initialUiLanguage: UiLanguage =
      savedUiLanguage === "cs" ||
      savedUiLanguage === "en" ||
      savedUiLanguage === "es" ||
      savedUiLanguage === "de" ||
      savedUiLanguage === "fr" ||
      savedUiLanguage === "pt-BR" ||
      savedUiLanguage === "id" ||
      savedUiLanguage === "tr" ||
      savedUiLanguage === "pl" ||
      savedUiLanguage === "it"
        ? savedUiLanguage
        : detectedLanguage;

    const initialGameLanguage: RoomLanguage =
      isRoomLanguage(savedGameLanguage)
        ? savedGameLanguage
        : initialUiLanguage;

    setLanguage(initialUiLanguage);
    setGameLanguage(initialGameLanguage);
    setGameLanguageManuallySelected(
      initialGameLanguage !== initialUiLanguage
    );
  }, []);

  useEffect(() => {
    if (!isPlayBillingAvailable()) return;

    async function loadPlayBilling() {
      try {
        const connection = await PlayBilling.connect();
        if (!connection.ready) return;

        setBillingReady(true);

        const [productsResult, purchasesResult] = await Promise.all([
          PlayBilling.getProducts(),
          PlayBilling.getPurchases(),
        ]);

        setBillingProducts(productsResult.products ?? []);

        const ownedProducts = new Set<string>();
        const purchaseTokensToAcknowledge: string[] = [];
        for (const purchase of purchasesResult.purchases ?? []) {
          if (purchase.purchaseState !== 1 || !purchase.purchaseToken) continue;

          const verified = await Promise.all(
            purchase.productIds.map((productId) =>
              verifyPlayPurchase(productId, purchase.purchaseToken)
            )
          );
          if (verified.some((valid) => !valid)) continue;

          purchase.productIds.forEach((productId) => ownedProducts.add(productId));
          if (!purchase.acknowledged) {
            purchaseTokensToAcknowledge.push(purchase.purchaseToken);
          }
        }

        if (ownedProducts.has("super_premium")) {
          setTier("super_premium");
        } else if (ownedProducts.has("premium")) {
          setTier("premium");
        }

        for (const purchaseToken of purchaseTokensToAcknowledge) {
          await acknowledgePlayPurchase(purchaseToken);
        }
      } catch (error) {
        console.error("Google Play Billing init failed:", error);
      }
    }

    void loadPlayBilling();
  }, []);

  useEffect(() => {
    if (!isPlayBillingAvailable()) return;

    let active = true;
    let listenerHandle: { remove: () => Promise<void> } | undefined;

    void PlayBilling.addListener("purchaseUpdated", async (event) => {
      if (!active || event.status !== "purchased" || !event.purchaseToken) return;

      try {
        const verified = await Promise.all(
          event.productIds.map((productId) =>
            verifyPlayPurchase(productId, event.purchaseToken!)
          )
        );
        if (!active || verified.some((valid) => !valid)) {
          window.alert(h("purchaseStartError"));
          return;
        }

        if (event.productIds.includes("super_premium")) {
          setTier("super_premium");
        } else if (event.productIds.includes("premium")) {
          setTier("premium");
        }

        if (!event.acknowledged) {
          await acknowledgePlayPurchase(event.purchaseToken);
        }
      } catch (error) {
        console.error("Google Play purchase verification failed:", error);
        window.alert(h("purchaseStartError"));
      }
    }).then((handle) => {
      if (!active) {
        void handle.remove();
        return;
      }

      listenerHandle = handle;
    });

    return () => {
      active = false;
      if (listenerHandle) void listenerHandle.remove();
    };
  }, []);

  async function startPlayPurchase(
    productId: "premium" | "super_premium"
  ) {
    if (!isPlayBillingAvailable() || !billingReady) {
      window.alert(h("billingNotReady"));
      return;
    }

    if (!billingProducts.some((product) => product.productId === productId)) {
      window.alert(h("productUnavailable"));
      return;
    }

    setPurchaseBusy(productId);

    try {
      const result = await PlayBilling.purchase({
        productId,
        ...(productId === "super_premium" && tier === "premium"
          ? { offerId: "premium-upgrade" }
          : {}),
      });

      if (result.responseCode !== 0) {
        console.error("Google Play Billing error:", result.debugMessage);
        window.alert(h("purchaseWindowError"));
      }
    } catch (error) {
      console.error("Google Play purchase failed:", error);
      window.alert(h("purchaseStartError"));
    } finally {
      setPurchaseBusy(null);
    }
  }

  const premiumPrice =
    billingProducts.find((product) => product.productId === "premium")
      ?.formattedPrice;

  const superPremiumProduct =
    billingProducts.find((product) => product.productId === "super_premium");

  const superPremiumPrice =
    superPremiumProduct?.formattedPrice;

  const superPremiumUpgradePrice =
    superPremiumProduct?.offers?.find(
      (offer) => offer.offerId === "premium-upgrade"
    )?.formattedPrice;

  function getRoomSettings() {
    if (tier === "premium") {
      return {
        creator_tier: "premium",
        max_players: 5,
        active_categories: PREMIUM_CATEGORIES,
        custom_category: null,
        ads_enabled: true,
      };
    }

    if (tier === "super_premium") {
      return {
        creator_tier: "super_premium",
        max_players: 999,
        active_categories: [...PREMIUM_CATEGORIES, ...EXTENDED_CATEGORIES],
        custom_category: null,
        ads_enabled: true,
      };
    }

    return {
      creator_tier: "free",
      max_players: 3,
      active_categories: FREE_CATEGORIES,
      custom_category: null,
      ads_enabled: true,
    };
  }

  useEffect(() => {
    let cancelled = false;

    async function updateHomeBanner() {
      if (!isNativeAdMobAvailable()) {
        setNativeFreeBannerShown(false);
        return;
      }

      if (!cancelled) setNativeFreeBannerShown(true);
      await showFreeBannerAdForNativeApp();
    }

    void updateHomeBanner();

    return () => {
      cancelled = true;
    };
  }, [tier]);

  async function startHomeFreeRewardedAd() {
    if (rewardedBusy) return;

    setRewardedBusy(true);
    setStatus("");

    const rewardEarned = await showFreeRewardedAdForNativeApp();

    if (!rewardEarned) {
      setRewardedBusy(false);
      setStatus(getRoomUiText(language, "freeLimitReachedMessage"));
      return;
    }

    const nextQuota = unlockFreeRoundBlock();
    setFreeRoundsRemaining(nextQuota.remainingRounds);
    setRewardedBusy(false);
    setStatus(getRoomUiText(language, "freeRewardUnlocked"));
  }

  async function createRoom() {
    if (creating) return;

    const currentQuota = getFreeQuotaState();
    setFreeRoundsRemaining(currentQuota.remainingRounds);

    if (tier === "free" && currentQuota.remainingRounds <= 0) {
      setShowOtherModes(true);
      setStatus(getRoomUiText(language, "freeLimitReachedMessage"));
      return;
    }

    setCreating(true);
    setStatus(h("creatingRoom"));

    const roomSettings = getRoomSettings();
    const letterDeckOwnerId = getOrCreateLetterDeckOwnerId();

    for (let attempt = 1; attempt <= 5; attempt++) {
      const roomCode = createRoomCode();
      const creatorToken = createCreatorToken();

      const { error } = await supabase.from("rooms").insert({
        code: roomCode,
        status: "lobby",
        letter: null,
        creator_token: creatorToken,
        letter_deck_owner_id: letterDeckOwnerId,
        language: gameLanguage,
        ...roomSettings,
        ...(tier === "free"
          ? {
              free_rounds_unlocked: currentQuota.remainingRounds,
              free_rounds_started: 0,
            }
          : {}),
      });

      if (!error) {
        if (typeof window !== "undefined") {
          localStorage.setItem(`zm_roomCreatorToken_${roomCode}`, creatorToken);
        }

        router.push(`/room/${roomCode}?ui=${language}`);
        return;
      }

      if (error.code !== "23505") {
        console.error("Room creation failed:", error);
        setStatus(h("roomCreateError"));
        setCreating(false);
        return;
      }
    }

    setStatus(h("uniqueRoomCodeError"));
    setCreating(false);
  }

  function joinRoomByCode() {
    const cleaned = roomCodeInput
      .trim()
      .replace(/\s+/g, "")
      .toUpperCase();

    if (!cleaned) {
      setStatus(h("roomCodeRequired"));
      return;
    }

    router.push(`/room/${cleaned}?ui=${language}`);
  }

  const selectGameLanguage = (selectedGameLanguage: RoomLanguage) => {
    setGameLanguage(selectedGameLanguage);
    setGameLanguageManuallySelected(selectedGameLanguage !== language);
    window.localStorage.setItem("zm_gameLanguage", selectedGameLanguage);
  };

  return (
    <main className={styles.homepage}>
      <div className={styles.photoMosaic} aria-hidden="true">
        {[
          "mountains", "castle", "eiffel", "colosseum", "woman", "elephant",
          "dog", "plant", "camera", "headphones", "backpack", "sunflower",
        ].map((photo) => <span key={photo} className={`${styles.photo} ${styles[photo]}`} />)}
      </div>
      <div className={styles.blueVeil} aria-hidden="true" />

      <div className={styles.content}>
        <header className={styles.header}>
          <label className={styles.applicationLanguage} aria-label={h("applicationLanguage")}>
            <span>{h("applicationLanguage")}</span>
            <span className={styles.selectShell}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/></svg>
              <select
                value={language}
                onChange={(e) => {
                  const selectedLanguage = e.target.value as UiLanguage;
                  setLanguage(selectedLanguage);
                  window.localStorage.setItem("zm_uiLanguage", selectedLanguage);
                  if (!gameLanguageManuallySelected) {
                    setGameLanguage(selectedLanguage);
                    window.localStorage.setItem("zm_gameLanguage", selectedLanguage);
                  } else if (gameLanguage === selectedLanguage) {
                    setGameLanguageManuallySelected(false);
                  }
                }}
              >
                {ENABLED_UI_LANGUAGES.map((optionLanguage) => (
                  <option key={optionLanguage} value={optionLanguage}>
                    {languageOptionLabel(optionLanguage, language)}
                  </option>
                ))}
              </select>
              <svg className={styles.chevron} viewBox="0 0 24 24" aria-hidden="true"><path d="m5 9 7 7 7-7"/></svg>
            </span>
          </label>
          <p className={styles.intro}>{h("intro")}</p>
        </header>

        <section className={styles.modeCard}>
          <div className={styles.cardShine} aria-hidden="true" />
          <div className={styles.modeHeading}>
            <div><span>{h("yourMode")}</span><strong>{tierLabel(tier)}</strong></div>
            <span className={styles.active}>{h("active")}</span>
          </div>

          <div className={tier === "free" ? styles.description : `${styles.description} ${styles.descriptionFull}`}>
            {tier === "free" && <p>{h("freeDescription")}</p>}
            {tier === "premium" && <p>{h("premiumDescription")}</p>}
            {tier === "super_premium" && <><p>{h("superPremiumDescription")}</p><p>{h("superPremiumCategories")}</p></>}
          </div>

          <div className={styles.divider} />
          <fieldset className={styles.gameLanguage}>
            <legend>{h("gameLanguage")}</legend>

            <details className={styles.gameLanguageDropdown}>
              <summary>
                <span className={styles.gameLanguageCurrent}>
                  <span>{LANGUAGE_FLAGS[gameLanguage]}</span>
                  {LANGUAGE_NAMES[language][gameLanguage]}
                </span>
              </summary>

              <div className={styles.gameLanguageMenu}>
                {ENABLED_GAME_LANGUAGES
                  .filter((optionLanguage) => optionLanguage !== gameLanguage)
                  .map((optionLanguage) => (
                    <button
                      key={optionLanguage}
                      type="button"
                      onClick={(event) => {
                        selectGameLanguage(optionLanguage);
                        event.currentTarget
                          .closest("details")
                          ?.removeAttribute("open");
                      }}
                    >
                      <span>{LANGUAGE_FLAGS[optionLanguage]}</span>
                      {LANGUAGE_NAMES[language][optionLanguage]}
                    </button>
                  ))}
              </div>
            </details>

            <small>{h("gameLanguageHelp")}</small>
          </fieldset>

          {tier === "free" && !freeQuotaExhausted && (
            <p className={styles.quota}><span>✓</span><strong>{freeRoundsRemaining}</strong><span aria-hidden="true"> / 3</span></p>
          )}
          {freeQuotaExhausted && (
            <section className={styles.rewardPanel}>
              <h3>{getRoomUiText(language, "freeLimitTitle")}</h3>
              <p>{getRoomUiText(language, "freeLimitText")}</p>
              <button type="button" disabled={rewardedBusy} onClick={() => void startHomeFreeRewardedAd()}>
                {getRoomUiText(language, "freeRewardButton")}
              </button>
            </section>
          )}

          <button className={styles.createButton} onClick={createRoom} disabled={creating || freeQuotaExhausted}>
            <svg viewBox="0 0 32 32" aria-hidden="true"><circle cx="11" cy="10" r="5"/><path d="M2 27c0-6 3-9 9-9s9 3 9 9M24 13v12M18 19h12"/></svg>
            {creating ? h("creating") : h("createRoom")}
          </button>
        </section>

        <button type="button" className={styles.optionsButton} onClick={() => setShowOtherModes((value) => !value)}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 3h5l.8 3a8 8 0 0 1 2 1.2l3-.9 2.5 4.4-2.2 2.1v2.4l2.2 2.1-2.5 4.4-3-.9a8 8 0 0 1-2 1.2l-.8 3h-5l-.8-3a8 8 0 0 1-2-1.2l-3 .9-2.5-4.4 2.2-2.1v-2.4L1.2 10.7l2.5-4.4 3 .9a8 8 0 0 1 2-1.2l.8-3Z"/><circle cx="12" cy="14" r="3"/></svg>
          <span>{showOtherModes ? h("hideOtherModes") : h("showOtherModes")}</span>
          <span className={`${styles.arrow} ${showOtherModes ? styles.arrowOpen : ""}`}>⌄</span>
        </button>

        {showOtherModes && (
          <section className={styles.purchaseOptions}>
            <article><h3>Premium{premiumPrice ? ` – ${premiumPrice}` : ""}</h3><p>{h("premiumDescription")}</p>
              <button type="button" disabled={tier === "premium" || tier === "super_premium" || purchaseBusy !== null} onClick={() => void startPlayPurchase("premium")}>
                {tier === "premium" ? h("active") : tier === "super_premium" ? h("includedInSuperPremium") : h("buyPremium")}
              </button>
            </article>
            <article><h3>Super Premium{superPremiumPrice ? ` – ${superPremiumPrice}` : ""}</h3><p>{h("superPremiumPurchaseDescription")}</p><p>{h("superPremiumCategories")}</p>
              <button type="button" disabled={tier === "super_premium" || purchaseBusy !== null} onClick={() => void startPlayPurchase("super_premium")}>
                {tier === "super_premium" ? h("active") : tier === "premium" ? superPremiumUpgradePrice ? `${h("upgradeToSuperPremiumFor")} ${superPremiumUpgradePrice}` : h("upgradeToSuperPremium") : h("buySuperPremium")}
              </button>
            </article>
          </section>
        )}

        <button type="button" className={styles.likeButton} onClick={() => window.alert(h("ratingUnavailable"))}>
          <span>{h("likeApp")}</span><span className={styles.heart}>♥</span>
        </button>

        <details
          className={styles.roomCode}
          onToggle={(event) => {
            if (event.currentTarget.open) {
              window.requestAnimationFrame(() => {
                event.currentTarget.scrollIntoView({
                  behavior: "smooth",
                  block: "end",
                });
              });
            }
          }}
        >
          <summary><span>{h("haveRoomCode")}</span><svg viewBox="0 0 24 28" aria-hidden="true"><rect x="4" y="11" width="16" height="14" rx="2"/><path d="M7 11V8a5 5 0 0 1 10 0v3"/><circle cx="12" cy="17" r="1.5"/><path d="M12 18v3"/></svg></summary>
          <div className={styles.roomCodeForm}>
            <input placeholder={h("roomCode")} value={roomCodeInput} onChange={(e) => setRoomCodeInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") joinRoomByCode(); }} />
            <button onClick={joinRoomByCode}>{h("join")}</button>
          </div>
        </details>

        {status && <p className={styles.status} role="status">{status}</p>}
        <p className={styles.privacy}><a href="/privacy">{h("privacyPolicy")}</a></p>
      </div>
    </main>
  );
}
