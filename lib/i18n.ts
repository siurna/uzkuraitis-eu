// ─────────────────────────────────────────────────────────────────────
// ALL user-facing copy lives here, one entry per string, EN + LT side
// by side: `key: { en: "…", lt: "…" }`. Editing a translation pair is a
// single location, no scrolling between two big blocks.
//
// Function-valued entries (e.g. `pick_n_more`) take args and return a
// string; `t()` forwards the args. Use `{placeholder}` + `fmt()` for
// substitution inside a static string.
//
// COPY RULE: never use an em dash ("—") in user-facing text. Reach for a
// comma, colon, semicolon, period, or parentheses instead.
//
// Admin pages stay English on purpose, the admin is one or two power
// users and not worth the maintenance overhead. Everything voter-facing
// goes through `t(lang, key, …)` and switches the moment the user picks
// a language.
//
// This module stays pure (no React imports) so server routes — e.g. the
// OG share-card renderer — can `import { t } from "@/lib/i18n"` without
// dragging client-only hooks in. The `useLang`/`readLang`/`writeLang`
// React glue lives in `./i18n-client.ts`.
// ─────────────────────────────────────────────────────────────────────

export type Language = "en" | "lt";

// LT first, this is a Lithuanian Eurovision party app first; EN is for
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

// Lithuanian noun agreement for counts: 1 → singular, things ending in
// 0 or in 11–19 → genitive plural ("taškų"), everything else → plural
// ("taškai"). Used by the few count-bearing strings below.
function ltPoints(n: number): string {
  if (n === 1) return "taškas";
  const mod100 = n % 100;
  if (n % 10 === 0 || (mod100 >= 11 && mod100 <= 19)) return "taškų";
  return "taškai";
}

// Guests-at-the-party agreement. Same rule family as `ltPoints` but
// the singular form lands on numbers like 21 / 31 too (last digit 1,
// not in the teens range), not just on the literal `1`. So:
//   1, 21, 31, 41… → "svečias"      (nom sg)
//   2-9, 22-29…    → "svečiai"      (nom pl)
//   10-20, 30, 40… → "svečių"       (gen pl)
function ltGuests(n: number): string {
  const last = n % 10;
  const mod100 = n % 100;
  const isTeen = mod100 >= 11 && mod100 <= 19;
  if (last === 1 && !isTeen) return "svečias";
  if (last >= 2 && last <= 9 && !isTeen) return "svečiai";
  return "svečių";
}

// "Guess" count agreement — same shape as the guests helper, swapped
// nouns. spėjimas (1, 21…) / spėjimai (2-9, 22-29…) / spėjimų (0, 10-19,
// 20, 30…). Used by the bonus-bet "you placed X side bets" badge in
// chat broadcasts + home.
function ltGuesses(n: number): string {
  const last = n % 10;
  const mod100 = n % 100;
  const isTeen = mod100 >= 11 && mod100 <= 19;
  if (last === 1 && !isTeen) return "spėjimas";
  if (last >= 2 && last <= 9 && !isTeen) return "spėjimai";
  return "spėjimų";
}

