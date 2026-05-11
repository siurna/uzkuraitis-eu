// ─────────────────────────────────────────────────────────────────────
// ALL user-facing copy lives here, one entry per string, EN + LT side
// by side: `key: { en: "…", lt: "…" }`. Editing a translation pair is a
// single location — no scrolling between two big blocks.
//
// Function-valued entries (e.g. `pick_n_more`) take args and return a
// string; `t()` forwards the args. Use `{placeholder}` + `fmt()` for
// substitution inside a static string.
//
// Admin pages stay English on purpose — the admin is one or two power
// users and not worth the maintenance overhead. Everything voter-facing
// goes through `t(lang, key, …)` and switches the moment the user picks
// a language.
// ─────────────────────────────────────────────────────────────────────

export type Language = "en" | "lt";

// LT first — this is a Lithuanian Eurovision party app first; EN is for
// the international guest. The picker should reflect that order.
export const LANGUAGES: Language[] = ["lt", "en"];

// Display name for each language, in its own language, so the picker
// reads naturally regardless of the current mode.
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "In English",
  lt: "Lietuviškai",
};

export const LANG_STORAGE_KEY = "uzk_lang";

// A string, or a function that builds one from args.
type Phrase = string | ((...a: never[]) => string);

const S = {
  // ── NameGate / SettingsModal ─────────────────────────────────────
  welcome:           { en: "Welcome", lt: "Labas!" },
  name_prompt:       { en: "What should we call you in this room?", lt: "Kaip tave vadinsim šitame kambary?" },
  your_name:         { en: "Your name", lt: "Tavo vardas" },
  join_party:        { en: "Join the party", lt: "Prisijungti" },
  pick_avatar:       { en: "Pick an avatar", lt: "Pasirink veidą" },
  settings:          { en: "Settings", lt: "Nustatymai" },
  language:          { en: "Language", lt: "Kalba" },
  share_link:        { en: "Share room link", lt: "Pasidalink kambariu" },
  save:              { en: "Save", lt: "Išsaugoti" },
  cancel:            { en: "Cancel", lt: "Atšaukti" },
  clear:             { en: "Clear", lt: "Išvalyti" },
  next:              { en: "Next", lt: "Toliau" },
  back:              { en: "Back", lt: "Atgal" },
  done:              { en: "Done", lt: "Gerai" },
  close:             { en: "Close", lt: "Uždaryti" },
  loading:           { en: "Loading…", lt: "Įkeliama…" },
  leave_room:        { en: "Leave room", lt: "Palikti kambarį" },
  leave_confirm:     { en: "Leave this room?", lt: "Tikrai palikti šitą kambarį?" },
  leave_yes:         { en: "Yes, leave", lt: "Taip, palikti" },
  link_copied:       { en: "Link copied", lt: "Nuoroda nukopijuota" },
  couldnt_copy:      { en: "Couldn't copy link", lt: "Nepavyko nukopijuoti" },

  // ── RoomGate (entrance code screen) ──────────────────────────────
  enter_room_code:   { en: "Enter room code", lt: "Įvesk kambario kodą" },
  enter_room:        { en: "Enter room", lt: "Įeiti" },
  checking:          { en: "Checking…", lt: "Tikrinama…" },
  bad_code:          { en: "No room with that code.", lt: "Nėra kambario tokiu kodu." },
  bad_format:        { en: "Codes are 6 characters (A–Z, 2–9).", lt: "Kodas — 6 simboliai (A–Z, 2–9)." },
  reconnecting:      { en: "Reconnecting…", lt: "Jungiamasi…" },

  // ── Standings ────────────────────────────────────────────────────
  no_votes_yet:      { en: "Standings are quiet", lt: "Lentelė tuščia" },
  no_votes_sub:      { en: "No one has voted yet. Be the first and the leaderboard fills up live as everyone joins in.", lt: "Niekas dar nebalsavo. Bakstelėk žemiau ir lentelė užsipildys realiu laiku, kai prisijungs kiti." },
  be_the_first:      { en: "Be the first", lt: "Būk pirmas" },
  show_top_5:        { en: "Top 5 only", lt: "Tik TOP 5" },
  show_all:          { en: "Show all", lt: "Visi" },
  votes_cast:        { en: "Votes cast", lt: "Balsai" },
  pts_short:         { en: "pts", lt: "tšk" },
  standings:         { en: "Standings", lt: "Rezultatai" },
  live:              { en: "Live", lt: "Tiesiogiai" },

  // ── Voting open/closed states + the on-air banners ───────────────
  cast_vote:         { en: "Cast your vote", lt: "Balsuok" },
  update_vote:       { en: "Update your vote", lt: "Pakeisk balsą" },
  voting_closed:     { en: "Voting is closed", lt: "Balsavimas uždarytas" },
  voting_closed_sub: { en: "The host hasn't opened voting yet. The standings page is still live.", lt: "Šeimininkas dar neatidarė balsavimo. Rezultatų lentelė vis tiek gyva." },
  voting_closed_live: { en: "Voting locked — the show's on", lt: "Balsavimas užrakintas — vyksta šou" },
  voting_closed_ended: { en: "Voting's over", lt: "Balsavimas baigtas" },
  voting_closed_ended_sub: { en: "All ballots are in. Check the leaderboard to see how you did.", lt: "Visi balsai suskaičiuoti. Peržiūrėk lyderių lentelę." },
  vote_open_now:     { en: "Europe, start voting now!", lt: "Europa, balsuok dabar!" },
  vote_open_now_sub: { en: "Lines are open — lock in your TOP 10.", lt: "Linijos atviros — užfiksuok savo TOP 10." },
  vote_closing:      { en: "Stop voting now!", lt: "Baik balsuoti — dabar!" },
  vote_closing_sub:  { en: "Lines are closing — last chance!", lt: "Linijos užsidaro — paskutinė proga!" },
  vote_closed_flash: { en: "Voting closed", lt: "Balsavimas uždarytas" },

  // ── VoteForm ─────────────────────────────────────────────────────
  cast_your_vote:    { en: "Cast your vote", lt: "Balsavimas" },
  your_top_10:       { en: "Your TOP10", lt: "Tavo TOP10" },
  tap_to_pick:       { en: "Tap to pick", lt: "Bakstelėk pasirinkti" },
  drag_hint:         { en: "Tap a slot to pick, drag to reorder.", lt: "Bakstelėk vietą pasirinkti, vilk perstumti." },
  submit_12:         { en: "Submit my 12 points", lt: "Pateikti mano 12 taškų" },
  pick_n_more:       { en: (n: number) => `Pick ${n} more`, lt: (n: number) => `Dar ${n}` },
  submitting:        { en: "Submitting…", lt: "Siunčiama…" },
  fill_n_more:       { en: (n: number) => `Fill all 10 slots, ${n} to go.`, lt: (n: number) => `Užpildyk 10 vietų, dar ${n}.` },
  add_name_first:    { en: "Add your name first.", lt: "Pirma įvesk vardą." },
  voted_toast:       { en: "Vote in. Long live music!", lt: "Balsas užfiksuotas. Tegyvuoja muzika!" },
  couldnt_submit:    { en: "Couldn't submit vote.", lt: "Nepavyko išsiųsti balso." },
  tab_ballot:        { en: "Ballot", lt: "Balsas" },
  tab_bets:          { en: "Bets", lt: "Statymai" },
  tab_rules:         { en: "Rules", lt: "Taisyklės" },
  bonus_bets:        { en: "Bonus bets", lt: "Bonus statymai" },
  bets_skip_hint:    { en: "Every bet is optional — skipped = 0 points. See the Rules tab for how each one scores.", lt: "Kiekvienas statymas neprivalomas — praleistas = 0 taškų. Kaip jie skaičiuojami — Taisyklių skiltyje." },
  vote_cast_title:   { en: "Your vote's cast! 🎉", lt: "Tavo balsas užfiksuotas! 🎉" },
  vote_cast_body:    { en: "Locked in automatically. Reorder any time — just tap Save to update.", lt: "Užfiksuota automatiškai. Pertvarkyk bet kada — tiesiog spausk Išsaugoti." },
  vote_place_bets:   { en: "Place your bets", lt: "Statyk lažybas" },
  vote_keep_editing: { en: "Keep editing", lt: "Tęsti redagavimą" },
  vote_updated_toast: { en: "Vote updated.", lt: "Balsas atnaujintas." },
  vote_unsaved:      { en: "Unsaved reorder — tap Save to update your vote.", lt: "Neišsaugotas pertvarkymas — spausk Išsaugoti." },
  save_changes:      { en: "Save changes", lt: "Išsaugoti pakeitimus" },

  // ── Rules tab (scoring explainer) ────────────────────────────────
  rules_title:       { en: "How scoring works", lt: "Kaip skaičiuojami taškai" },
  rules_top10_h:     { en: "Your TOP 10", lt: "Tavo TOP 10" },
  rules_top10_b:     { en: "Score the full Eurovision points (12, 10, 8…1) for every country you placed in the exact spot it finished. Off by a place or more? You get half of that slot's value, rounded down.", lt: "Už kiekvieną šalį, pastatytą tiksliai į jos užimtą vietą, gauni pilnus Eurovizijos taškus (12, 10, 8…1). Jei pataikei ne į tą vietą — gauni pusę tos eilutės vertės, suapvalintą žemyn." },
  rules_home_h:      { en: "Home-country placement", lt: "Savo šalies vieta" },
  rules_home_b:      { en: "Guess where your home country finishes: exact = 10 pts, off by 1 = 7, by 2 = 5, by 3–5 = 3, by 6–10 = 1, beyond that = 0.", lt: "Atspėk, kelintas liks tavo šalis: tiksliai = 10 t., klysti 1 vieta = 7, 2 = 5, 3–5 = 3, 6–10 = 1, daugiau = 0." },
  rules_bets_h:      { en: "Bonus bets", lt: "Bonus statymai" },
  rules_bets_b:      { en: "Each side bet is optional and pays out only if you nailed it: jury / televote winner +5, wooden spoon +5 (or +2 if your pick lands bottom-3), 12 from your country +5, best of the Big 5 +3, zero-from-televote +4 per correct pick (max 12), host top-3 +3, solo winner +2, plus a closeness-scored guess for your country's total points (up to +10). Skipped bets = 0.", lt: "Kiekvienas statymas neprivalomas ir užskaitomas tik pataikius: žiuri / žiūrovų nugalėtojas +5, paskutinė vieta +5 (arba +2, jei pasirinkimas patenka į paskutinius 3), 12 iš tavo šalies +5, geriausias iš Big 5 +3, nulis iš žiūrovų +4 už kiekvieną teisingą (maks. 12), šeimininkai TOP3 +3, solo nugalėtojas +2, plius artumo statymas dėl tavo šalies bendros taškų sumos (iki +10). Praleisti statymai = 0." },
  rules_footer:      { en: "Leaderboard updates the moment the host enters the official results.", lt: "Lyderių lentelė atsinaujina, kai šeimininkas suveda oficialius rezultatus." },

  // ── Room tab bar ─────────────────────────────────────────────────
  tab_home:          { en: "Home", lt: "Pradžia" },
  tab_chat:          { en: "Chat", lt: "Pokalbiai" },
  tab_bingo:         { en: "Bingo", lt: "Bingo" },
  tab_vote:          { en: "Vote", lt: "Balsuok" },

  // ── Chat ─────────────────────────────────────────────────────────
  chat_empty:        { en: "No messages yet. Say hi 👋", lt: "Dar nieks nieko nerašė. Sveikink pirmas 👋" },
  chat_placeholder:  { en: "Message the room…", lt: "Rašyk kambariui…" },
  chat_load_earlier: { en: "Load earlier messages", lt: "Įkelti senesnes žinutes" },
  chat_send:         { en: "Send", lt: "Siųsti" },
  chat_send_failed:  { en: "Couldn't send your message.", lt: "Nepavyko išsiųsti žinutės." },
  chat_slow_down:    { en: "Whoa — slow down a sec.", lt: "Pala — neskubėk." },
  chat_delete_failed: { en: "Couldn't delete that message.", lt: "Nepavyko ištrinti žinutės." },
  chat_today:        { en: "Today", lt: "Šiandien" },
  chat_yesterday:    { en: "Yesterday", lt: "Vakar" },
  chat_jump_bottom:  { en: "Jump to latest", lt: "Į naujausias" },
  chat_new_messages: { en: (n: number) => `${n} new message${n === 1 ? "" : "s"} ↓`, lt: (n: number) => (n === 1 ? "1 nauja žinutė ↓" : `${n} naujų žinučių ↓`) },
  chat_typing_one:   { en: (a: string) => `${a} is typing…`, lt: (a: string) => `${a} rašo…` },
  chat_typing_two:   { en: (a: string, b: string) => `${a} and ${b} are typing…`, lt: (a: string, b: string) => `${a} ir ${b} rašo…` },
  chat_typing_many:  { en: "Several people are typing…", lt: "Keli žmonės rašo…" },
  chat_seen_by:      { en: (n: number) => `Seen by ${n}`, lt: (n: number) => `Matė ${n}` },
  chat_reply:        { en: "Reply", lt: "Atsakyti" },
  chat_delete:       { en: "Delete", lt: "Ištrinti" },
  chat_card:         { en: "card", lt: "kortelė" },
  chat_edit:         { en: "Edit", lt: "Redaguoti" },
  chat_edited:       { en: "edited", lt: "redaguota" },
  chat_editing:      { en: "Editing your message", lt: "Redaguoji žinutę" },
  chat_edit_placeholder: { en: "Edit your message…", lt: "Redaguok žinutę…" },
  chat_edit_failed:  { en: "Couldn't save your edit.", lt: "Nepavyko išsaugoti pakeitimo." },
  chat_save_edit:    { en: "Save", lt: "Išsaugoti" },
  chat_copy:         { en: "Copy", lt: "Kopijuoti" },
  chat_copied:       { en: "Copied", lt: "Nukopijuota" },
  chat_send_photo:   { en: "Send a photo", lt: "Siųsti nuotrauką" },
  chat_image_too_big: { en: "Image is too large (max 8 MB).", lt: "Nuotrauka per didelė (maks. 8 MB)." },
  chat_image_failed: { en: "Couldn't upload that image.", lt: "Nepavyko įkelti nuotraukos." },
  gif_pick:          { en: "Pick a GIF", lt: "Pasirink GIF" },
  gif_search:        { en: "Search GIFs", lt: "Ieškoti GIF" },
  gif_hint:          { en: 'Try "omg", "yes", "fire"…', lt: "Bandyk „omg“, „taip“, „fire“…" },
  gif_empty:         { en: "No GIFs found.", lt: "Nieko nerasta." },

  // ── Country deep-dive ────────────────────────────────────────────
  deep_artist:       { en: "Artist", lt: "Atlikėjas" },
  deep_song:         { en: "Song", lt: "Daina" },
  deep_order:        { en: "in running order", lt: "vieta tvarkaraštyje" },
  deep_watch:        { en: "Watch the performance", lt: "Žiūrėti pasirodymą" },

  // ── End-of-show reveal ───────────────────────────────────────────
  reveal_cta:        { en: "Reveal my night", lt: "Atskleisk mano vakarą" },
  reveal_title:      { en: "Your Eurovision night", lt: "Tavo Eurovizijos vakaras" },
  reveal_done:       { en: "Done", lt: "Baigta" },
  reveal_top10:      { en: "Top 10 ballot", lt: "TOP10 balsas" },
  reveal_home:       { en: (home: string) => `${home} placement`, lt: (home: string) => `${home} vieta` },
  reveal_home_total: { en: (home: string) => `${home} total points`, lt: (home: string) => `${home} taškai iš viso` },
  reveal_wooden:     { en: "Wooden spoon", lt: "Paskutinė vieta" },
  reveal_lt12to:     { en: (home: string) => `12 from ${home}`, lt: (home: string) => `12 iš ${home}` },
  reveal_big5:       { en: "Best of the Big 5", lt: "Geriausias iš Big 5" },
  reveal_jury:       { en: "Jury winner", lt: "Žiuri nugalėtojas" },
  reveal_tele:       { en: "Televote winner", lt: "Žiūrovų nugalėtojas" },
  reveal_nul:        { en: "Zero from televote", lt: "Nulis iš žiūrovų" },
  reveal_host:       { en: "Host top 3", lt: "Šeimininkai TOP3" },
  reveal_solo:       { en: "Solo winner", lt: "Solo nugalėtojas" },
  reveal_total:      { en: "Your final score", lt: "Galutinis rezultatas" },

  // ── Social share ─────────────────────────────────────────────────
  share_picks:        { en: "Share my TOP10", lt: "Pasidalink savo TOP10" },
  share_picks_caption: { en: "Cast my Eurovision 2026 TOP10", lt: "Mano Eurovizijos 2026 TOP10" },

  // ── Now-playing strip ────────────────────────────────────────────
  now_playing:       { en: "On stage", lt: "Scenoje" },
  now_playing_idle:  { en: "Waiting for the next country…", lt: "Laukiama kitos šalies…" },
  now_playing_admin: { en: "Now playing", lt: "Dabar scenoje" },
  now_playing_clear: { en: "Off stage", lt: "Niekas" },

  // ── Bingo ────────────────────────────────────────────────────────
  bingo_title:       { en: "Eurovision bingo", lt: "Eurovizijos bingo" },
  bingo_free:        { en: "FREE", lt: "LAISVA" },
  bingo_reset:       { en: "Reset", lt: "Iš naujo" },
  bingo_won:         { en: "BINGO!", lt: "BINGO!" },
  bingo_you_did_it:  { en: "You got bingo! 🎉", lt: "Surinkai bingo! 🎉" },
  bingo_footer:      { en: "Tap a square — or its line in the list — when it happens. Five in a row wins.", lt: "Bakstelėk laukelį — arba jo eilutę sąraše — kai įvyksta. Penki iš eilės — laimi." },
  bingo_list:        { en: "What to watch for", lt: "Ko ieškoti" },
  bingo_generate:    { en: "New ticket", lt: "Nauja kortelė" },
  bingo_ticket:      { en: "Ticket", lt: "Kortelė" },
  bingo_remove_ticket: { en: "Remove this ticket", lt: "Pašalinti šią kortelę" },

  // ── Notifications ────────────────────────────────────────────────
  notifications:        { en: "Notifications", lt: "Pranešimai" },
  push_unsupported:     { en: "Push notifications aren't supported on this device.", lt: "Pranešimų ši naršyklė nepalaiko." },
  push_blocked:         { en: "Notifications are blocked.", lt: "Pranešimai užblokuoti." },
  push_install_required: { en: "Install the app to enable notifications", lt: "Įdiek aplikaciją, kad gautum pranešimus" },
  push_how:             { en: "How", lt: "Kaip?" },
  push_enable:          { en: "Turn on notifications", lt: "Įjungti pranešimus" },
  push_off:             { en: "Off", lt: "Išjungta" },
  push_on:              { en: "Notifications on", lt: "Pranešimai įjungti" },
  push_disable:         { en: "Turn off", lt: "Išjungti" },
  push_enabled:         { en: "Notifications enabled", lt: "Pranešimai įjungti" },
  push_denied:          { en: "Permission denied", lt: "Leidimas nesuteiktas" },
  push_chat_all:        { en: "All chat messages", lt: "Visos pokalbių žinutės" },
  push_chat_replies:    { en: "Replies to my messages", lt: "Atsakymai į mano žinutes" },
  push_now_playing:     { en: "Country changes on stage", lt: "Šalis pasikeitė scenoje" },
  push_voting_state:    { en: "Voting opens or closes", lt: "Balsavimas atidarytas ar uždarytas" },
  push_results_tallied: { en: "Results are tallied", lt: "Suskaičiuoti rezultatai" },
  push_cta_title:       { en: "Don't miss a beat", lt: "Niekur nepražiopsok" },
  push_cta_sub:         { en: "Get a ping when a country goes on stage, results land, or someone replies to you.", lt: "Sužinok, kai į sceną žengia šalis, paskelbiami rezultatai ar kažkas tau atrašo." },
  push_cta_enable:      { en: "Turn on", lt: "Įjungti" },

  // ── Notification install instructions ────────────────────────────
  push_help_ios_title:     { en: "On iPhone / iPad", lt: "„iPhone“ / „iPad“" },
  push_help_ios_1:         { en: "Tap the Share button in Safari (the square with an arrow).", lt: "„Safari“ paspausk dalinimosi mygtuką (kvadratas su rodyklę)." },
  push_help_ios_2:         { en: 'Scroll down and tap "Add to Home Screen".', lt: "Nuslysk žemyn ir pasirink „Add to Home Screen“ (Pridėti į pagrindinį ekraną)." },
  push_help_ios_3:         { en: "Open the app from your Home Screen — not Safari.", lt: "Atidaryk programėlę iš pagrindinio ekrano — ne iš „Safari“." },
  push_help_ios_4:         { en: "Come back here and turn on notifications.", lt: "Grįžk čia ir įjunk pranešimus." },
  push_help_android_title: { en: "On Android", lt: "„Android“" },
  push_help_android_1:     { en: "Tap the ⋮ menu in Chrome (or your browser).", lt: "„Chrome“ (ar kitoje naršyklėje) paspausk ⋮ meniu." },
  push_help_android_2:     { en: 'Choose "Install app" or "Add to Home Screen".', lt: "Pasirink „Install app“ arba „Add to Home Screen“." },
  push_help_android_3:     { en: "Open the installed app and turn on notifications here.", lt: "Atidaryk įdiegtą aplikaciją ir įjunk pranešimus." },
  push_help_desktop_title: { en: "On desktop", lt: "Kompiuteryje" },
  push_help_desktop_1:     { en: "Click the install icon in the address bar (or browser menu → Install).", lt: "Adreso juostoje paspausk įdiegimo ikoną (arba naršyklės meniu → „Install“)." },
  push_help_desktop_2:     { en: "Open the installed app and turn on notifications.", lt: "Atidaryk įdiegtą aplikaciją ir įjunk pranešimus." },
  push_help_other_title:   { en: "On this device", lt: "Šiame įrenginyje" },
  push_help_other_1:       { en: "Add this site to your home screen, then come back and try again.", lt: "Pridėk šį puslapį į pagrindinį ekraną ir bandyk dar kartą." },
  push_help_blocked_title: { en: "Allow notifications in your browser", lt: "Leisk pranešimus naršyklės nustatymuose" },
  push_help_blocked_1:     { en: "Open this site's permissions in your browser settings.", lt: "Atidaryk šios svetainės leidimus naršyklėje." },
  push_help_blocked_2:     { en: "Change Notifications from Blocked to Ask or Allow.", lt: "Pakeisk „Notifications“ iš „Blocked“ į „Ask“ arba „Allow“." },
  push_help_blocked_3:     { en: "Refresh this page and try again.", lt: "Atnaujink puslapį ir bandyk dar kartą." },

  // ── Bonus bets — labels + descriptions. `{home}` / `{host}` get
  //    substituted with fmt(). ──────────────────────────────────────
  bet_lt_placement:      { en: "{home} placement", lt: "{home} vieta" },
  bet_lt_placement_sub:  { en: "Where does {home} finish? Closer guesses score more.", lt: "Kelintoje vietoje finišuos {home}? Kuo arčiau spėjai — tuo daugiau." },
  bet_wooden_spoon:      { en: "Wooden spoon", lt: "Paskutinė vieta" },
  bet_wooden_spoon_sub:  { en: "Who comes last? Even one off the bottom scores.", lt: "Kas užims paskutinę? Net spėjus gretimą — gauni taškų." },
  bet_lt_12_to:          { en: "12 points from {home}", lt: "12 taškų iš {home}" },
  bet_lt_12_to_sub:      { en: "Which country gets {home}'s 12 points?", lt: "Kuriai šaliai {home} skirs savo 12 taškų?" },
  bet_big5:              { en: "Best of the Big 5", lt: "Geriausias iš Big 5" },
  bet_big5_sub:          { en: "UK, Germany, France, Italy or Spain — which finishes highest?", lt: "Iš JK, Vokietijos, Prancūzijos, Italijos, Ispanijos — kas finišuos aukščiausiai?" },
  bet_jury_winner:       { en: "Jury winner", lt: "Žiuri nugalėtojas" },
  bet_jury_winner_sub:   { en: "Country with the highest jury total.", lt: "Šalis, kuri surinks daugiausiai žiuri taškų." },
  bet_televote_winner:   { en: "Televote winner", lt: "Žiūrovų nugalėtojas" },
  bet_televote_winner_sub: { en: "Country with the highest public televote total.", lt: "Šalis, kuri surinks daugiausiai žiūrovų taškų." },
  bet_nul:               { en: "Zero from televote", lt: "Nulis iš žiūrovų" },
  bet_nul_sub:           { en: "Pick the countries you think get zero from the public — or 'No country' if you think no one will.", lt: "Spėk, kurios šalys gaus nulį iš žiūrovų. Jei manai, kad visos uždirbs — rink „Nė viena“." },
  bet_lt_total:          { en: "{home} total points", lt: "{home} taškai iš viso" },
  bet_lt_total_sub:      { en: "How many points (jury + public) does {home} end with? Closer guesses score more.", lt: "Kiek iš viso taškų (žiuri + žiūrovai) surinks {home}? Kuo arčiau, tuo daugiau." },
  bet_host_top3:         { en: "{host} top 3?", lt: "{host} TOP3?" },
  bet_host_top3_sub:     { en: "Will the host land in the top 3?", lt: "Ar šeimininkai pateks į TOP3?" },
  bet_solo_winner:       { en: "Solo winner?", lt: "Laimės solo?" },
  bet_solo_winner_sub:   { en: "Will the winner be a solo act?", lt: "Ar laimės solinis atlikėjas (ne duetas / grupė)?" },
  yes_short:             { en: "yes", lt: "taip" },
  no_short:              { en: "no", lt: "ne" },
  skip_short:            { en: "—", lt: "—" },
  max_pts:               { en: (n: number) => `max +${n}`, lt: (n: number) => `iki +${n}` },
  no_country:            { en: "No country", lt: "Nė viena" },
  selected_count:        { en: (n: number) => `${n} selected`, lt: (n: number) => `pasirinkta ${n}` },

  // ── Leaderboard ──────────────────────────────────────────────────
  leaderboard:       { en: "Leaderboard", lt: "Lyderiai" },
  finished:          { en: "finished", lt: "užėmė" },
  ballot_label:      { en: "ballot", lt: "balsas" },
  bonuses_label:     { en: "bonuses", lt: "statymai" },
  breakdown_total:   { en: "Total", lt: "Iš viso" },

  // ── Reactions / honeycomb ────────────────────────────────────────
  react_with:        { en: (e: string) => `React with ${e}`, lt: (e: string) => `Reaguoti su ${e}` },
};

