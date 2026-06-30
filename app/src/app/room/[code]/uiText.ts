type RoomTier = "free" | "premium" | "super_premium";
type GameLanguage = "cs" | "en" | "es";

export const UI_TEXT = {
  cs: {
    room: "Místnost",
    signedIn: "Přihlášen",
    notSignedIn: "Nepřihlášen",
    bossRoom: "Ty platíš, ty jsi šéf této místnosti!",
    likeApp: "Líbí se vám aplikace?",
    ratingUnavailable: "Hodnocení bude dostupné po vydání aplikace na Google Play.",
    newGame: "Nová hra",
    rules: "Pravidla",
    copyLink: "Kopírovat odkaz",
    share: "Sdílet",
    disconnect: "Odpojit",
    gameLanguage: "Jazyk hry",
    joinGame: "Připojit se do hry",
    yourName: "Tvoje jméno",
    join: "Připojit se",
    startGame: "Spustit hru",
    availableLetters: "Výběr písmen",
    players: "Hráči",
    waitingPlayers: "Čekající hráči",
    roomCategories: "Kategorie místnosti",
    basicCategories: "Základní kategorie",
    extendedCategories: "Rozšířené kategorie",
    customCategories: "Vlastní kategorie",
    categoryOrder: "Pořadí kategorií",
    playing: "Hrajeme",
    drawAgain: "Losovat znovu",
    scoring: "Bodování",
    submitted: "Odesláno",
    playersAnswers: "Odpovědi hráčů",
    player: "Hráč",
    totalPoints: "Body celkem",
    round: "Kolo",
    myScoring: "Moje bodování",
    submitScoring: "Odeslat bodování",
    newRound: "Nové kolo",
    letterDrawn: "✅ vylosováno",
    drawingAgain: "… losujeme znovu",
    drawingNextRound: "… losujeme další kolo",
    drawingLetter: "… losujeme",
    changePlayerAfterScoring: "Hráče můžeš změnit až po ukončení bodování.",
    changingPlayerErrorPrefix: "❌ změna hráče",
    previousPlayerRemoved: "ℹ️ Původní hráč byl z tohoto zařízení odebrán. Zadej jiné jméno.",
    disconnectedRoomCleared: "✅ odpojeno, místnost vyčištěna",
    disconnected: "✅ odpojeno",
    joinNameFirst: "❗ nejdřív se připoj jménem",
    savingScoresErrorPrefix: "❌ uložení bodů",
    stopAfterFields: "STOP půjde zmáčknout až po vyplnění všech polí.",
    minTwoChars: "Každé pole musí mít alespoň dvě písmena.",
    mustStartWithLetter: "Každé pole musí začínat vylosovaným písmenem.",
    waitingToJoin: "⏳ Čekáš na připojení. Do hry tě pustíme od dalšího kola.",
    enterNameAnswers: "Přihlaš se jménem nahoře, abys mohl psát odpovědi.",
    statusSubmitted: " – odeslal",
    statusWaiting: " – čekáme",
    hideRoundHistory: "Skrýt historii kol",
    showRoundHistory: "Zobrazit historii kol",
    noRoundScores: "Zatím nejsou uložené body za žádné kolo.",
    zeroPoints: "0 bodů",
    fivePoints: "5 bodů",
    tenPoints: "10 bodů",
    minusFivePoints: "-5 bodů",
    minusTenPoints: "-10 bodů",
    scoringSubmitted: "✅ Bodování odesláno. Případní čekající hráči se automaticky připojí po stisknutí tlačítka Nové kolo.",
    enterNameScoring: "Přihlaš se jménem nahoře, abys mohl odeslat bodování.",
    waitingForAllPlayers: "Čekáme na všechny hráče…",
    customCategoryPrefix: "Vlastní kategorie",
    removeCustomCategory: "Odebrat vlastní kategorii",
    addCustomCategory: "+ Přidat vlastní kategorii",
    maxCustomCategories: "Maximum je 5 vlastních kategorií.",
    extendedCategoryPrice: "25 Kč",
    changePlayerOnDevice: "Změnit hráče na tomto zařízení",
    testPremiumUnlockedMessage: "🧪 TEST: Premium se chová, jako by byla koupena 1 rozšířená kategorie. Volba kategorií a pořadí je odemčená.",
    testPremiumUnlockButton: "🧪 TEST: simulovat nákup 1 rozšířené kategorie",
    testActiveCategoryOrder: "TEST aktivní: můžeš měnit počet kategorií a jejich pořadí.",
    waitingPlayerNextRound: "připojí se od dalšího kola",
  },
  en: {
    room: "Room",
    signedIn: "Signed in",
    notSignedIn: "Not signed in",
    bossRoom: "You paid, so you are the boss of this room!",
    likeApp: "Do you like the app?",
    ratingUnavailable: "Rating will be available after the app is released on Google Play.",
    newGame: "New game",
    rules: "Rules",
    copyLink: "Copy link",
    share: "Share",
    disconnect: "Disconnect",
    gameLanguage: "Game language",
    joinGame: "Join the game",
    yourName: "Your name",
    join: "Join",
    startGame: "Start game",
    availableLetters: "Available letters",
    players: "Players",
    waitingPlayers: "Waiting players",
    roomCategories: "Room categories",
    basicCategories: "Basic categories",
    extendedCategories: "Extended categories",
    customCategories: "Custom categories",
    categoryOrder: "Category order",
    playing: "Playing",
    drawAgain: "Draw again",
    scoring: "Scoring",
    submitted: "Submitted",
    playersAnswers: "Players’ answers",
    player: "Player",
    totalPoints: "Total points",
    round: "Round",
    myScoring: "My scoring",
    submitScoring: "Submit scoring",
    newRound: "New round",
    letterDrawn: "✅ letter drawn",
    drawingAgain: "… drawing again",
    drawingNextRound: "… drawing a letter for the next round",
    drawingLetter: "… drawing a letter",
    changePlayerAfterScoring: "You can change the player only after scoring has finished.",
    changingPlayerErrorPrefix: "❌ changing player",
    previousPlayerRemoved: "ℹ️ The previous player was removed from this device. Enter a different name.",
    disconnectedRoomCleared: "✅ disconnected, room cleared",
    disconnected: "✅ disconnected",
    joinNameFirst: "❗ join with a name first",
    savingScoresErrorPrefix: "❌ saving scores",
    stopAfterFields: "You can press STOP after completing every field.",
    minTwoChars: "Every field must contain at least two characters.",
    mustStartWithLetter: "Every answer must begin with the drawn letter.",
    waitingToJoin: "⏳ You are waiting to join. You will enter the game from the next round.",
    enterNameAnswers: "Enter your name above to submit answers.",
    statusSubmitted: " – submitted",
    statusWaiting: " – waiting",
    hideRoundHistory: "Hide round history",
    showRoundHistory: "Show round history",
    noRoundScores: "No round scores have been saved yet.",
    zeroPoints: "0 points",
    fivePoints: "5 points",
    tenPoints: "10 points",
    minusFivePoints: "-5 points",
    minusTenPoints: "-10 points",
    scoringSubmitted: "✅ Scoring submitted. Waiting players will automatically join after pressing New round.",
    enterNameScoring: "Enter your name above to submit scoring.",
    waitingForAllPlayers: "Waiting for all players…",
    customCategoryPrefix: "Custom category",
    removeCustomCategory: "Remove custom category",
    addCustomCategory: "+ Add custom category",
    maxCustomCategories: "The maximum is 5 custom categories.",
    extendedCategoryPrice: "US$0.99",
    changePlayerOnDevice: "Change player on this device",
    testPremiumUnlockedMessage: "🧪 TEST: Premium now behaves as if one extended category had been purchased. Category selection and ordering are unlocked.",
    testPremiumUnlockButton: "🧪 TEST: simulate purchasing one extended category",
    testActiveCategoryOrder: "TEST active: you can change the number and order of categories.",
    waitingPlayerNextRound: "will join from the next round",
  },
  es: {
    room: "Sala",
    signedIn: "Conectado",
    notSignedIn: "No conectado",
    bossRoom: "¡Tú pagas, tú mandas en esta sala!",
    likeApp: "¿Te gusta la aplicación?",
    ratingUnavailable: "La valoración estará disponible después de publicar la aplicación en Google Play.",
    newGame: "Nueva partida",
    rules: "Reglas",
    copyLink: "Copiar enlace",
    share: "Compartir",
    disconnect: "Desconectar",
    gameLanguage: "Idioma del juego",
    joinGame: "Unirse al juego",
    yourName: "Tu nombre",
    join: "Unirse",
    startGame: "Iniciar partida",
    availableLetters: "Letras disponibles",
    players: "Jugadores",
    waitingPlayers: "Jugadores en espera",
    roomCategories: "Categorías de la sala",
    basicCategories: "Categorías básicas",
    extendedCategories: "Categorías ampliadas",
    customCategories: "Categorías propias",
    categoryOrder: "Orden de categorías",
    playing: "Jugando",
    drawAgain: "Sortear otra vez",
    scoring: "Puntuación",
    submitted: "Enviado",
    playersAnswers: "Respuestas de los jugadores",
    player: "Jugador",
    totalPoints: "Puntos totales",
    round: "Ronda",
    myScoring: "Mi puntuación",
    submitScoring: "Enviar puntuación",
    newRound: "Nueva ronda",
    letterDrawn: "✅ letra sorteada",
    drawingAgain: "… sorteando de nuevo",
    drawingNextRound: "… sorteando una letra para la siguiente ronda",
    drawingLetter: "… sorteando una letra",
    changePlayerAfterScoring: "Puedes cambiar de jugador solo después de terminar la puntuación.",
    changingPlayerErrorPrefix: "❌ cambio de jugador",
    previousPlayerRemoved: "ℹ️ El jugador anterior se eliminó de este dispositivo. Introduce otro nombre.",
    disconnectedRoomCleared: "✅ desconectado, sala limpiada",
    disconnected: "✅ desconectado",
    joinNameFirst: "❗ primero únete con tu nombre",
    savingScoresErrorPrefix: "❌ guardando puntos",
    stopAfterFields: "Puedes pulsar STOP después de completar todos los campos.",
    minTwoChars: "Cada campo debe tener al menos dos caracteres.",
    mustStartWithLetter: "Cada respuesta debe empezar con la letra sorteada.",
    waitingToJoin: "⏳ Estás esperando para unirte. Entrarás en el juego desde la siguiente ronda.",
    enterNameAnswers: "Introduce tu nombre arriba para enviar respuestas.",
    statusSubmitted: " – enviado",
    statusWaiting: " – esperando",
    hideRoundHistory: "Ocultar historial de rondas",
    showRoundHistory: "Mostrar historial de rondas",
    noRoundScores: "Todavía no hay puntos guardados de ninguna ronda.",
    zeroPoints: "0 puntos",
    fivePoints: "5 puntos",
    tenPoints: "10 puntos",
    minusFivePoints: "-5 puntos",
    minusTenPoints: "-10 puntos",
    scoringSubmitted: "✅ Puntuación enviada. Los jugadores en espera se unirán automáticamente después de pulsar Nueva ronda.",
    enterNameScoring: "Introduce tu nombre arriba para enviar la puntuación.",
    waitingForAllPlayers: "Esperando a todos los jugadores…",
    customCategoryPrefix: "Categoría propia",
    removeCustomCategory: "Eliminar categoría propia",
    addCustomCategory: "+ Añadir categoría propia",
    maxCustomCategories: "El máximo es de 5 categorías propias.",
    extendedCategoryPrice: "0,99 US$",
    changePlayerOnDevice: "Cambiar jugador en este dispositivo",
    testPremiumUnlockedMessage: "🧪 TEST: Premium se comporta como si se hubiera comprado 1 categoría ampliada. La selección y el orden de categorías están desbloqueados.",
    testPremiumUnlockButton: "🧪 TEST: simular compra de 1 categoría ampliada",
    testActiveCategoryOrder: "TEST activo: puedes cambiar el número y el orden de categorías.",
    waitingPlayerNextRound: "se unirá desde la siguiente ronda",
  },
} as const;