const S = {
  // ── Auto-translate to English (Settings) ─────────────────────────
  settings_translate_h:    { en: "Auto-translate Lithuanian to English", lt: "Auto-vertimas į anglų" },
  settings_translate_sub:  { en: "We'll pop a clean English rendering under any Lithuanian message: slang, cultural beats, all of it, so you won't miss a thing!", lt: "Po lietuvišku tekstu pateikiama angliška versija." },
  // "Beginner mode" was the original handle; reading it back the
  // label sounded patronising for a feature that's genuinely a
  // delight (Eurovision is FULL of references nobody catches on a
  // first watch). Friendlier framing — "Eurovision tips".
  settings_beginner_h:     { en: "Eurovision Wizard", lt: "Eurovizijos žiniuonis" },
  settings_beginner_sub:   { en: "Not a mega fan? No worries. We'll tuck a short explainer under any message that drops a reference.", lt: "Nesupranti, kodėl Tadui tai primena 2015 Švediją? Po žinute su Eurovizijos kontekstu parodysim trumpą paaiškinimą." },

  // ── NameGate / SettingsModal ─────────────────────────────────────
  welcome:           { en: "Welcome", lt: "Labas!" },
  name_prompt:       { en: "What should we call you in this room?", lt: "Kaip į tave kreiptis?" },
  your_name:         { en: "Your name", lt: "Tavo vardas" },
  // Friendly nudge, not a block. The user CAN keep the name (no
  // server enforcement) — just a heads-up that someone else here
  // already uses it, so adding an initial helps THEM not get
  // confused for the other fan.
  name_taken_hint:   { en: "Someone here already goes by this name. Totally fine to keep, but adding an initial saves you some 'wait, which John?' moments.", lt: "Kažkas su tokiu vardu jau čia. Viskas tvarkoj, bet siūlom pridėt inicialą ar kokią raidę. Bus mažiau „kuris Vladas nekenčia šitos dainos?“ momentų." },
  join_party:        { en: "Join the party", lt: "Pradėti vakarėlį" },
  pick_avatar:       { en: "Pick an avatar", lt: "Pasirink avatarą" },
  settings:          { en: "Settings", lt: "Nustatymai" },
  language:          { en: "Language", lt: "Kalba" },
  share_link:        { en: "Share room link", lt: "Pasidalinti nuoroda" },
  cancel:            { en: "Cancel", lt: "Atšaukti" },
  clear:             { en: "Clear", lt: "Išvalyti" },
  next:              { en: "Next", lt: "Toliau" },
  back:              { en: "Back", lt: "Atgal" },
  done:              { en: "Done", lt: "Gerai" },
  close:             { en: "Close", lt: "Uždaryti" },
  loading:           { en: "Loading", lt: "Krauna" },
  leave_room:        { en: "Leave room", lt: "Palikti kambarį" },
  leave_confirm:     { en: "Leave this room?", lt: "Tikrai nori palikti šitą kambarį?" },
  leave_confirm_sub: { en: "You can rejoin with the room link any time.", lt: "Jei turi nuorodą, grįžti galėsi bet kada." },
  leave_confirm_body: { en: "Your name, avatar and ballot stay on this device, leaving just takes you back to the entrance. You'll need the room code or link to come back.", lt: "Tavo vardas, veidas ir balsai lieka šiame įrenginyje, palikęs grįši į pradžios ekraną. Norėdamas grįžti, naudok kambario kodą ar nuorodą." },
  leave_yes:         { en: "Leave room", lt: "Palikti kambarį" },
  link_copied:       { en: "Link copied", lt: "Nuoroda nukopijuota" },

  // ── RoomGate (entrance code screen) ──────────────────────────────
  enter_room:        { en: "Enter room", lt: "Įeiti" },
  // Disabled-state copy for the join CTA when the user hasn't typed
  // the full 6-char code yet. Reads as a hint, not a dead button.
  enter_code_hint:   { en: "Enter party code", lt: "Įvesk vakarėlio kodą" },
  checking:          { en: "Checking", lt: "Tikrinam" },
  // Turnstile status pill copy — explains the disabled join button so
  // it doesn't read as "broken form".
  ts_checking:       { en: "Verifying you're human", lt: "Tikrinam, ar žmogus" },
  ts_error:          { en: "Couldn't verify you. Tap to retry.", lt: "Nepavyko patvirtinti. Bakstelk čia dar kartą." },
  ts_waiting_to_submit: { en: "One sec, finishing the check…", lt: "Sekundę, baigiam patikrinti…" },
  bad_code:          { en: "No room with that code.", lt: "Nėr kambario tokiu kodu." },
  bad_format:        { en: "Codes are 6 characters (A–Z, 2–9).", lt: "Kodas, 6 simboliai (A–Z, 2–9)." },
  reconnecting:      { en: "Reconnecting", lt: "Jungiam" },

  // ── Standings ────────────────────────────────────────────────────
  no_votes_yet:      { en: "Standings are quiet", lt: "Lentelė tuščia. Gerbėjai tyli." },
  no_votes_sub:      { en: "No one has voted yet. Be the first and the leaderboard fills up live as everyone joins in.", lt: "Niekas dar nebalsavo. Būk pirmas! Lentelė pildysis realiu laiku." },
  be_the_first:      { en: "Be the first", lt: "Būk pirmas" },
  fan_top5:          { en: "Fan TOP5", lt: "Vakarėlio TOP5" },
  see_all:           { en: "See all", lt: "Žiūrėti visus" },
  pts_short:         { en: "pts", lt: "tšk" },
  standings:         { en: "Standings", lt: "Rezultatai" },
  live:              { en: "Live", lt: "Tiesiogiai" },

  // ── Voting open/closed states + the on-air banners ───────────────
  update_vote:       { en: "Update your vote", lt: "Pakeisti balsus" },
  voting_closed:     { en: "Voting locked", lt: "Balsavimas užrakintas" },
  voting_closed_show: { en: "Let's enjoy the show first!", lt: "Pirma pasimėgaukime šou!" },
  voting_closed_results: { en: "Waiting for the official results!", lt: "Laukiame oficialių rezultatų!" },
  vote_open_now:     { en: "Europe, start voting now!", lt: "Europa, balsuok dabar!" },
  vote_closing:      { en: "Stop voting now!", lt: "Balsavimas baigtas!" },

  // ── VoteForm ─────────────────────────────────────────────────────
  your_top_10:       { en: "My TOP10", lt: "Mano TOP10" },
  tap_to_pick:       { en: "Pick", lt: "Pasirink" },
  pick_avatar_apply: { en: "Change", lt: "Pakeisti" },
  pick_n_more:       { en: (n: number) => `Pick ${n} more`, lt: (n: number) => `Pasirink dar ${n}` },
  submitting:        { en: "Submitting", lt: "Siunčiama" },
  fill_n_more:       { en: (n: number) => `Fill all 10 slots, ${n} to go.`, lt: (n: number) => `Užpildyk visas 10 vietų, liko dar ${n}.` },
  add_name_first:    { en: "Add your name first.", lt: "Pirma įvesk savo vardą." },
  couldnt_submit:    { en: "Couldn't submit vote.", lt: "Nepavyko išsiųsti balso." },
  // Shown under the trivia card when the country left the stage
  // before the player tapped an answer. The card stays mounted (so
  // the right answer is still readable in the chat scrollback) but
  // the buttons are inert and this line explains the muted look.
  trivia_closed:     { en: "Time's up for this one. Wait for the next.", lt: "Šįkart kiti buvo greitesni. Lauk kito klausimo." },
  // Chip rendered next to the player's pick when they got the answer
  // wrong. Replaces the +2 points chip that used to live on the
  // correct plate regardless of outcome — that read as "I got 2
  // points" to a player who'd just missed it.
  trivia_not_this_time: { en: "Not this time", lt: "Ech, ne šįkart" },
  // Toast that pops when the server returns `tooLate: true` for a
  // CORRECT answer: the player nailed it but the room's per-question
  // cap (first N answerers) was already hit. The plate still flips
  // emerald + Check on reveal so they see they got it; the toast
  // explains the missing +2.
  trivia_too_late_correct_toast: {
    en: (n: number) => `Right answer, too slow. Trivia points are for the first ${n} hands up. Chop chop next time!`,
    lt: (n: number) => `Atsakymas teisingas, bet vėluoji. Taškai keliauja pirmiems ${n}. Kitąkart nemiegok!`,
  },
  tab_ballot:        { en: "Ballot", lt: "Balsavimas" },
  tab_bets:          { en: "Guesses", lt: "Spėjimai" },
  tab_rules:         { en: "Rules", lt: "Taisyklės" },
  vote_cast_title:   { en: "Your vote's cast! 🎉", lt: "Tavo balsas užfiksuotas! 🎉" },
  vote_cast_body:    { en: "Saved automatically. Reorder anytime, it updates on its own.", lt: "Išsaugom automatiškai. Eiliškumą gali keisti bet kada iki balsavimo pabaigos." },
  vote_place_bets:   { en: "Place your bets", lt: "Pasidalink savo spėjimais" },
  vote_keep_editing: { en: "Keep editing", lt: "Tęsti redagavimą" },

  // ── Rules tab (scoring explainer) ────────────────────────────────
  rules_title:       { en: "How scoring works", lt: "Kaip skaičiuojami taškai?" },
  rules_top10_h:     { en: "Your TOP 10", lt: "Tavo TOP 10" },
  rules_top10_b:     { en: "Only countries that finish in the official Top 10 score anything.\n\nPlace one in the exact spot it finished and you bank its full Eurovision points (12, 10, 8…1).\n\nOff by a place? Slide one rung down the scoreboard: a country that came 1st but you ranked 3rd scores 8 (3rd place's value), and sliding past 10th means 0.", lt: "Taškus gausi tik už šalis, patekusias į oficialų TOP 10.\n\nTiksliai įvardyta užimta vieta gauna pilnus Eurovizijos taškus (12, 10, 8…1).\n\nKlysti viena vieta? Nuslysti viena pakopa žemyn: jei šalis liko 1-a, o tu ją pastatei 3-ią, gauni 8 (3-ios vietos vertę). Nuslydęs už 10-os vietos negausi nieko." },
  rules_top10_eg:    { en: "Example: A country that finished 1st, scored by how far off your ranking was:", lt: "Pavyzdys: 1-ą vietą užėmusi šalis. Kiek taškų gausi pagal spėjimo tikslumą:" },
  rules_home_h:      { en: "How will {home} place?", lt: "Kelintą vietą užims {home}?" },
  rules_home_b:      { en: "Nail it and that's 12 points! Every place you're off slides you one rung down the Eurovision ladder (12 → 10 → 8 → 7 … 1):", lt: "Pataikyk tiksliai ir uždirbk 12 taškų! Už kiekvieną netaiklią vietą nuslysti pakopa žemyn Eurovizijos skalėje (12 → 10 → 8 → 7 … 1):" },
  rules_bets_h:      { en: "Bonus bets", lt: "Papildomi statymai" },
  rules_bets_intro:  { en: "Every bet is optional. You only score if you call it right; a skipped bet is just 0.", lt: "Taškų gausi tik pataikęs. Praleistas statymas, tiesiog 0. Tai,.. ko nesurizikavus?" },
  rules_trivia_h:    { en: "Trivia", lt: "Viktorina" },
  rules_trivia_b:    { en: "During each performance, a trivia question pops up on screen at some point. The first few to answer correctly score +2 points each; everyone else (and anyone who skips or gets it wrong) takes a 0. Speed is everything, don't snooze!", lt: "Kiekvieno pasirodymo metu, kažkada ekrane sulauksi viktorinos klausimo. Pirmieji teisingai atsakę gauna po +2 taškus; kiti (taip pat praleidę ar suklydę) lieka su 0. Greitis lemia viską, nežiopsok!" },
  rules_highlights_b:{ en: "When a chat message you sent picks up enough reactions it becomes a highlight: +2 points each, up to +12. (You have to have voted to score.)", lt: "Kai tavo žinutė pokalbyje surenka daug reakcijų, ji tampa vakaro akcentu: po +2 t. už kiekvieną, iki +12. Taškai skaičiuojami tik pateikusiems savo TOP 10!" },

  // ── Room tab bar ─────────────────────────────────────────────────
  tab_home:          { en: "Home", lt: "Pradžia" },
  tab_chat:          { en: "Chat", lt: "Pokalbiai" },
  tab_bingo:         { en: "Bingo", lt: "Bingo" },
  tab_vote:          { en: "Vote", lt: "Balsuok" },
  tab_results:       { en: "Results", lt: "Rezultatai" },

  // ── Home banners (context-aware shortcuts) ───────────────────────
  home_vote_open:      { en: "Vote now!", lt: "Vyksta balsavimas" },
  home_vote_open_sub:  { en: "Lines close soon, get it in.", lt: "Linijos užsidarys greitai, nežiopsok." },
  home_vote_done:      { en: "Your vote's in, reorder it anytime", lt: "Tavo balsas užfiksuotas" },
  home_vote_done_eyebrow: { en: "Voted", lt: "Balsuota" },
  home_vote_done_sub:  { en: "Place bets or tweak your TOP 10.", lt: "Spėliok arba pakeisk TOP 10." },
  home_bonus_placed:   { en: (n: number) => `${n} side ${n === 1 ? "bet" : "bets"} placed`, lt: (n: number) => `Tik ${n} ${ltGuesses(n)}` },
  home_bonus_none:     { en: "Place your side bets", lt: "Pabūk orakulu" },
  home_bonus_sub:      { en: "Wooden spoon, jury winner, nul points…", lt: "Paskutinė vieta, žiuri nugalėtojas, nulis taškų…" },
  home_vs_room:        { en: "You vs the room", lt: "Tu prieš kitus" },
  home_vs_room_rank:   { en: (n: number) => `Your #1, the room ranks it #${n}`, lt: (n: number) => `Tavo Nr.1, kiti vertina ją #${n}` },
  home_vs_room_agree:  { en: "You and the room agree, it's on top!", lt: "Tu ir kiti sutariate - numeris vienas!" },
  home_vs_room_bold:   { en: (n: number) => `Bold pick, the room has it way down at #${n}`, lt: (n: number) => `Drąsus pasirinkimas, kiti ją laiko net #${n}` },
  home_vs_room_pending:{ en: "Your #1, waiting for more ballots", lt: "Tavo Nr.1, laukiam daugiau balsų" },
  home_vs_room_wavelength: { en: (n: number) => `On the room's wavelength: ${n} of your top 5 are theirs too`, lt: (n: number) => `Tavo ir kitų skonis sutampa: ${n} iš tavo TOP 5 yra ir daugelio kitų sąraše` },
  home_vs_room_outlier:    { en: "Lone wolf. Barely any of your picks crack the room's top 10", lt: "Vienišas vilkas. Beveik nė vienas tavo favoritas nepatenka į kitų TOP 10" },
  home_vs_room_empty_title: { en: "How do you stack up?", lt: "Kaip atrodai lyginant su kitais?" },
  home_vs_room_empty_sub:   { en: "Cast your TOP 10 to compare with the room.", lt: "Balsuok ir palygink savo TOP 10 su kitais." },
  chat_np_my_rank:     { en: (n: number) => `My #${n}`, lt: (n: number) => `Mano #${n}` },
  chat_np_my_rank_aria:{ en: (n: number) => `Your #${n} in your TOP 10, tap to change`, lt: (n: number) => `Tavo #${n} TOP 10 sąraše, palieskite, kad pakeistumėte` },
  home_results:        { en: "Results are in", lt: "Rezultatai jau čia" },
  home_bingo_won:      { en: "Bingo! 🎉 Tap to see your card", lt: "Bingo! 🎉 Bakstelėk savo kortelę" },
  bingo_widget_title:  { en: "Play bingo!", lt: "Žaisk bingo!" },
  highlights_title:    { en: "Highlights", lt: "Akcentai" },
  highlights_more:     { en: "more", lt: "daugiau" },
  whos_here_title:     { en: (n: number) => (n === 1 ? "Just you here" : `${n} here right now`), lt: (n: number) => (n === 1 ? "Kol kas čia tik tu" : `Vakarėlyje ${n} ${ltGuests(n)}`) },
  home_my_results:     { en: "Your results", lt: "Tavo rezultatai" },
  home_results_in:     { en: "Results are in", lt: "Rezultatai jau čia" },
  home_results_in_sub: { en: "See how everyone did", lt: "Pamatyk, kaip visiems sekėsi" },
  results_top5:        { en: "Top 5 of the night", lt: "Vakaro TOP 5" },
  results_voters:      { en: "voters", lt: "balsavusių" },
  results_you_label:   { en: "You", lt: "Tu" },
  results_tab_me:      { en: "My breakdown", lt: "Mano išklotinė" },
  results_tab_board:   { en: "Leaderboard", lt: "Lyderių lentelė" },
  results_you_said:    { en: "You said", lt: "Tu sakei" },
  results_it_was:      { en: "It was", lt: "Buvo" },
  bet_yes:             { en: "Yes", lt: "Taip" },
  bet_no:              { en: "No", lt: "Ne" },
  bet_none_label:      { en: "No country", lt: "Jokios šalies" },

  // ── Chat ─────────────────────────────────────────────────────────
  chat_empty:        { en: "No messages yet. Say hi 👋", lt: "Dar nieks nieko nerašė. Pasisveikink pirmas 👋" },
  chat_placeholder:  { en: "Message", lt: "Tavo žinutė" },
  chat_load_earlier: { en: "Load earlier", lt: "Įkelti senesnes" },
  chat_slow_down:    { en: "Whoa, slow down a sec.", lt: "Pala, PALA, neskubėk taip!" },
  chat_today:        { en: "Today", lt: "Šiandien" },
  chat_yesterday:    { en: "Yesterday", lt: "Vakar" },
  chat_jump_bottom:  { en: "To bottom", lt: "Į apačią" },
  chat_new_pill:     { en: "New messages!", lt: "Naujos žinutės!" },
  chat_typing_one:   { en: (a: string) => `${a} is typing…`, lt: (a: string) => `${a} rašo…` },
  chat_typing_two:   { en: (a: string, b: string) => `${a} and ${b} are typing…`, lt: (a: string, b: string) => `${a} ir ${b} rašo…` },
  chat_typing_many:  { en: "Several people are typing…", lt: "Keli žmonės rašo…" },
  chat_seen_by:      { en: (n: number) => `Seen by ${n}`, lt: (n: number) => `Matė ${n}` },
  chat_reply:        { en: "Reply", lt: "Atsakyti" },
  // Shown inside the reply chip when the parent message is gone
  // (author deleted it OR it scrolled out of the rendered window).
  chat_reply_deleted: { en: "(message removed)", lt: "(žinutė pašalinta)" },
  chat_delete:       { en: "Delete", lt: "Ištrinti" },
  chat_admin_on:     { en: "Moderator mode on", lt: "Moderatoriaus režimas įjungtas" },
  chat_admin_off:    { en: "Moderator mode off", lt: "Moderatoriaus režimas išjungtas" },
  chat_card:         { en: "card", lt: "kortelė" },
  chat_who_reacted:  { en: "Who reacted?", lt: "Kas reagavo?" },
  chat_reactors_title: { en: "Reactions", lt: "Reakcijos" },
  // System (meta-narration) chat messages, rendered in the recipient's
  // language from meta.sysKey. The server still stores the EN text in
  // `body` for back-compat / debuggability.
  sys_voted:         { en: (name: string) => `🗳️ ${name} cast their vote`, lt: (name: string) => `🗳️ ${name} atidavė savo balsą` },
  sys_voting_open:   { en: "📣 Voting is OPEN, cast your TOP10!", lt: "📣 Balsavimas ATIDARYTAS, užfiksuok savo TOP10!" },
  sys_voting_closed: { en: "🔒 Voting is CLOSED.", lt: "🔒 Balsavimas UŽDARYTAS." },
  sys_show_started:  { en: "🟢 The show is underway, Europe, get ready!", lt: "🟢 Šou prasidėjo, Europa, pasiruošk!" },
  sys_show_break:    { en: "⏸ Interval break. Stretch those legs.", lt: "⏸ Pertrauka. Pajudink kojas. Įsipilk dar vyno." },
  sys_show_ended:    { en: "🏁 Performances have ended.", lt: "🏁 Pasirodymai baigti." },
  sys_show_doors:    { en: "🎬 Doors open, the show hasn't started yet.", lt: "🎬 Durys atvertos, bet šou dar neprasidėjo." },
  sys_results_in:    { en: "🏆 Results are in, leaderboard's live!", lt: "🏆 Rezultatai jau čia, lyderių lentelė paskelbta!" },
  sys_cta_notifications: { en: "🔔 Turn on notifications so you don't miss a beat (tap your avatar).", lt: "🔔 Įsijunk pranešimus, kad nieko nepražiopsotum (bakstelėk savo avatarą)." },
  sys_cta_notifications_title: { en: "Notifications", lt: "Pranešimai" },
  sys_cta_notifications_sub: { en: "Don't miss the night's biggest moments!", lt: "Nepraleisk svarbiausių vakaro momentų!" },
  sys_cta_notifications_on:  { en: "On", lt: "Įjungta" },
  sys_cta_notifications_off: { en: "Off", lt: "Išjungta" },
  sys_cta_notifications_unsupported: { en: "Unsupported", lt: "Nepalaikoma" },
  sys_cta_vote:      { en: "🗳️ Lines are open, get your TOP 10 in!", lt: "🗳️ Linijos atviros, balsuok už savo TOP 10!" },
  sys_cta_vote_title: { en: "Lines are open", lt: "Balsavimas praidėjo" },
  sys_cta_vote_sub_empty:    { en: "Drop your TOP 10. Every spot is points.", lt: "Balsuok už savo TOP 10. Kiekviena aspėta vieta – taškai!" },
  sys_cta_vote_sub_progress: { en: (n: number) => `Your ballot is ${n}/10. Finish it off.`, lt: (n: number) => `Tavo TOP 10: ${n}/10. Užbaik, ką pradėjai.` },
  sys_cta_vote_done_headline: { en: "All 10 are locked in.", lt: "Turim tavo dešimtuką." },
  sys_cta_vote_btn_cast:     { en: "Cast your ballot", lt: "Atiduoti balsą" },
  sys_cta_vote_btn_adjust:   { en: "Tweak your TOP 10", lt: "Pakeisti TOP 10" },
  sys_cta_bet:      { en: "🎲 Don't forget your bonus bets, every one is free points if you call it.", lt: "🎲 Nepamiršk bonus spėlionių, kiekvienas pataikymas – nemokami taškai." },
  sys_cta_bet_title_suggest: { en: "Bonus bet idea", lt: "Pabandyk atspėti" },
  sys_cta_bet_title_done:    { en: "All bets in", lt: "Visi spėjimai pateikti. Super!" },
  sys_cta_bet_suggest_sub:   { en: (label: string) => `You haven't placed: ${label}`, lt: (label: string) => `Dar nespėjai: ${label}` },
  sys_cta_bet_sub_done:      { en: "Nice. Now relax and wait for the points.", lt: "Šaunu. Dabar atsipalaiduok ir lauk taškų." },
  sys_cta_top3:      { en: (arg: string) => `🏆 Leading the room right now: ${arg}`, lt: (arg: string) => `🏆 Šiuo metu pirmauja: ${arg}` },
  sys_cta_top3_eyebrow: { en: "Top 3 right now", lt: "Šiuo metu pirmauja" },
  sys_cta_top3_empty:{ en: "🏆 No votes yet, be the first!", lt: "🏆 Dar nieks nebalsavo, būk pirmas!" },
  sys_cta_results_breakdown: { en: "Your breakdown", lt: "Tavo išklotinė" },
  sys_cta_results_breakdown_disabled: { en: "You didn't cast a ballot", lt: "Šįvakar nebalsavai" },
  sys_cta_results_board:     { en: "Full list", lt: "Visa lentelė" },
  // Selfie CTA — chat-broadcast-cards renders the SelfieCard; the
  // sysKey itself is the fallback plain text when no card matches.
  sys_cta_selfie:            { en: "📸 Selfie time, drop one in chat!", lt: "📸 Selfio metas, mesk vieną į pokalbį!" },
  sys_cta_selfie_eyebrow:    { en: "Selfie time", lt: "Metas asmenukei!" },
  sys_cta_selfie_title:      { en: "Show the room your face.", lt: "Parodyk savo euro-vakarėlį." },
  sys_cta_selfie_sub:        { en: "One tap, front camera, straight into chat.", lt: "Pasidalink savo vakaruškos akimirka." },
  sys_cta_selfie_sending:    { en: "Sending", lt: "Siunčiam" },
  sys_cta_selfie_done_title: { en: "Looking great.", lt: "Atrodai puikiai." },
  sys_cta_selfie_done_sub:   { en: "Keep it up!", lt: "Taip ir toliau!" },
  // Quick poll card. Reuses chat reactions for storage, so live
  // tallies arrive on the existing chat:react broadcast.
  poll_eyebrow:              { en: "Vibe check", lt: "Pasitikrinam nuotaiką" },
  poll_prompt:               { en: "Tap your pick", lt: "Pasirink variantą" },
  poll_voted:                { en: (n: number) => `Locked in. ${n} ${n === 1 ? "vote" : "votes"} so far.`, lt: (n: number) => `Užfiksuota. Šiuo metu balsų: ${n}.` },
  poll_tap:                  { en: "Tap", lt: "Balsuoti" },
  poll_undo:                 { en: "Undo my vote", lt: "Atšaukti balsą" },
  // ── Push notifications (rendered server-side per subscriber's
  //    `lang` column, so a LT viewer gets LT even when an EN sender
  //    triggered the broadcast).
  push_chat_photo:           { en: "Sent a photo", lt: "Atsiuntė nuotrauką" },
  push_chat_gif:             { en: "Sent a GIF", lt: "Atsiuntė GIF" },
  push_chat_new:             { en: "New message", lt: "Nauja žinutė" },
  push_chat_mention_title:   { en: (name: string) => `${name} mentioned you`, lt: (name: string) => `${name} tave paminėjo` },
  push_chat_mention_body:    { en: "Tap to open the chat", lt: "Bakstelėk, kad atvertum pokalbį" },
  push_chat_reply_title:     { en: (name: string) => `${name} replied to you`, lt: (name: string) => `${name} tau atsakė` },
  push_chat_reply_body:      { en: "Tap to see the reply", lt: "Bakstelėk, kad pamatytum atsakymą" },
  push_now_playing_title:    { en: (flag: string, name: string) => `${flag}${name} is on stage`, lt: (flag: string, name: string) => `${flag} Scenoje – ${name}!` },
  push_now_playing_body_song: { en: (artist: string, song: string) => `${artist} · ${song}`, lt: (artist: string, song: string) => `${artist} · ${song}` },
  push_now_playing_body_open: { en: "Tap to open the room", lt: "Spausk ir žiūrėk, kas nutiko" },
  push_voting_open_title:    { en: "Voting is open", lt: "Balsavimas pradėtas" },
  push_voting_open_body:     { en: "Cast your TOP 10 before the show kicks off.", lt: "Atiduok savo TOP 10 prieš šou pradžią." },
  push_voting_closed_title:  { en: "Voting just closed", lt: "Balsavimas baigtas" },
  push_voting_closed_body:   { en: "Results coming in shortly.", lt: "Rezultatai jau netrukus" },
  push_results_title:        { en: "Results are tallied", lt: "Suskaičiavom rezultatus" },
  push_results_body:         { en: "Open the leaderboard to see how you did.", lt: "Atsidaryk lyderių lentelę ir pažiūrėk, kaip tau sekėsi." },

  // Welcome / housekeeping widget at the bottom of every room home.
  // The card itself is a single tap target; the markdown opens in a
  // drawer rather than sitting open on the home scroll.
  welcome_card_title:        { en: "'Hello' from the organisers", lt: "Trumpa įžanga" },
  welcome_card_sub:          { en: "House rules, schedule, the usual housekeeping. Tap to open.", lt: "Vakaro taisyklės, veiklos, smulkmenos. Spausk ir susipažink." },
  // Title used by the chat ticket's "Read more" drawer — friendlier
  // than the eyebrow on the home banner because the drawer is the
  // direct read-the-whole-thing surface.
  welcome_drawer_title:      { en: "Welcome!", lt: "Sveiki atvykę!" },
  welcome_read_more:         { en: "Read more", lt: "Skaityti daugiau" },

  // Show identity — surfaces that print the host city, contest year,
  // or the final's date (header eyebrow, brand chip on the landing
  // gate, the chat-ticket stub, etc). Keeping them here means the
  // 2027 cutover is a one-line edit per locale.
  host_city:                 { en: "Vienna", lt: "Viena" },
  host_year:                 { en: "2026", lt: "2026" },
  host_city_year:            { en: "Vienna 2026", lt: "Viena 2026" },
  final_date:                { en: "16 May", lt: "Gegužės 16" },
  // Ticket-stub microcopy. ADMIT ONE in EN ↔ "Bilietas" reads
  // friendlier than a literal "Įleidžiamas vienas" in LT.
  ticket_admit_one:          { en: "Admit one", lt: "Bilietas" },
  ticket_show_eyebrow:       { en: "Show", lt: "Renginys" },
  // Tabular serial number on the ticket. EN uses the № glyph, LT
  // the more familiar "Nr." prefix.
  ticket_serial:             { en: "№ 70", lt: "Nr. 70" },
  // Plain-text fallback for the chat CTA card (rendered when a viewer
  // sees the chat row but no card matches, or for screen readers).
  sys_cta_welcome:           { en: "👋 Hello folks, a few housekeeping notes", lt: "👋 Sveiki, keletas tvarkos taisyklių" },
  // Closing card: fired by the host at the very end. The card
  // surface owns the visual (gold gradient + confetti); these are
  // the headline + sub for screen-readers + non-card fallback.
  sys_cta_thanks:            { en: "🎉 Thank you for the wonderful show , Europe!", lt: "🎉 Ačiū už nuostabų vakarą, Europa!" },
  sys_cta_thanks_eyebrow:    { en: "That's a wrap", lt: "Tad štai ir viskas" },
  sys_cta_thanks_title:      { en: "Thank you for the wonderful show , Europe!", lt: "Ačiū už nuostabų vakarą, Europa!" },
  sys_cta_thanks_sub:        { en: "See you in {next}.", lt: "Pasimatysim {next}." },
  sys_cta_thanks_next:       { en: "2027", lt: "2027" },
  // Shown inside the chat card when the admin hasn't authored anything
  // for the viewer's language yet — quietly nudges the host.
  welcome_empty_chat:        { en: "The host hasn't written any housekeeping notes yet.", lt: "Šeimininkas dar neparašė jokių taisyklių." },
  chat_edit:         { en: "Edit", lt: "Redaguoti" },
  chat_edited:       { en: "edited", lt: "redaguota" },
  chat_editing:      { en: "Editing your message", lt: "Redaguoji žinutę" },
  chat_edit_placeholder: { en: "Edit your message", lt: "Redaguok žinutę" },
  chat_copy:         { en: "Copy", lt: "Kopijuoti" },
  chat_send_photo:   { en: "Send a photo", lt: "Įkelti nuotrauką" },
  chat_image_send:   { en: "Send", lt: "Siųsti" },
  chat_image_too_big: { en: "Image is too large (max 8 MB).", lt: "Nuotrauka per didelė (maks. 8 MB). Nepersistenk." },
  chat_image_failed: { en: "Couldn't upload that image.", lt: "Nepavyko įkelti nuotraukos." },
  chat_drop_image:   { en: "Drop the image to send it. DROP IT LIKE IT'S HOT.", lt: "Mestelk nuotrauką čia, kad išsiųstum visiems." },
  gif_pick:          { en: "Pick a GIF", lt: "Pasirink GIF" },
  gif_search:        { en: "Search GIFs", lt: "Ieškoti GIF" },
  gif_empty:         { en: "No GIFs found.", lt: "Nieko nerasta." },

  // ── Country deep-dive ────────────────────────────────────────────
  deep_artist:       { en: "Artist", lt: "Atlikėjas" },
  deep_song:         { en: "Song", lt: "Daina" },

  // ── Social share ─────────────────────────────────────────────────
  share_picks:        { en: "Share my TOP10", lt: "Dalinkis savo TOP10" },
  share_eyebrow:      { en: "Show it off", lt: "Pasigirk" },
  share_picks_sub:    { en: "A shareable card of your ranking, straight to Stories or chat", lt: "Tavo TOP10 kortelė, tinkama tiesiai į Stories ar pokalbį!" },
  share_picks_caption: { en: "Cast my Eurovision 2026 TOP10", lt: "Mano Eurovizijos 2026 TOP10" },
  share_preparing:    { en: "Preparing image", lt: "Ruošiam paveikslėlį" },
  share_image_copied: { en: "Image copied, paste it anywhere", lt: "Paveikslėlis nukopijuotas, įklijuok bet kur!" },
  share_failed:       { en: "Couldn't prepare the share image", lt: "Nepavyko paruošti paveikslėlio" },

  // ── Now-playing strip ────────────────────────────────────────────
  now_playing:       { en: "On stage", lt: "Scenoje" },
  np_add_top10:      { en: "TOP 10", lt: "TOP 10" },
  np_drawer_title:   { en: (c: string) => `Add ${c} to your TOP 10`, lt: (c: string) => `${c} keliauja į tavo TOP 10` },
  np_drawer_sub:     { en: "Tap a spot, the picks below it slide down a notch.", lt: "Bakstelėk vietą, kur padėti. Žemiau esančios šalys pasislinks." },
  np_drawer_here:    { en: "current spot", lt: "dabar čia" },
  np_empty:          { en: "Empty", lt: "Tuščia" },

  // ── Bingo ────────────────────────────────────────────────────────
  bingo_list:        { en: "What to watch for", lt: "Ko dairytis?" },
  bingo_generate:    { en: "New ticket", lt: "Nauja kortelė" },
  bingo_ticket:      { en: "Ticket", lt: "Kortelė" },
  bingo_remove_ticket: { en: "Remove this ticket", lt: "Pašalinti šią kortelę" },
  bingo_remove_confirm: { en: "Remove this ticket?", lt: "Pašalinti šią kortelę?" },
  bingo_remove_confirm_sub: { en: "This can't be undone.", lt: "To nebebus galima atšaukti." },
  bingo_remove_confirm_body: { en: "The squares you've struck on this ticket will be lost. Your other tickets stay.", lt: "Šios kortelės pažymėti langeliai dings. Kitos tavo kortelės liks." },

  // ── Notifications ────────────────────────────────────────────────
  notifications:        { en: "Notifications", lt: "Pranešimai" },
  push_blocked:         { en: "Notifications are blocked.", lt: "Pranešimai užblokuoti." },
  push_install_required: { en: "Install the app to enable notifications", lt: "Įsidiek aplikaciją, kad gautum pranešimus" },
  push_how:             { en: "How", lt: "Kaip?" },
  push_enable:          { en: "Turn on notifications", lt: "Įjungti pranešimus" },
  push_off:             { en: "Off", lt: "Išjungta" },
  push_on:              { en: "Notifications on", lt: "Pranešimai įjungti" },
  push_enabled:         { en: "Notifications enabled", lt: "Pranešimai įjungti" },
  // "Permission denied" was the literal browser response, but it
  // reads as "you tried something and we said no" — the actual
  // situation is the OS-level toggle being off. Reframe as
  // actionable advice the user can take.
  push_denied:          { en: "Notifications are blocked. Open your browser's site settings to re-enable them.", lt: "Pranešimai užblokuoti. Atidaryk svetainės nustatymus naršyklėje, kad (vėl) įjungtum." },
  push_chat_all:        { en: "All chat messages", lt: "Visos pokalbių žinutės" },
  push_chat_all_sub:    { en: "Every message in the room thread.", lt: "Kiekviena žinutė kambario pokalbyje." },
  push_chat_replies:    { en: "Replies to my messages", lt: "Atsakymai į mano žinutes" },
  push_chat_replies_sub: { en: "When someone replies to or @-mentions you.", lt: "Kai kažkas atsako ar pamini tave su @." },
  push_now_playing:     { en: "Country changes on stage", lt: "Kai scenoje pasikeičia šalis" },
  push_now_playing_sub: { en: "A ping each time a new act takes the stage.", lt: "Pranešimas kiekvienąkart, kai į sceną žengia naujas atlikėjas." },
  push_voting_state:    { en: "Voting opens or closes", lt: "Balsavimas: atidarytas ar uždarytas" },
  push_voting_state_sub: { en: "So you don't miss the window to cast your TOP 10.", lt: "Kad nepražiopsotum laiko balsuoti už savo TOP 10." },
  push_results_tallied: { en: "Results are tallied", lt: "Suskaičiuoti rezultatai" },
  push_results_tallied_sub: { en: "When the host enters the official results.", lt: "Kai paskelbsime oficialius rezultatus." },
  push_cta_title:       { en: "Don't miss a beat", lt: "Nieko nepražiopsok!" },
  push_cta_sub:         { en: "Get a ping when a country goes on stage, results land, or someone replies to you.", lt: "Sužinok, kai į sceną žengia šalis, paskelbiami rezultatai ar kažkas tau atrašo. O šiaip tai daugiau netrukdysim." },
  push_cta_enable:      { en: "Turn on", lt: "Įjungti" },

  // ── PWA install prompt (room-gate bottom CTA) ────────────────────
  install_cta:             { en: "Get ready for the big night: install the app", lt: "Pasiruošk didžiajam vakarui: įsidiek aplikaciją" },
  install_drawer_title:    { en: "Install the app", lt: "Įsidiek aplikaciją" },
  install_drawer_sub:      { en: "Two taps and you'll have us on your home screen for finale night.", lt: "Du paspaudimai ir mes tūnosim tavo pagrindiniame ekrane, pasiruošę finalui." },

  // ── Notification install instructions ────────────────────────────
  push_help_ios_title:     { en: "On iPhone / iPad", lt: "„iPhone“ / „iPad“" },
  push_help_ios_1:         { en: "Tap the Share button in Safari (the square with an arrow).", lt: "„Safari“ paspausk dalinimosi mygtuką (kvadratas su rodykle aukštyn)." },
  push_help_ios_2:         { en: 'Scroll down and tap "Add to Home Screen".', lt: "Slink žemyn ir pasirink „Add to Home Screen“ (Pridėti į pagrindinį ekraną)." },
  push_help_ios_3:         { en: "Open the app from your Home Screen, not Safari.", lt: "Atidaryk programėlę iš pagrindinio ekrano, ne iš „Safari“." },
  push_help_ios_4:         { en: "Come back here and turn on notifications.", lt: "Grįžk čia ir įjunk pranešimus." },
  push_help_android_title: { en: "On Android", lt: "„Android“" },
  push_help_android_1:     { en: "Tap the ⋮ menu in Chrome (or your browser).", lt: "„Chrome“ (ar kitoje naršyklėje) paspausk ⋮ meniu." },
  push_help_android_2:     { en: 'Choose "Install app" or "Add to Home Screen".', lt: "Pasirink „Install app“ arba „Add to Home Screen“." },
  push_help_android_3:     { en: "Open the app from your home screen.", lt: "Atidaryk programėlę iš pagrindinio ekrano." },
  push_help_desktop_title: { en: "On desktop", lt: "Kompiuteryje" },
  push_help_desktop_1:     { en: "Click the install icon in the address bar (or browser menu → Install).", lt: "Adreso juostoje paspausk įdiegimo ikoną (arba naršyklės meniu → „Install“)." },
  push_help_desktop_2:     { en: "Open the installed app and turn on notifications.", lt: "Atidaryk įdiegtą aplikaciją ir įjunk pranešimus." },
  // Reworded desktop install steps for the install drawer (clearer
  // than the notifications-flow copy: tells the user EXACTLY where
  // the install icon hides instead of "address bar OR menu").
  install_desktop_1:       { en: "Look at the right edge of the address bar for a small monitor icon (Chrome, Edge, Brave). Click it.", lt: "Adreso juostos dešiniajame krašte ieškok mažos monitoriaus ikonėlės („Chrome“, „Edge“, „Brave“). Radai? Spausk!" },
  install_desktop_2:       { en: 'Confirm "Install" in the dialog that pops up.', lt: "Atsidariusiame dialoge spausk „Install“." },
  install_desktop_3:       { en: "Open the app from your dock or Start menu.", lt: "Atidaryk programėlę iš doko ar pradžios meniu." },
  push_help_other_title:   { en: "On this device", lt: "Šiame įrenginyje" },
  push_help_other_1:       { en: "Add this site to your home screen, then come back and try again.", lt: "Pridėk šį puslapį į pagrindinį ekraną ir bandyk dar kartą." },
  push_help_blocked_title: { en: "Allow notifications in your browser", lt: "Leisk pranešimus naršyklės nustatymuose" },
  push_help_blocked_1:     { en: "Open this site's permissions in your browser settings.", lt: "Atidaryk šios svetainės leidimus naršyklėje." },
  push_help_blocked_2:     { en: "Change Notifications from Blocked to Ask or Allow.", lt: "Pakeisk „Notifications“ iš „Blocked“ į „Ask“ arba „Allow“." },
  push_help_blocked_3:     { en: "Refresh this page and try again.", lt: "Atnaujink puslapį ir bandyk dar kartą." },

  // Onboarding step inside the NameGate sheet.
  notif_gate_title:        { en: "Stay in the loop", lt: "Nepražiopsok svarbiausių momentų!" },
  notif_gate_sub:          { en: "We'll only ping for replies, lines opening, and results landing.", lt: "Nepraleisk, kai pasikeičia šalis, tau atrašo, atsidaro balsavimas ar paskelbiami rezultatai. Ko kito mes čia susirinkę?" },
  notif_gate_skip:         { en: "Maybe later, like 2027?", lt: "Galbūt vėliau, 2027?" },
  notif_gate_install_hint: { en: "Install the app first to receive notifications.", lt: "Įdiek aplikaciją, kad galėtum gauti pranešimus." },

  // ── Bonus bets, labels + descriptions. `{home}` / `{host}` get
  //    substituted with fmt(). ──────────────────────────────────────
  bet_lt_placement:      { en: "{home} placement", lt: "Kurią vietą užims {home}?" },
  bet_lt_placement_sub:  { en: "Where does {home} finish? Closer guesses score more.", lt: "Kuo tiksliau atspėji, tuo tau geriau." },
  bet_wooden_spoon:      { en: "Wooden spoon", lt: "Paskutinė vieta" },
  bet_wooden_spoon_sub:  { en: "Who comes dead last? Land one place off the bottom and you still bank +2.", lt: "Kas namo parsiveš medinį šaukštą? Pataikęs vieną vietą pro šalį, vis tiek gauni +2." },
  bet_lt_12_to:          { en: "12 points from {home}", lt: "{home} 12 taškų skirs..." },
  bet_lt_12_to_sub:      { en: "Which country gets {home}'s 12 points?", lt: "Kuriai šaliai {home} skirs savo 12 taškų?" },
  bet_big5:              { en: "Best of the Big 5", lt: "Geriausias iš Big 5" },
  bet_big5_sub:          { en: "UK, Germany, France, Italy or Spain, which finishes highest? Within two spots also scores.", lt: "Iš JK, Vokietijos, Prancūzijos, Italijos, Ispanijos (haha), kas finišuos aukščiausiai? Pataikius per 2 vietas, dalis taškų vis tiek." },
  bet_jury_winner:       { en: "Jury winner", lt: "Žiuri nugalėtojas" },
  bet_jury_winner_sub:   { en: "Country with the highest jury total.", lt: "Šalis, kuri surinks daugiausiai žiuri taškų." },
  bet_televote_winner:   { en: "Televote winner", lt: "Žiūrovų nugalėtojas" },
  bet_televote_winner_sub: { en: "Country with the highest public televote total.", lt: "Šalis, kuri surinks daugiausiai žiūrovų taškų." },
  bet_nul:               { en: "Zero from televote", lt: "Nulis iš žiūrovų?" },
  bet_nul_sub:           { en: "Pick up to 5 countries you think get zero from the public, +3 for each right (capped at +12). Or 'No country' if you reckon everyone scores.", lt: "Pasirink iki 5 šalių, kurios, tavo manymu, gaus nulį iš žiūrovų, po +3 už kiekvieną teisingą (daugiausiai +12). Arba „Nė viena“, jei manai, kad visos ką nors uždirbs." },
  bet_lt_total:          { en: "{home} total points", lt: "{home} surinks" },
  bet_lt_total_sub:      { en: "How many points (jury + public) does {home} end with? Closer guesses score more.", lt: "Kiek iš viso taškų (žiuri + žiūrovai) surinks {home}? Kuo arčiau atspėsi, tuo daugiau uždirbsi." },
  bet_lt_jury_count:     { en: "Juries scoring {home}", lt: "Iš kelių komisijų {home} gaus taškų?" },
  bet_lt_jury_count_sub: { en: "During the long jury reveal, how many countries give {home} any points? Closer guesses score more.", lt: "Per ilgąją žiuri dalį, kiek šalių skirs mums bent kažkiek taškų?" },
  bet_host_top3:         { en: "{host} top 3?", lt: "Ar {host} bus TOP3?" },
  bet_host_top3_sub:     { en: "Will the host land in the top 3?", lt: "Ar šeimininkai pateks į geriausiųjų trejetuką" },
  bet_solo_winner:       { en: "Solo winner?", lt: "Vieniša pergalė?" },
  bet_solo_winner_sub:   { en: "Will the winner be a solo act?", lt: "Ar laimės solinis atlikėjas (ne duetas / grupė)?" },
  yes_short:             { en: "yes", lt: "taip" },
  no_short:              { en: "no", lt: "ne" },
  skip_short:            { en: "–", lt: "–" },
  no_country:            { en: "No country", lt: "Nė viena" },
  no_country_sub:        { en: "Nobody scores zero from the public.", lt: "Niekas negauna nulio iš žiūrovų." },
  selected_count:        { en: (n: number) => `${n} selected`, lt: (n: number) => `pasirinkta ${n}` },
  country_search:        { en: "Search country, artist or song", lt: "Ieškoti šalies, atlikėjo ar dainos" },
  no_matches:            { en: "No matches", lt: "Nieko nerasta" },
  finalists:             { en: "finalists", lt: "finalistai" },
  ballot_pick_for:       { en: (pts: number) => `${pts} ${pts === 1 ? "point" : "points"} go to…`, lt: (pts: number) => `${pts} ${ltPoints(pts)} keliauja` },
  ballot_pick_hint:      { en: "Tap to assign, it'll auto-swap if the country is already in another slot.", lt: "Pasirink šalį, kad skirtum jai taškus." },
  aria_drag_reorder:     { en: "Drag to reorder", lt: "Vilk perstumti" },

  // ── Leaderboard ──────────────────────────────────────────────────
  leaderboard:       { en: "Leaderboard", lt: "Lyderiai" },
  finished:          { en: "finished", lt: "užėmė" },
  ballot_label:      { en: "ballot", lt: "balsas" },
  bonuses_label:     { en: "bonuses", lt: "statymai" },
  breakdown_highlights: { en: "Chat highlights", lt: "Pokalbio akcentai" },
  breakdown_top_ten: { en: "TOP 10", lt: "TOP 10" },
  breakdown_home:    { en: "Home pick", lt: "Tėviškėlės pasirodymas" },
  breakdown_bets_sum: { en: "Bonus bets", lt: "Bonus statymai" },
  breakdown_total:   { en: "Total", lt: "Iš viso" },

  // ── Profile sheet ────────────────────────────────────────────────
  profile_you:               { en: "you", lt: "tu" },
  profile_stat_messages:     { en: "messages", lt: "žinutės" },
  profile_stat_loves:        { en: "loves", lt: "širdys" },
  profile_stat_highlights:   { en: "highlights", lt: "akcentai" },
  profile_stat_bingo:        { en: "bingos", lt: "bingo" },
  profile_stat_bets:         { en: "bets", lt: "statymai" },
  profile_stat_trivia:       { en: "trivia", lt: "viktorina" },
  profile_top_moment:        { en: "Top moment", lt: "Geriausia akimirka" },
  profile_top10_h:           { en: "TOP 10 ballot", lt: "TOP 10 balsas" },
  profile_top10_hidden:      { en: "Hidden until the host reveals results.", lt: "Nerodom, kol nepaskelbti rezultatai, kad nenusižiūrinėtum." },
  profile_top10_empty:       { en: "Hasn't voted yet.", lt: "Dar nebalsavo." },
  profile_top10_finished:    { en: (n: number) => `finished #${n}`, lt: (n: number) => `liko #${n}` },
  profile_top10_unranked:    { en: "out of top 10", lt: "už TOP 10" },

  // ── Trivia ───────────────────────────────────────────────────────
  trivia_eyebrow:            { en: "Trivia", lt: "Viktorina" },
  trivia_breaking:           { en: "Quick question!", lt: "Greitas klausimas!" },

  // ── Reactions / honeycomb ────────────────────────────────────────
};

// Sanity check: every entry must carry both languages (a typo in `en`/
// `lt` would otherwise slip through). Functions accept any args here on
// purpose, the precise signatures come from `typeof S` in `t()`.
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

// Like `t`, but the key is just a string (no compile-time check), for
// the few places where the key is data: chat system messages carry
// their i18n key in `meta.sysKey` and the recipient renders it in their
// own language. Falls back to the key itself if it isn't known.
export function tDyn(lang: Language, key: string, ...args: unknown[]): string {
  const entry = (S as Record<string, { en: Phrase; lt: Phrase }>)[key];
  if (!entry) return key;
  const value = entry[lang] ?? entry.en;
  return typeof value === "function"
    ? (value as (...a: unknown[]) => string)(...args)
    : value;
}

// Tiny templating: fmt("{home} placement", { home: "Lithuania" }) → "Lithuania placement".
export function fmt(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

// `readLang` / `writeLang` / `useLang` live in ./i18n-client.ts.
