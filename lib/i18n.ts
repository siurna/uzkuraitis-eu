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
// ─────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";

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

const S = {
  // ── NameGate / SettingsModal ─────────────────────────────────────
  welcome:           { en: "Welcome", lt: "Labas!" },
  name_prompt:       { en: "What should we call you in this room?", lt: "Kaip į tave kreiptis?" },
  your_name:         { en: "Your name", lt: "Tavo vardas" },
  join_party:        { en: "Join the party", lt: "Pradėti vakarėlį" },
  pick_avatar:       { en: "Pick an avatar", lt: "Pasirink avatarą" },
  settings:          { en: "Settings", lt: "Nustatymai" },
  language:          { en: "Language", lt: "Kalba" },
  share_link:        { en: "Share room link", lt: "Pasidalinti nuoroda" },
  save:              { en: "Save", lt: "Išsaugoti" },
  cancel:            { en: "Cancel", lt: "Atšaukti" },
  clear:             { en: "Clear", lt: "Išvalyti" },
  next:              { en: "Next", lt: "Toliau" },
  back:              { en: "Back", lt: "Atgal" },
  done:              { en: "Done", lt: "Gerai" },
  close:             { en: "Close", lt: "Uždaryti" },
  loading:           { en: "Loading…", lt: "Įkeliama…" },
  leave_room:        { en: "Leave room", lt: "Palikti kambarį" },
  leave_confirm:     { en: "Leave this room?", lt: "Tikrai nori palikti šitą kambarį?" },
  leave_confirm_sub: { en: "You can rejoin with the room link any time.", lt: "Jei turi nuorodą, grįžti galėsi bet kada." },
  leave_confirm_body: { en: "Your name, avatar and ballot stay on this device, leaving just takes you back to the entrance. You'll need the room code or link to come back.", lt: "Tavo vardas, veidas ir balsas lieka šiame įrenginyje, palikęs grįši į pradžios ekraną. Norėdamas grįžti, naudok kambario kodą ar nuorodą." },
  leave_yes:         { en: "Leave room", lt: "Palikti kambarį" },
  link_copied:       { en: "Link copied", lt: "Nuoroda nukopijuota" },
  couldnt_copy:      { en: "Couldn't copy link", lt: "Nepavyko nukopijuoti" },

  // ── RoomGate (entrance code screen) ──────────────────────────────
  enter_room:        { en: "Enter room", lt: "Įeiti" },
  checking:          { en: "Checking…", lt: "Tikrinama…" },
  bad_code:          { en: "No room with that code.", lt: "Nėra kambario tokiu kodu." },
  bad_format:        { en: "Codes are 6 characters (A–Z, 2–9).", lt: "Kodas, 6 simboliai (A–Z, 2–9)." },
  reconnecting:      { en: "Reconnecting…", lt: "Jungiamasi…" },

  // ── Standings ────────────────────────────────────────────────────
  no_votes_yet:      { en: "Standings are quiet", lt: "Lentelė tuščia. Gerbėjai tyli." },
  no_votes_sub:      { en: "No one has voted yet. Be the first and the leaderboard fills up live as everyone joins in.", lt: "Niekas dar nebalsavo. Būk pirmas! Lentelė užsipildys realiu laiku, kai prisijungs kiti." },
  be_the_first:      { en: "Be the first", lt: "Būk pirmas" },
  fan_top5:          { en: "Fan TOP5", lt: "Vakarėlio TOP5" },
  see_all:           { en: "See all", lt: "Žiūrėti visus" },
  pts_short:         { en: "pts", lt: "tšk" },
  standings:         { en: "Standings", lt: "Rezultatai" },
  live:              { en: "Live", lt: "Tiesiogiai" },

  // ── Voting open/closed states + the on-air banners ───────────────
  update_vote:       { en: "Update your vote", lt: "Pakeisti balsą" },
  voting_closed:     { en: "Voting locked", lt: "Balsavimas užrakintas" },
  vote_open_now:     { en: "Europe, start voting now!", lt: "Europa, balsuok dabar!" },
  vote_closing:      { en: "Stop voting now!", lt: "Balsavimas baigtas!" },

  // ── VoteForm ─────────────────────────────────────────────────────
  your_top_10:       { en: "My TOP10", lt: "Mano TOP10" },
  tap_to_pick:       { en: "Pick", lt: "Pasirink" },
  pick_n_more:       { en: (n: number) => `Pick ${n} more`, lt: (n: number) => `Dar ${n}` },
  submitting:        { en: "Submitting…", lt: "Siunčiama…" },
  fill_n_more:       { en: (n: number) => `Fill all 10 slots, ${n} to go.`, lt: (n: number) => `Užpildyk visas 10 vietų, dar ${n}.` },
  add_name_first:    { en: "Add your name first.", lt: "Pirma įvesk vardą." },
  couldnt_submit:    { en: "Couldn't submit vote.", lt: "Nepavyko išsiųsti balso." },
  tab_ballot:        { en: "Ballot", lt: "Balsavimas" },
  tab_bets:          { en: "Guesses", lt: "Spėjimai" },
  tab_rules:         { en: "Rules", lt: "Taisyklės" },
  vote_cast_title:   { en: "Your vote's cast! 🎉", lt: "Tavo balsas užfiksuotas! 🎉" },
  vote_cast_body:    { en: "Locked in automatically. Reorder any time, just tap Save to update.", lt: "Išsaugota automatiškai. Keisk eilę bet kada iki balsavimo pabaigos, tiesiog nepamiršk paspaust Išsaugoti." },
  vote_place_bets:   { en: "Place your bets", lt: "Užpildyk spėjimus" },
  vote_keep_editing: { en: "Keep editing", lt: "Tęsti redagavimą" },

  // ── Rules tab (scoring explainer) ────────────────────────────────
  rules_title:       { en: "How scoring works", lt: "Kaip skaičiuojami taškai" },
  rules_top10_h:     { en: "Your TOP 10", lt: "Tavo TOP 10" },
  rules_top10_b:     { en: "Only countries that finish in the official Top 10 score anything. Place one in the exact spot it finished and you bank its full Eurovision points (12, 10, 8…1). Off by a place? Slide one rung down the scoreboard: a country that came 1st but you ranked 3rd scores 8 (3rd place's value), and sliding past 10th means 0.", lt: "Taškus skiria tik šalys, patekusios į oficialų TOP 10. Šalis, pastatyta tiksliai į jos užimtą vietą, surenka pilnus Eurovizijos taškus (12, 10, 8…1). Klysti viena vieta? Nuslysti viena pakopa žemyn lentelėje: jei šalis liko 1-a, o tu ją pastatei 3-ią, gauni 8 (3-ios vietos vertę). Nuslydęs už 10-os negausi nieko." },
  rules_top10_eg:    { en: "A country that finished 1st, scored by how far off your ranking was:", lt: "1-ą vietą užėmusi šalis: kiek taškų gausi pagal įvertinimo tikslumą:" },
  rules_home_h:      { en: "Home-country placement", lt: "Savo šalies vieta" },
  rules_home_b:      { en: "Guess where {home} finishes. Nail it and that's 12 points; every place you're off slides you one rung down the Eurovision ladder (12 → 10 → 8 → 7 … 1):", lt: "Atspėk, kelintas liks {home}. Pataikei tiksliai, 12 taškų; už kiekvieną netaiklią vietą nuslysti pakopa žemyn Eurovizijos skale (12 → 10 → 8 → 7 … 1):" },
  rules_bets_h:      { en: "Bonus bets", lt: "Bonus statymai" },
  rules_bets_intro:  { en: "Every bet is optional. You only score if you call it right; a skipped bet is just 0.", lt: "Kiekvienas statymas neprivalomas. Taškų gauni tik pataikęs; praleistas statymas tiesiog 0." },
  rules_highlights_b:{ en: "When a chat message you sent picks up enough reactions it becomes a highlight: +2 points each, up to +12. (You have to have voted to score.)", lt: "Kai tavo žinutė pokalbyje surenka pakankamai reakcijų, ji tampa akcentu: po +2 t., iki +12. Taškai skaičiuojami tik balsavusiems." },

  // ── Room tab bar ─────────────────────────────────────────────────
  tab_home:          { en: "Home", lt: "Pradžia" },
  tab_chat:          { en: "Chat", lt: "Pokalbiai" },
  tab_bingo:         { en: "Bingo", lt: "Bingo" },
  tab_vote:          { en: "Vote", lt: "Balsuok" },

  // ── Home banners (context-aware shortcuts) ───────────────────────
  home_vote_open:      { en: "Voting is open, cast your TOP 10", lt: "Balsavimas atidarytas, paskelbk savo TOP 10" },
  home_vote_open_sub:  { en: "Lines won't be open forever, get it in.", lt: "Linijos neilgai bus atviros, nežiopsok." },
  home_vote_done:      { en: "Your vote's in, reorder it anytime", lt: "Tavo balsas užfiksuotas" },
  home_vote_done_eyebrow: { en: "Voted", lt: "Balsuota" },
  home_vote_done_sub:  { en: "Place bets, share your TOP 10, or tweak.", lt: "Dalyvauk spėlionėje, pasidalink TOP 10." },
  home_vote_soon:      { en: "Voting opens soon", lt: "Balsavimas netrukus" },
  home_vote_soon_sub:  { en: "Line up your TOP 10, you can lock it the moment lines open.", lt: "Susidėliok TOP 10, užfiksuosi vos atsidarius linijoms." },
  home_bonus_placed:   { en: (n: number) => `${n} side ${n === 1 ? "bet" : "bets"} placed`, lt: (n: number) => `pastatyta ${n}` },
  home_bonus_none:     { en: "Place your side bets", lt: "Sudaryk savo statymus" },
  home_bonus_sub:      { en: "Wooden spoon, jury winner, nul points… each pays out only if you call it.", lt: "Paskutinė vieta, žiuri nugalėtojas, nulis taškų… užskaitoma tik pataikius." },
  home_vs_room:        { en: "You vs the room", lt: "Tu prieš kitus" },
  home_vs_room_rank:   { en: (n: number) => `Your #1, the room ranks it #${n}`, lt: (n: number) => `Tavo Nr.1, kiti vertina ją #${n}` },
  home_vs_room_agree:  { en: "You and the room agree, it's on top!", lt: "Tu ir kiti sutariate, ji pirmoji!" },
  home_vs_room_bold:   { en: (n: number) => `Bold pick, the room has it way down at #${n}`, lt: (n: number) => `Drąsu, kiti ją laiko net #${n}` },
  home_vs_room_pending:{ en: "Your #1, waiting for more ballots", lt: "Tavo Nr.1, laukiam daugiau balsų" },
  home_vs_room_empty_title: { en: "How do you stack up?", lt: "Kaip atrodai prieš kitus?" },
  home_vs_room_empty_sub:   { en: "Cast your TOP 10 to compare with the room.", lt: "Balsuok ir palygink savo TOP 10 su kitais." },
  home_results:        { en: "Results are in", lt: "Rezultatai jau čia" },
  home_bingo_sub:      { en: "Tick off the clichés as they happen", lt: "Žymėk klišes, kai jos įvyksta" },
  home_bingo_progress: { en: (n: number) => `${n} / 25 ticked`, lt: (n: number) => `pažymėta ${n} / 25` },
  home_bingo_won:      { en: "Bingo! 🎉 Tap to see your card", lt: "Bingo! 🎉 Bakstelėk savo kortelę" },
  bingo_widget_title:  { en: "Play bingo!", lt: "Žaisk bingo!" },
  highlights_title:    { en: "Highlights of the evening", lt: "Vakaro akcentai" },
  whos_here_title:     { en: (n: number) => (n === 1 ? "Just you here" : `${n} here right now`), lt: (n: number) => (n === 1 ? "Kol kas tik tu" : `${n} čia dabar`) },
  home_my_results:     { en: "Your results", lt: "Tavo rezultatai" },
  home_results_in:     { en: "Results are in", lt: "Rezultatai jau čia" },
  home_results_in_sub: { en: "See how everyone did", lt: "Pažiūrėk, kaip visiems sekėsi" },
  home_my_results_rank: { en: (rank: number, total: number) => `Ranked ${rank} of ${total}, tap for the breakdown`, lt: (rank: number, total: number) => `${rank} vieta iš ${total}, bakstelėk išklotinei` },
  results_tab_me:      { en: "My breakdown", lt: "Mano išklotinė" },
  results_tab_board:   { en: "Leaderboard", lt: "Lyderių lentelė" },

  // ── Chat ─────────────────────────────────────────────────────────
  chat_empty:        { en: "No messages yet. Say hi 👋", lt: "Dar nieks nieko nerašė. Pasisveikink pirmas 👋" },
  chat_placeholder:  { en: "Message", lt: "Tavo žinutė" },
  chat_load_earlier: { en: "Load earlier messages", lt: "Įkelti senesnes žinutes" },
  chat_send_failed:  { en: "Couldn't send your message.", lt: "Nepavyko išsiųsti žinutės." },
  chat_slow_down:    { en: "Whoa, slow down a sec.", lt: "Pala, neskubėk." },
  chat_delete_failed: { en: "Couldn't delete that message.", lt: "Nepavyko ištrinti žinutės." },
  chat_today:        { en: "Today", lt: "Šiandien" },
  chat_yesterday:    { en: "Yesterday", lt: "Vakar" },
  chat_jump_bottom:  { en: "To bottom", lt: "Į apačią" },
  chat_new_pill:     { en: "New messages!", lt: "Naujos žinutės!" },
  chat_typing_one:   { en: (a: string) => `${a} is typing…`, lt: (a: string) => `${a} rašo…` },
  chat_typing_two:   { en: (a: string, b: string) => `${a} and ${b} are typing…`, lt: (a: string, b: string) => `${a} ir ${b} rašo…` },
  chat_typing_many:  { en: "Several people are typing…", lt: "Keli žmonės rašo…" },
  chat_seen_by:      { en: (n: number) => `Seen by ${n}`, lt: (n: number) => `Matė ${n}` },
  chat_reply:        { en: "Reply", lt: "Atsakyti" },
  chat_delete:       { en: "Delete", lt: "Ištrinti" },
  chat_card:         { en: "card", lt: "kortelė" },
  // System (meta-narration) chat messages, rendered in the recipient's
  // language from meta.sysKey. The server still stores the EN text in
  // `body` for back-compat / debuggability.
  sys_voted:         { en: (name: string) => `🗳️ ${name} cast their vote`, lt: (name: string) => `🗳️ ${name} atidavė savo balsą` },
  sys_voting_open:   { en: "📣 Voting is OPEN, cast your TOP10!", lt: "📣 Balsavimas ATIDARYTAS, užfiksuok savo TOP10!" },
  sys_voting_closed: { en: "🔒 Voting is CLOSED.", lt: "🔒 Balsavimas UŽDARYTAS." },
  sys_show_started:  { en: "🟢 The show is underway, Europe, get ready!", lt: "🟢 Šou prasidėjo, Europa, pasiruošk!" },
  sys_show_break:    { en: "⏸ Interval break. Stretch those legs.", lt: "⏸ Pertrauka. Pajudink kojas." },
  sys_show_ended:    { en: "🏁 Performances are over. Time to vote!", lt: "🏁 Pasirodymai baigti. Laikas balsuoti!" },
  sys_show_doors:    { en: "🎬 Doors open, the show hasn't started yet.", lt: "🎬 Durys atvertos, šou dar neprasidėjo." },
  sys_results_in:    { en: "🏆 Results are in, leaderboard's live!", lt: "🏆 Rezultatai jau čia, lyderių lentelė gyva!" },
  chat_edit:         { en: "Edit", lt: "Redaguoti" },
  chat_edited:       { en: "edited", lt: "redaguota" },
  chat_editing:      { en: "Editing your message", lt: "Redaguoji žinutę" },
  chat_edit_placeholder: { en: "Edit your message…", lt: "Redaguok žinutę…" },
  chat_edit_failed:  { en: "Couldn't save your edit.", lt: "Nepavyko išsaugoti pakeitimo." },
  chat_copy:         { en: "Copy", lt: "Kopijuoti" },
  chat_copied:       { en: "Copied", lt: "Nukopijuota" },
  chat_send_photo:   { en: "Send a photo", lt: "Siųsti nuotrauką" },
  chat_image_too_big: { en: "Image is too large (max 8 MB).", lt: "Nuotrauka per didelė (maks. 8 MB)." },
  chat_image_failed: { en: "Couldn't upload that image.", lt: "Nepavyko įkelti nuotraukos." },
  chat_drop_image:   { en: "Drop the image to send it", lt: "Nuvilk nuotrauką, kad išsiųstum" },
  gif_pick:          { en: "Pick a GIF", lt: "Pasirink GIF" },
  gif_search:        { en: "Search GIFs", lt: "Ieškoti GIF" },
  gif_hint:          { en: 'Try "omg", "yes", "fire"…', lt: "Bandyk „omg“, „taip“, „fire“…" },
  gif_empty:         { en: "No GIFs found.", lt: "Nieko nerasta." },

  // ── Country deep-dive ────────────────────────────────────────────
  deep_artist:       { en: "Artist", lt: "Atlikėjas" },
  deep_song:         { en: "Song", lt: "Daina" },

  // ── End-of-show reveal ───────────────────────────────────────────
  reveal_cta:        { en: "Reveal my night", lt: "Kaip man sekėsi?" },
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
  share_picks:        { en: "Share my TOP10", lt: "Dalinkis savo TOP10" },
  share_eyebrow:      { en: "Show it off", lt: "Pasigirk" },
  share_picks_sub:    { en: "A shareable card of your ranking, straight to Stories or chat", lt: "Bendrinama tavo TOP10 kortelė, tiesiai į Stories ar pokalbį" },
  share_picks_caption: { en: "Cast my Eurovision 2026 TOP10", lt: "Mano Eurovizijos 2026 TOP10" },
  share_preparing:    { en: "Preparing image…", lt: "Ruošiamas paveikslėlis…" },
  share_image_copied: { en: "Image copied, paste it anywhere", lt: "Paveikslėlis nukopijuotas, įklijuok bet kur" },
  share_failed:       { en: "Couldn't prepare the share image", lt: "Nepavyko paruošti paveikslėlio" },

  // ── Now-playing strip ────────────────────────────────────────────
  now_playing:       { en: "On stage", lt: "Scenoje" },
  np_add_top10:      { en: "TOP 10", lt: "TOP 10" },
  np_drawer_title:   { en: (c: string) => `Add ${c} to your TOP 10`, lt: (c: string) => `Įtraukti ${c} į tavo TOP 10` },
  np_drawer_sub:     { en: "Tap a spot, the picks below it slide down a notch.", lt: "Bakstelėk vietą, žemiau esantys pasislenka per vieną." },
  np_drawer_here:    { en: "current spot", lt: "dabar čia" },
  np_empty:          { en: "Empty", lt: "Tuščia" },

  // ── Bingo ────────────────────────────────────────────────────────
  bingo_you_did_it:  { en: "You got bingo! 🎉", lt: "Surinkai bingo! 🎉" },
  bingo_list:        { en: "What to watch for", lt: "Ko ieškoti" },
  bingo_generate:    { en: "New ticket", lt: "Nauja kortelė" },
  bingo_ticket:      { en: "Ticket", lt: "Kortelė" },
  bingo_remove_ticket: { en: "Remove this ticket", lt: "Pašalinti šią kortelę" },
  bingo_remove_confirm: { en: "Remove this ticket?", lt: "Pašalinti šią kortelę?" },
  bingo_remove_confirm_sub: { en: "This can't be undone.", lt: "To nebebus galima atšaukti." },
  bingo_remove_confirm_body: { en: "The squares you've struck on this ticket will be lost. Your other tickets stay.", lt: "Šios kortelės pažymėti langeliai dings. Kitos tavo kortelės liks." },

  // ── Notifications ────────────────────────────────────────────────
  notifications:        { en: "Notifications", lt: "Pranešimai" },
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
  push_chat_all_sub:    { en: "Every message in the room thread.", lt: "Kiekviena žinutė kambario pokalbyje." },
  push_chat_replies:    { en: "Replies to my messages", lt: "Atsakymai į mano žinutes" },
  push_chat_replies_sub: { en: "When someone replies to or @-mentions you.", lt: "Kai kažkas atsako ar pamini tave su @." },
  push_now_playing:     { en: "Country changes on stage", lt: "Kai keičiasi šalis scenoje" },
  push_now_playing_sub: { en: "A ping each time a new act takes the stage.", lt: "Pranešimas kiekvienąkart, kai į sceną žengia naujas atlikėjas." },
  push_voting_state:    { en: "Voting opens or closes", lt: "Balsavimas atidarytas ar uždarytas" },
  push_voting_state_sub: { en: "So you don't miss the window to cast your TOP 10.", lt: "Kad nepražiopsotum laiko balsuoti už savo TOP 10." },
  push_results_tallied: { en: "Results are tallied", lt: "Suskaičiuoti rezultatai" },
  push_results_tallied_sub: { en: "When the host enters the official results.", lt: "Kai šeimininkas suveda oficialius rezultatus." },
  push_cta_title:       { en: "Don't miss a beat", lt: "Niekur nepražiopsok" },
  push_cta_sub:         { en: "Get a ping when a country goes on stage, results land, or someone replies to you.", lt: "Sužinok, kai į sceną žengia šalis, paskelbiami rezultatai ar kažkas tau atrašo." },
  push_cta_enable:      { en: "Turn on", lt: "Įjungti" },

  // ── Notification install instructions ────────────────────────────
  push_help_ios_title:     { en: "On iPhone / iPad", lt: "„iPhone“ / „iPad“" },
  push_help_ios_1:         { en: "Tap the Share button in Safari (the square with an arrow).", lt: "„Safari“ paspausk dalinimosi mygtuką (kvadratas su rodyklę)." },
  push_help_ios_2:         { en: 'Scroll down and tap "Add to Home Screen".', lt: "Nuslysk žemyn ir pasirink „Add to Home Screen“ (Pridėti į pagrindinį ekraną)." },
  push_help_ios_3:         { en: "Open the app from your Home Screen, not Safari.", lt: "Atidaryk programėlę iš pagrindinio ekrano, ne iš „Safari“." },
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

  // ── Bonus bets, labels + descriptions. `{home}` / `{host}` get
  //    substituted with fmt(). ──────────────────────────────────────
  bet_lt_placement:      { en: "{home} placement", lt: "Kurią vietą užims {home}?" },
  bet_lt_placement_sub:  { en: "Where does {home} finish? Closer guesses score more.", lt: "Kuo tiksliau atspėji, tuo tau geriau." },
  bet_wooden_spoon:      { en: "Wooden spoon", lt: "Paskutinė vieta" },
  bet_wooden_spoon_sub:  { en: "Who comes dead last? Land one place off the bottom and you still bank +2.", lt: "Kas namo parsiveš medinį šaukštą? Pataikęs vieną vietą pro šalį, vis tiek gauni +2." },
  bet_lt_12_to:          { en: "12 points from {home}", lt: "{home} 12 taškų skirs..." },
  bet_lt_12_to_sub:      { en: "Which country gets {home}'s 12 points?", lt: "Kuriai šaliai {home} skirs savo 12 taškų?" },
  bet_big5:              { en: "Best of the Big 5", lt: "Geriausias iš Big 5" },
  bet_big5_sub:          { en: "UK, Germany, France, Italy or Spain, which finishes highest?", lt: "Iš JK, Vokietijos, Prancūzijos, Italijos, Ispanijos (haha), kas finišuos aukščiausiai?" },
  bet_jury_winner:       { en: "Jury winner", lt: "Žiuri nugalėtojas" },
  bet_jury_winner_sub:   { en: "Country with the highest jury total.", lt: "Šalis, kuri surinks daugiausiai žiuri taškų." },
  bet_televote_winner:   { en: "Televote winner", lt: "Žiūrovų nugalėtojas" },
  bet_televote_winner_sub: { en: "Country with the highest public televote total.", lt: "Šalis, kuri surinks daugiausiai žiūrovų taškų." },
  bet_nul:               { en: "Zero from televote", lt: "Nulis iš žiūrovų" },
  bet_nul_sub:           { en: "Pick up to 5 countries you think get zero from the public, +4 for each right (capped at +12). Or 'No country' if you reckon everyone scores.", lt: "Pasirink iki 5 šalių, kurios, tavo manymu, gaus nulį iš žiūrovų, po +4 už kiekvieną teisingą (daugiausiai +12). Arba „Nė viena“, jei manai, kad visos ką nors uždirbs." },
  bet_lt_total:          { en: "{home} total points", lt: "{home} surinks..." },
  bet_lt_total_sub:      { en: "How many points (jury + public) does {home} end with? Closer guesses score more.", lt: "Kiek iš viso taškų (žiuri + žiūrovai) surinks {home}? Kuo arčiau, tuo daugiau." },
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
  ballot_pick_hint:      { en: "Tap to assign, it'll auto-swap if the country is already in another slot.", lt: "Pasirink šalį, kad priskirtum taškus." },
  aria_drag_reorder:     { en: "Drag to reorder", lt: "Vilk perstumti" },

  // ── Leaderboard ──────────────────────────────────────────────────
  leaderboard:       { en: "Leaderboard", lt: "Lyderiai" },
  finished:          { en: "finished", lt: "užėmė" },
  ballot_label:      { en: "ballot", lt: "balsas" },
  bonuses_label:     { en: "bonuses", lt: "statymai" },
  breakdown_highlights: { en: "Chat highlights", lt: "Pokalbio akcentai" },
  breakdown_total:   { en: "Total", lt: "Iš viso" },

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