export type UiTextKey = keyof typeof UI_TEXT.cs;

const TEXTS = UI_TEXT as unknown as Record<string, Record<UiTextKey, string>>;

export function getUiText(language: string, key: UiTextKey) {
  return TEXTS[language]?.[key] ?? UI_TEXT.cs[key];
}

export const UI_RULES = {
  cs: {
    join: "Organizátor sdílí odkaz místnosti pomocí tlačítek Kopírovat odkaz nebo Sdílet. Ostatní hráči odkaz otevřou, zadají své jméno a připojí se do stejné místnosti.",
    play: "Hráči společně hrají na vylosované písmeno. Každý vyplní odpovědi do kategorií. Po vyplnění všech polí může hráč zmáčknout STOP. Každá odpověď musí začínat vylosovaným písmenem a mít alespoň dvě písmena.",
    scoringTitle: "Bodování",
    scoring: "Po STOPu všichni vidí odpovědi ostatních a bodují každou odpověď. 10 bodů za unikátní odpověď, 5 bodů za shodnou odpověď, 0 bodů za prázdnou nebo špatnou odpověď. Lze použít i záporné body.",
  },
  en: {
    join: "The organiser shares the room link using the Copy link or Share button. Other players open the link, enter their name and join the same room.",
    play: "Everyone plays using the drawn letter and enters one answer for each category. Once all fields are completed, a player can press STOP. Every answer must begin with the drawn letter and contain at least two characters.",
    scoringTitle: "Scoring",
    scoring: "After STOP is pressed, everyone can see the other players’ answers and score each answer. 10 points for a unique answer, 5 points for a repeated answer, 0 points for an empty or invalid answer. Negative points can also be used.",
  },
  es: {
    join: "El organizador comparte el enlace de la sala usando Copiar enlace o Compartir. Los demás jugadores abren el enlace, introducen su nombre y se unen a la misma sala.",
    play: "Todos juegan con la letra sorteada y escriben una respuesta para cada categoría. Cuando todos los campos están completos, un jugador puede pulsar STOP. Cada respuesta debe empezar con la letra sorteada y tener al menos dos caracteres.",
    scoringTitle: "Puntuación",
    scoring: "Después de pulsar STOP, todos ven las respuestas de los demás y puntúan cada respuesta. 10 puntos por una respuesta única, 5 puntos por una respuesta repetida, 0 puntos por una respuesta vacía o incorrecta. También se pueden usar puntos negativos.",
  },
} as const;

