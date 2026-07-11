export default function PrivacyPolicyPage() {
  return (
    <main
      style={{
        padding: 24,
        fontFamily: "system-ui",
        maxWidth: 760,
        margin: "0 auto",
        lineHeight: 1.55,
      }}
    >
      <h1>Zásady ochrany soukromí / Privacy Policy</h1>

      <p>
        <b>Platí od / Effective date:</b> 11. 7. 2026
      </p>

      <p>
        Tato zásada popisuje, jak aplikace <b>Země Město</b> zpracovává údaje
        při používání hry. / This policy explains how the <b>Země Město</b> app
        handles data when you use the game.
      </p>

      <h2>Provozovatel / App operator</h2>
      <p>
        Miroslav Randáček
        <br />
        Kontakt / Contact:{" "}
        <a href="mailto:mirek.randacek@gmail.com">mirek.randacek@gmail.com</a>
      </p>

      <h2>Jaké údaje aplikace zpracovává / Data processed by the app</h2>
      <p>
        Aplikace nevyžaduje vytvoření uživatelského účtu. Při hře ale může
        zpracovávat údaje, které hráči sami zadají:
      </p>

      <ul>
        <li>jméno nebo přezdívku hráče,</li>
        <li>kód místnosti a nastavení hry,</li>
        <li>odpovědi zadané ve hře,</li>
        <li>bodování a průběh hry,</li>
        <li>zvolený jazyk aplikace a jazyk hry.</li>
      </ul>

      <p>
        The app does not require a user account. During gameplay, it may process
        data entered by players, such as player names or nicknames, room code,
        game settings, answers, scores and selected language.
      </p>

      <h2>Účel zpracování / Purpose</h2>
      <p>
        Údaje se používají pouze k vytvoření a provozu herní místnosti,
        synchronizaci hry mezi hráči, zobrazení odpovědí a výpočtu bodů.
      </p>

      <p>
        The data is used only to create and run a game room, sync gameplay
        between players, display answers and calculate scores.
      </p>

      <h2>Ukládání a služby třetích stran / Storage and third-party services</h2>
      <p>
        Herní data jsou ukládána v databázi Supabase, aby mohli hráči hrát
        společně v reálném čase. Aplikace může používat Google AdMob pro
        zobrazování reklam ve Free verzi.
      </p>

      <p>
        Game data is stored in Supabase to enable real-time multiplayer gameplay.
        The app may use Google AdMob to display ads in the Free version.
      </p>

      <p>
        Reklamní služby mohou zpracovávat technické údaje o zařízení a reklamní
        identifikátory podle svých vlastních zásad. / Advertising services may
        process device information and advertising identifiers according to
        their own policies.
      </p>

      <ul>
        <li>
          <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
            Google Privacy Policy
          </a>
        </li>
        <li>
          <a href="https://supabase.com/privacy" target="_blank" rel="noreferrer">
            Supabase Privacy Policy
          </a>
        </li>
      </ul>

      <h2>Lokální uložení v zařízení / Local storage</h2>
      <p>
        Aplikace může ukládat některé volby přímo v zařízení, například jazyk
        aplikace nebo poslední nastavení. Tyto údaje slouží pouze pro pohodlnější
        používání aplikace.
      </p>

      <p>
        The app may store some preferences on the device, such as language
        settings. This is used only to improve the user experience.
      </p>

      <h2>Sdílení údajů / Data sharing</h2>
      <p>
        Údaje nejsou prodávány. Údaje mohou být zpracovávány poskytovateli
        služeb potřebných pro běh aplikace, zejména Supabase a Google AdMob.
      </p>

      <p>
        Data is not sold. Data may be processed by service providers needed to
        operate the app, mainly Supabase and Google AdMob.
      </p>

      <h2>Děti / Children</h2>
      <p>
        Aplikace není určena pro děti mladší 13 let. / The app is not directed
        to children under 13.
      </p>

      <h2>Smazání údajů / Data deletion</h2>
      <p>
        Pokud chceš požádat o smazání údajů souvisejících s herní místností,
        kontaktuj nás e-mailem a uveď kód místnosti, pokud ho znáš.
      </p>

      <p>
        To request deletion of data related to a game room, contact us by email
        and include the room code if you know it.
      </p>

      <h2>Změny zásad / Changes</h2>
      <p>
        Tyto zásady můžeme aktualizovat. Nová verze bude zveřejněna na této
        stránce. / We may update this policy. The latest version will be posted
        on this page.
      </p>

      <p>
        <a href="/">Zpět na hlavní stránku / Back to home</a>
      </p>
    </main>
  );
}