// Sanity check: every entry must carry both languages (a typo in `en`/
// `lt` would otherwise slip through). Functions accept any args here on
// purpose — the precise signatures come from `typeof S` in `t()`.
const _shapeCheck: Record<
  keyof typeof S,
  { en: string | ((...a: never[]) => string); lt: string | ((...a: never[]) => string) }
> = S;
void _shapeCheck;

export type MessageKey = keyof typeof S;

// `t("save")` → string; `t("pick_n_more", 3)` → string with the arg
// forwarded; missing-language entries fall back to English.
export function t<K extends MessageKey>(
  lang: Language,
  key: K,
  ...args: (typeof S)[K]["en"] extends (...a: infer A) => string ? A : []
): string {
  const entry = S[key] as { en: Phrase; lt: Phrase };
  const value = entry[lang] ?? entry.en;
  return typeof value === "function"
    ? (value as (...a: unknown[]) => string)(...(args as unknown[]))
    : value;
}

// Tiny templating: fmt("{home} placement", { home: "Lithuania" }) → "Lithuania placement".
export function fmt(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

// ── Language persistence + hook ────────────────────────────────────

// Custom event dispatched alongside writes so the same tab updates
// without waiting for the cross-tab `storage` event.
const LANG_CHANGE_EVENT = "uzk:lang-change";

export function readLang(): Language {
  if (typeof window === "undefined") return "lt";
  // LT is the default; only an explicit "en" switches.
  return window.localStorage.getItem(LANG_STORAGE_KEY) === "en" ? "en" : "lt";
}

export function writeLang(lang: Language): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  window.dispatchEvent(new CustomEvent(LANG_CHANGE_EVENT, { detail: lang }));
}

import { useEffect, useState } from "react";

export function useLang(): Language {
  const [lang, setLang] = useState<Language>("lt");
  useEffect(() => {
    setLang(readLang());
    const onChange = () => setLang(readLang());
    const onStorage = (e: StorageEvent) => {
      if (e.key === LANG_STORAGE_KEY) onChange();
    };
    window.addEventListener(LANG_CHANGE_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(LANG_CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return lang;
}