const RULES = UI_RULES as unknown as Record<string, typeof UI_RULES.cs>;

export function getUiRules(language: string) {
  return RULES[language] ?? UI_RULES.cs;
}

export function roomFullMessage(language: string, maxPlayers: number) {
  if (language === "en") {
    return `❌ This room is full. The Free version allows up to ${maxPlayers} players. Upgrade to Premium for more players. More players, more fun! :-)`;
  }

  if (language === "es") {
    return `❌ La sala está llena. La versión Free permite hasta ${maxPlayers} jugadores. Compra Premium para más jugadores. Más jugadores, más diversión. :-)`;
  }

  return `❌ Místnost je plná. Free verze umožňuje max. ${maxPlayers} hráče. Pro více hráčů si kup Premium. Víc hráčů, větší zábava! :-)`;
}

export function stopPressedMessage(language: string, name: string) {
  if (language === "en") return `✅ STOP pressed by ${name}`;
  if (language === "es") return `✅ ${name} pulsó STOP`;
  return `✅ STOP stiskl ${name}`;
}

export function gameLanguageNameText(uiLanguage: string, roomLanguage: GameLanguage) {
  if (roomLanguage === "en") {
    if (uiLanguage === "en") return "English";
    if (uiLanguage === "es") return "Inglés";
    return "Angličtina";
  }

  if (roomLanguage === "es") {
    if (uiLanguage === "en") return "Spanish";
    if (uiLanguage === "es") return "Español";
    return "Španělština";
  }

  if (uiLanguage === "en") return "Czech";
  if (uiLanguage === "es") return "Checo";
  return "Čeština";
}

export function gameLanguageInstructionText(uiLanguage: string, roomLanguage: GameLanguage) {
  if (roomLanguage === "en") {
    if (uiLanguage === "en") return "Write all answers in English.";
    if (uiLanguage === "es") return "Escribe todas las respuestas en inglés.";
    return "Všechny odpovědi piš anglicky.";
  }

  if (roomLanguage === "es") {
    if (uiLanguage === "en") return "Write all answers in Spanish.";
    if (uiLanguage === "es") return "Escribe todas las respuestas en español.";
    return "Všechny odpovědi piš španělsky.";
  }

  if (uiLanguage === "en") return "Write all answers in Czech.";
  if (uiLanguage === "es") return "Escribe todas las respuestas en checo.";
  return "Všechny odpovědi piš česky.";
}

export function categoryHelpText(language: string, isOrganizer: boolean, roomTier: RoomTier) {
  if (language === "en") {
    if (!isOrganizer) return "The organiser chooses the room categories. You can see the current selection and suggest changes.";
    if (roomTier === "premium") return "Premium: the basic categories are fixed. Extended categories are locked. Buying at least one extended category unlocks category selection and ordering.";
    return "Super Premium: choose basic and extended categories, change their order and add custom categories.";
  }

  if (language === "es") {
    if (!isOrganizer) return "El organizador elige las categorías de la sala. Tú ves la selección actual y puedes sugerir cambios.";
    if (roomTier === "premium") return "Premium: las categorías básicas son fijas. Las categorías ampliadas están bloqueadas. Al comprar al menos una categoría ampliada se desbloquea la selección y el orden de categorías.";
    return "Super Premium: elige categorías básicas y ampliadas, cambia su orden y añade categorías propias.";
  }

  if (!isOrganizer) return "Kategorie vybírá organizátor místnosti. Ty vidíš aktuální výběr a můžeš mu radit, co upravit.";
  if (roomTier === "premium") return "Premium: základní kategorie jsou pevně dané. Rozšířené kategorie jsou zamčené. Po dokoupení alespoň jedné rozšířené kategorie se odemkne volba počtu kategorií a jejich pořadí.";
  return "Super Premium: vyber základní i rozšířené kategorie. Můžeš měnit pořadí a používat vlastní kategorie.";
}
