// EN/LT translations for every user-facing string. Admin pages stay
// English on purpose (the admin is one or two power-users; not worth
// the maintenance overhead). The voter-side surface — NameGate,
// SettingsModal, RoomGate, Standings, Leaderboard, VoteForm,
// BonusBetsForm, CountryDrawer, FloatingReactions, scoreboard pops —
// reads from t() and switches the moment the user picks a language.

export type Language = "en" | "lt";
// Lithuanian first — this is the default language for the app and the
// picker should reflect that order.
export const LANGUAGES: Language[] = ["lt", "en"];
// Display name for each language, in its own language so the picker
// reads naturally regardless of which mode the user is currently in.
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "In English",
  lt: "Lietuviškai",
};
export const LANG_STORAGE_KEY = "uzk_lang";

export type MessageKey = keyof typeof messages.en;

const messages = {
  en: {
    // NameGate / SettingsModal
    welcome:           "Welcome",
    name_prompt:       "What should we call you in this room?",
    your_name:         "Your name",
    join_party:        "Join the party",
    pick_avatar:       "Pick an avatar",
    settings:          "Settings",
    language:          "Language",
    share_link:        "Share room link",
    save:              "Save",
    cancel:            "Cancel",
    clear:             "Clear",
    next:              "Next",
    back:              "Back",
    leave_room:        "Leave room",
    link_copied:       "Link copied",
    couldnt_copy:      "Couldn't copy link",

    // RoomGate (entrance code screen)
    enter_room_code:   "Enter room code",
    enter_room:        "Enter room",
    checking:          "Checking…",
    bad_code:          "No room with that code.",
    bad_format:        "Codes are 6 characters (A–Z, 2–9).",
    reconnecting:      "Reconnecting…",

    // Standings
    no_votes_yet:      "Standings are quiet",
    no_votes_sub:      "No one has voted yet. Be the first and the leaderboard fills up live as everyone joins in.",
    be_the_first:      "Be the first",
    show_top_5:        "Top 5 only",
    show_all:          "Show all",
    votes_cast:        "Votes cast",
    pts_short:         "pts",
    cast_vote:         "Cast your vote",
    update_vote:       "Update your vote",
    voting_closed:     "Voting is closed",
    voting_closed_sub: "The host hasn't opened voting yet. The standings page is still live.",
    voting_closed_live: "Voting locked — the show's on",
    voting_closed_ended: "Voting's over",
    voting_closed_ended_sub: "All ballots are in. Check the leaderboard to see how you did.",
    vote_open_now:     "Europe, start voting now!",
    vote_open_now_sub: "Lines are open — lock in your TOP 10.",
    vote_closing:      "Stop voting now!",
    vote_closing_sub:  "Lines are closing — last chance!",
    vote_closed_flash: "Voting closed",
    live:              "Live",
    standings:         "Standings",

    // VoteForm
    cast_your_vote:    "Cast your vote",
    your_top_10:       "Your TOP10",
    tap_to_pick:       "Tap to pick",
    drag_hint:         "Tap a slot to pick, drag to reorder.",
    submit_12:         "Submit my 12 points",
    pick_n_more:       (n: number) => `Pick ${n} more`,
    submitting:        "Submitting…",
    fill_n_more:       (n: number) => `Fill all 10 slots, ${n} to go.`,
    add_name_first:    "Add your name first.",
    voted_toast:       "Vote in. Long live music!",
    couldnt_submit:    "Couldn't submit vote.",

    // Tabs in vote form
    tab_ballot:        "Ballot",
    tab_bets:          "Bets",
    tab_rules:         "Rules",
    bonus_bets:        "Bonus bets",
    vote_cast_title:   "Your vote's cast! 🎉",
    vote_cast_body:    "Locked in automatically. Reorder any time — just tap Save to update.",
    vote_place_bets:   "Place your bets",
    vote_keep_editing: "Keep editing",
    vote_updated_toast: "Vote updated.",
    vote_unsaved:      "Unsaved reorder — tap Save to update your vote.",
    save_changes:      "Save changes",
    rules_title:       "How scoring works",
    rules_top10_h:     "Your TOP 10",
    rules_top10_b:     "Score the full Eurovision points (12, 10, 8…1) for every country you placed in the exact spot it finished. Off by a place or more? You get half of that slot's value, rounded down.",
    rules_home_h:      "Home-country placement",
    rules_home_b:      "Guess where your home country finishes: exact = 10 pts, off by 1 = 7, by 2 = 5, by 3–5 = 3, by 6–10 = 1, beyond that = 0.",
    rules_bets_h:      "Bonus bets",
    rules_bets_b:      "Each side bet is optional and pays out only if you nailed it: jury / televote winner +5, wooden spoon +5 (or +2 if your pick lands bottom-3), 12 from your country +5, best of the Big 5 +3, zero-from-televote +4 per correct pick (max 12), host top-3 +3, solo winner +2, plus a closeness-scored guess for your country's total points (up to +10). Skipped bets = 0.",
    rules_footer:      "Leaderboard updates the moment the host enters the official results.",

    // Room tab bar
    tab_home:          "Home",
    tab_chat:          "Chat",
    tab_bingo:         "Bingo",
    tab_vote:          "Vote",

    // Chat
    chat_empty:        "No messages yet. Say hi 👋",
    chat_placeholder:  "Message the room…",
    chat_load_earlier: "Load earlier messages",
    loading:           "Loading…",
    close:             "Close",
    chat_send:         "Send",
    chat_send_failed:  "Couldn't send your message.",
    chat_slow_down:    "Whoa — slow down a sec.",
    chat_delete_failed: "Couldn't delete that message.",
    chat_today:        "Today",
    chat_yesterday:    "Yesterday",
    chat_jump_bottom:  "Jump to latest",
    chat_new_messages: (n: number) => `${n} new message${n === 1 ? "" : "s"} ↓`,
    chat_typing_one:   (a: string) => `${a} is typing…`,
    chat_typing_two:   (a: string, b: string) => `${a} and ${b} are typing…`,
    chat_typing_many:  "Several people are typing…",
    chat_seen_by:      (n: number) => `Seen by ${n}`,
    chat_reply:        "Reply",
    chat_delete:       "Delete",
    chat_card:         "card",
    chat_edit:         "Edit",
    chat_edited:       "edited",
    chat_editing:      "Editing your message",
    chat_edit_placeholder: "Edit your message…",
    chat_edit_failed:  "Couldn't save your edit.",
    chat_save_edit:    "Save",
    chat_copy:         "Copy",
    chat_copied:       "Copied",
    gif_pick:          "Pick a GIF",
    gif_search:        "Search GIFs",
    gif_hint:          "Try \"omg\", \"yes\", \"fire\"…",
    chat_send_photo:   "Send a photo",
    chat_image_too_big: "Image is too large (max 8 MB).",
    chat_image_failed: "Couldn't upload that image.",
    gif_empty:         "No GIFs found.",

    // Country deep-dive
    deep_artist:       "Artist",
    deep_song:         "Song",
    deep_order:        "in running order",
    deep_watch:        "Watch the performance",

    // End-of-show reveal
    reveal_cta:        "Reveal my night",
    reveal_title:     "Your Eurovision night",
    reveal_done:      "Done",
    reveal_top10:     "Top 10 ballot",
    reveal_home:      (home: string) => `${home} placement`,
    reveal_home_total: (home: string) => `${home} total points`,
    reveal_wooden:    "Wooden spoon",
    reveal_lt12to:    (home: string) => `12 from ${home}`,
    reveal_big5:      "Best of the Big 5",
    reveal_jury:      "Jury winner",
    reveal_tele:      "Televote winner",
    reveal_nul:       "Zero from televote",
    reveal_host:      "Host top 3",
    reveal_solo:      "Solo winner",
    reveal_total:     "Your final score",

    // Social share
    share_picks:        "Share my TOP10",
    share_picks_caption: "Cast my Eurovision 2026 TOP10",

    // Now-playing strip
    now_playing:       "On stage",
    now_playing_idle:  "Waiting for the next country…",
    now_playing_admin: "Now playing",
    now_playing_clear: "Off stage",

    // Bingo
    bingo_title:       "Eurovision bingo",
    bingo_free:        "FREE",
    bingo_reset:       "Reset",
    bingo_won:         "BINGO!",
    bingo_you_did_it:  "You got bingo! 🎉",
    bingo_footer:      "Tap a square — or its line in the list — when it happens. Five in a row wins.",
    bingo_list:        "What to watch for",
    bingo_generate:    "New ticket",
    bingo_ticket:      "Ticket",
    bingo_remove_ticket: "Remove this ticket",

    // Notifications
    notifications:        "Notifications",
    push_unsupported:     "Push notifications aren't supported on this device.",
    push_blocked:         "Notifications are blocked.",
    push_install_required: "Install the app to enable notifications",
    push_how:             "How",
    push_enable:          "Turn on notifications",
    push_off:             "Off",
    push_on:              "Notifications on",
    push_disable:         "Turn off",
    push_enabled:         "Notifications enabled",
    push_denied:          "Permission denied",
    push_chat_all:        "All chat messages",
    push_chat_replies:    "Replies to my messages",
    push_now_playing:     "Country changes on stage",
    push_voting_state:    "Voting opens or closes",
    push_results_tallied: "Results are tallied",
    push_cta_title:       "Don't miss a beat",
    push_cta_sub:         "Get a ping when a country goes on stage, results land, or someone replies to you.",
    push_cta_enable:      "Turn on",

    // Notification install instructions
    push_help_ios_title:     "On iPhone / iPad",
    push_help_ios_1:         "Tap the Share button in Safari (the square with an arrow).",
    push_help_ios_2:         "Scroll down and tap \"Add to Home Screen\".",
    push_help_ios_3:         "Open the app from your Home Screen — not Safari.",
    push_help_ios_4:         "Come back here and turn on notifications.",
    push_help_android_title: "On Android",
    push_help_android_1:     "Tap the ⋮ menu in Chrome (or your browser).",
    push_help_android_2:     "Choose \"Install app\" or \"Add to Home Screen\".",
    push_help_android_3:     "Open the installed app and turn on notifications here.",
    push_help_desktop_title: "On desktop",
    push_help_desktop_1:     "Click the install icon in the address bar (or browser menu → Install).",
    push_help_desktop_2:     "Open the installed app and turn on notifications.",
    push_help_other_title:   "On this device",
    push_help_other_1:       "Add this site to your home screen, then come back and try again.",
    push_help_blocked_title: "Allow notifications in your browser",
    push_help_blocked_1:     "Open this site's permissions in your browser settings.",
    push_help_blocked_2:     "Change Notifications from Blocked to Ask or Allow.",
    push_help_blocked_3:     "Refresh this page and try again.",

    // Leave-room confirm
    leave_confirm:        "Leave this room?",
    leave_yes:            "Yes, leave",

    // Bonus bets — labels + descriptions
    bet_lt_placement:  "{home} placement",
    bet_lt_placement_sub:
      "Where does {home} finish? Closer guesses score more.",
    bet_wooden_spoon:  "Wooden spoon",
    bet_wooden_spoon_sub:
      "Who comes last? Even one off the bottom scores.",
    bet_lt_12_to:      "12 points from {home}",
    bet_lt_12_to_sub:
      "Which country gets {home}'s 12 points?",
    bet_big5:          "Best of the Big 5",
    bet_big5_sub:
      "UK, Germany, France, Italy or Spain — which finishes highest?",
    bet_jury_winner:   "Jury winner",
    bet_jury_winner_sub: "Country with the highest jury total.",
    bet_televote_winner: "Televote winner",
    bet_televote_winner_sub:
      "Country with the highest public televote total.",
    bet_nul:           "Zero from televote",
    bet_nul_sub:
      "Pick the countries you think get zero from the public — or 'No country' if you think no one will.",
    bet_lt_total:      "{home} total points",
    bet_lt_total_sub:
      "How many points (jury + public) does {home} end with? Closer guesses score more.",
    bet_host_top3:     "{host} top 3?",
    bet_host_top3_sub:
      "Will the host land in the top 3?",
    bet_solo_winner:   "Solo winner?",
    bet_solo_winner_sub:
      "Will the winner be a solo act?",
    yes_short:         "yes",
    no_short:          "no",
    skip_short:        "—",
    max_pts:           (n: number) => `max +${n}`,
    no_country:        "No country",
    selected_count:    (n: number) => `${n} selected`,
    done:              "Done",

    // Leaderboard
    leaderboard:       "Leaderboard",
    finished:          "finished",
    ballot_label:      "ballot",
    bonuses_label:     "bonuses",
    breakdown_total:   "Total",

    // Reactions / honeycomb
    react_with:        (e: string) => `React with ${e}`,
  },
  lt: {
    // NameGate / SettingsModal
    welcome:           "Labas!",
    name_prompt:       "Kaip tave vadinsim šitame kambary?",
    your_name:         "Tavo vardas",
    join_party:        "Prisijungti",
    pick_avatar:       "Pasirink veidą",
    settings:          "Nustatymai",
    language:          "Kalba",
    share_link:        "Pasidalink kambariu",
    save:              "Išsaugoti",
    cancel:            "Atšaukti",
    clear:             "Išvalyti",
    next:              "Toliau",
    back:              "Atgal",
    leave_room:        "Palikti kambarį",
    link_copied:       "Nuoroda nukopijuota",
    couldnt_copy:      "Nepavyko nukopijuoti",

    enter_room_code:   "Įvesk kambario kodą",
    enter_room:        "Įeiti",
    checking:          "Tikrinama…",
    bad_code:          "Nėra kambario tokiu kodu.",
    bad_format:        "Kodas — 6 simboliai (A–Z, 2–9).",
    reconnecting:      "Jungiamasi…",

    no_votes_yet:      "Lentelė tuščia",
    no_votes_sub:      "Niekas dar nebalsavo. Bakstelėk žemiau ir lentelė užsipildys realiu laiku, kai prisijungs kiti.",
    be_the_first:      "Būk pirmas",
    show_top_5:        "Tik TOP 5",
    show_all:          "Visi",
    votes_cast:        "Balsai",
    pts_short:         "tšk",
    cast_vote:         "Balsuok",
    update_vote:       "Pakeisk balsą",
    voting_closed:     "Balsavimas uždarytas",
    voting_closed_sub: "Šeimininkas dar neatidarė balsavimo. Rezultatų lentelė vis tiek gyva.",
    voting_closed_live: "Balsavimas užrakintas — vyksta šou",
    voting_closed_ended: "Balsavimas baigtas",
    voting_closed_ended_sub: "Visi balsai suskaičiuoti. Peržiūrėk lyderių lentelę.",
    vote_open_now:     "Europa, balsuok dabar!",
    vote_open_now_sub: "Linijos atviros — užfiksuok savo TOP 10.",
    vote_closing:      "Baik balsuoti — dabar!",
    vote_closing_sub:  "Linijos užsidaro — paskutinė proga!",
    vote_closed_flash: "Balsavimas uždarytas",
    live:              "Tiesiogiai",
    standings:         "Rezultatai",

    cast_your_vote:    "Balsavimas",
    your_top_10:       "Tavo TOP10",
    tap_to_pick:       "Bakstelėk pasirinkti",
    drag_hint:         "Bakstelėk vietą pasirinkti, vilk perstumti.",
    submit_12:         "Pateikti mano 12 taškų",
    pick_n_more:       (n: number) => `Dar ${n}`,
    submitting:        "Siunčiama…",
    fill_n_more:       (n: number) => `Užpildyk 10 vietų, dar ${n}.`,
    add_name_first:    "Pirma įvesk vardą.",
    voted_toast:       "Balsas užfiksuotas. Tegyvuoja muzika!",
    couldnt_submit:    "Nepavyko išsiųsti balso.",

    tab_ballot:        "Balsas",
    tab_bets:          "Statymai",
    tab_rules:         "Taisyklės",
    bonus_bets:        "Bonus statymai",
    vote_cast_title:   "Tavo balsas užfiksuotas! 🎉",
    vote_cast_body:    "Užfiksuota automatiškai. Pertvarkyk bet kada — tiesiog spausk Išsaugoti.",
    vote_place_bets:   "Statyk lažybas",
    vote_keep_editing: "Tęsti redagavimą",
    vote_updated_toast: "Balsas atnaujintas.",
    vote_unsaved:      "Neišsaugotas pertvarkymas — spausk Išsaugoti.",
    save_changes:      "Išsaugoti pakeitimus",
    rules_title:       "Kaip skaičiuojami taškai",
    rules_top10_h:     "Tavo TOP 10",
    rules_top10_b:     "Už kiekvieną šalį, pastatytą tiksliai į jos užimtą vietą, gauni pilnus Eurovizijos taškus (12, 10, 8…1). Jei pataikei ne į tą vietą — gauni pusę tos eilutės vertės, suapvalintą žemyn.",
    rules_home_h:      "Savo šalies vieta",
    rules_home_b:      "Atspėk, kelintas liks tavo šalis: tiksliai = 10 t., klysti 1 vieta = 7, 2 = 5, 3–5 = 3, 6–10 = 1, daugiau = 0.",
    rules_bets_h:      "Bonus statymai",
    rules_bets_b:      "Kiekvienas statymas neprivalomas ir užskaitomas tik pataikius: žiuri / žiūrovų nugalėtojas +5, paskutinė vieta +5 (arba +2, jei pasirinkimas patenka į paskutinius 3), 12 iš tavo šalies +5, geriausias iš Big 5 +3, nulis iš žiūrovų +4 už kiekvieną teisingą (maks. 12), šeimininkai TOP3 +3, solo nugalėtojas +2, plius artumo statymas dėl tavo šalies bendros taškų sumos (iki +10). Praleisti statymai = 0.",
    rules_footer:      "Lyderių lentelė atsinaujina, kai šeimininkas suveda oficialius rezultatus.",

    tab_home:          "Pradžia",
    tab_chat:          "Pokalbiai",
    tab_bingo:         "Bingo",
    tab_vote:          "Balsuok",

    chat_empty:        "Dar nieks nieko nerašė. Sveikink pirmas 👋",
    chat_placeholder:  "Rašyk kambariui…",
    chat_load_earlier: "Įkelti senesnes žinutes",
    loading:           "Įkeliama…",
    close:             "Uždaryti",
    chat_slow_down:    "Pala — neskubėk.",
    chat_delete_failed: "Nepavyko ištrinti žinutės.",
    chat_today:        "Šiandien",
    chat_yesterday:    "Vakar",
    chat_jump_bottom:  "Į naujausias",
    chat_new_messages: (n: number) => (n === 1 ? "1 nauja žinutė ↓" : `${n} naujų žinučių ↓`),
    chat_typing_one:   (a: string) => `${a} rašo…`,
    chat_typing_two:   (a: string, b: string) => `${a} ir ${b} rašo…`,
    chat_typing_many:  "Keli žmonės rašo…",
    chat_seen_by:      (n: number) => `Matė ${n}`,
    chat_send:         "Siųsti",
    chat_send_failed:  "Nepavyko išsiųsti žinutės.",
    chat_reply:        "Atsakyti",
    chat_delete:       "Ištrinti",
    chat_card:         "kortelė",
    chat_edit:         "Redaguoti",
    chat_edited:       "redaguota",
    chat_editing:      "Redaguoji žinutę",
    chat_edit_placeholder: "Redaguok žinutę…",
    chat_edit_failed:  "Nepavyko išsaugoti pakeitimo.",
    chat_save_edit:    "Išsaugoti",
    chat_copy:         "Kopijuoti",
    chat_copied:       "Nukopijuota",
    gif_pick:          "Pasirink GIF",
    gif_search:        "Ieškoti GIF",
    gif_hint:          "Bandyk „omg“, „taip“, „fire“…",
    chat_send_photo:   "Siųsti nuotrauką",
    chat_image_too_big: "Nuotrauka per didelė (maks. 8 MB).",
    chat_image_failed: "Nepavyko įkelti nuotraukos.",
    gif_empty:         "Nieko nerasta.",

    deep_artist:       "Atlikėjas",
    deep_song:         "Daina",
    deep_order:        "vieta tvarkaraštyje",
    deep_watch:        "Žiūrėti pasirodymą",

    reveal_cta:        "Atskleisk mano vakarą",
    reveal_title:     "Tavo Eurovizijos vakaras",
    reveal_done:      "Baigta",
    reveal_top10:     "TOP10 balsas",
    reveal_home:      (home: string) => `${home} vieta`,
    reveal_home_total: (home: string) => `${home} taškai iš viso`,
    reveal_wooden:    "Paskutinė vieta",
    reveal_lt12to:    (home: string) => `12 iš ${home}`,
    reveal_big5:      "Geriausias iš Big 5",
    reveal_jury:      "Žiuri nugalėtojas",
    reveal_tele:      "Žiūrovų nugalėtojas",
    reveal_nul:       "Nulis iš žiūrovų",
    reveal_host:      "Šeimininkai TOP3",
    reveal_solo:      "Solo nugalėtojas",
    reveal_total:     "Galutinis rezultatas",

    share_picks:        "Pasidalink savo TOP10",
    share_picks_caption: "Mano Eurovizijos 2026 TOP10",

    now_playing:       "Scenoje",
    now_playing_idle:  "Laukiama kitos šalies…",
    now_playing_admin: "Dabar scenoje",
    now_playing_clear: "Niekas",

    bingo_title:       "Eurovizijos bingo",
    bingo_free:        "LAISVA",
    bingo_reset:       "Iš naujo",
    bingo_won:         "BINGO!",
    bingo_you_did_it:  "Surinkai bingo! 🎉",
    bingo_footer:      "Bakstelėk laukelį — arba jo eilutę sąraše — kai įvyksta. Penki iš eilės — laimi.",
    bingo_list:        "Ko ieškoti",
    bingo_generate:    "Nauja kortelė",
    bingo_ticket:      "Kortelė",
    bingo_remove_ticket: "Pašalinti šią kortelę",

    notifications:        "Pranešimai",
    push_unsupported:     "Pranešimų ši naršyklė nepalaiko.",
    push_blocked:         "Pranešimai užblokuoti.",
    push_install_required: "Įdiek aplikaciją, kad gautum pranešimus",
    push_how:             "Kaip?",
    push_enable:          "Įjungti pranešimus",
    push_off:             "Išjungta",
    push_on:              "Pranešimai įjungti",
    push_disable:         "Išjungti",
    push_enabled:         "Pranešimai įjungti",
    push_denied:          "Leidimas nesuteiktas",
    push_chat_all:        "Visos pokalbių žinutės",
    push_chat_replies:    "Atsakymai į mano žinutes",
    push_now_playing:     "Šalis pasikeitė scenoje",
    push_voting_state:    "Balsavimas atidarytas ar uždarytas",
    push_results_tallied: "Suskaičiuoti rezultatai",
    push_cta_title:       "Niekur nepražiopsok",
    push_cta_sub:         "Sužinok, kai į sceną žengia šalis, paskelbiami rezultatai ar kažkas tau atrašo.",
    push_cta_enable:      "Įjungti",

    push_help_ios_title:     "„iPhone“ / „iPad“",
    push_help_ios_1:         "„Safari“ paspausk dalinimosi mygtuką (kvadratas su rodyklę).",
    push_help_ios_2:         "Nuslysk žemyn ir pasirink „Add to Home Screen“ (Pridėti į pagrindinį ekraną).",
    push_help_ios_3:         "Atidaryk programėlę iš pagrindinio ekrano — ne iš „Safari“.",
    push_help_ios_4:         "Grįžk čia ir įjunk pranešimus.",
    push_help_android_title: "„Android“",
    push_help_android_1:     "„Chrome“ (ar kitoje naršyklėje) paspausk ⋮ meniu.",
    push_help_android_2:     "Pasirink „Install app“ arba „Add to Home Screen“.",
    push_help_android_3:     "Atidaryk įdiegtą aplikaciją ir įjunk pranešimus.",
    push_help_desktop_title: "Kompiuteryje",
    push_help_desktop_1:     "Adreso juostoje paspausk įdiegimo ikoną (arba naršyklės meniu → „Install“).",
    push_help_desktop_2:     "Atidaryk įdiegtą aplikaciją ir įjunk pranešimus.",
    push_help_other_title:   "Šiame įrenginyje",
    push_help_other_1:       "Pridėk šį puslapį į pagrindinį ekraną ir bandyk dar kartą.",
    push_help_blocked_title: "Leisk pranešimus naršyklės nustatymuose",
    push_help_blocked_1:     "Atidaryk šios svetainės leidimus naršyklėje.",
    push_help_blocked_2:     "Pakeisk „Notifications“ iš „Blocked“ į „Ask“ arba „Allow“.",
    push_help_blocked_3:     "Atnaujink puslapį ir bandyk dar kartą.",

    leave_confirm:        "Tikrai palikti šitą kambarį?",
    leave_yes:            "Taip, palikti",

    bet_lt_placement:  "{home} vieta",
    bet_lt_placement_sub:
      "Kelintoje vietoje finišuos {home}? Kuo arčiau spėjai — tuo daugiau.",
    bet_wooden_spoon:  "Paskutinė vieta",
    bet_wooden_spoon_sub:
      "Kas užims paskutinę? Net spėjus gretimą — gauni taškų.",
    bet_lt_12_to:      "12 taškų iš {home}",
    bet_lt_12_to_sub:
      "Kuriai šaliai {home} skirs savo 12 taškų?",
    bet_big5:          "Geriausias iš Big 5",
    bet_big5_sub:
      "Iš JK, Vokietijos, Prancūzijos, Italijos, Ispanijos — kas finišuos aukščiausiai?",
    bet_jury_winner:   "Žiuri nugalėtojas",
    bet_jury_winner_sub: "Šalis, kuri surinks daugiausiai žiuri taškų.",
    bet_televote_winner: "Žiūrovų nugalėtojas",
    bet_televote_winner_sub:
      "Šalis, kuri surinks daugiausiai žiūrovų taškų.",
    bet_nul:           "Nulis iš žiūrovų",
    bet_nul_sub:
      "Spėk, kurios šalys gaus nulį iš žiūrovų. Jei manai, kad visos uždirbs — rink „Nė viena“.",
    bet_lt_total:      "{home} taškai iš viso",
    bet_lt_total_sub:
      "Kiek iš viso taškų (žiuri + žiūrovai) surinks {home}? Kuo arčiau, tuo daugiau.",
    bet_host_top3:     "{host} TOP3?",
    bet_host_top3_sub:
      "Ar šeimininkai pateks į TOP3?",
    bet_solo_winner:   "Laimės solo?",
    bet_solo_winner_sub:
      "Ar laimės solinis atlikėjas (ne duetas / grupė)?",
    yes_short:         "taip",
    no_short:          "ne",
    skip_short:        "—",
    max_pts:           (n: number) => `iki +${n}`,
    no_country:        "Nė viena",
    selected_count:    (n: number) => `pasirinkta ${n}`,
    done:              "Gerai",

    leaderboard:       "Lyderiai",
    finished:          "užėmė",
    ballot_label:      "balsas",
    bonuses_label:     "statymai",
    breakdown_total:   "Iš viso",

    react_with:        (e: string) => `Reaguoti su ${e}`,
  },
} as const;

type EnMessages = typeof messages.en;

// Overload so static keys (e.g. "save") return string and function-keys
// (e.g. "pick_n_more") still type-check when called.
export function t<K extends MessageKey>(
  lang: Language,
  key: K,
  ...args: EnMessages[K] extends (...a: infer A) => string ? A : []
): string {
  const map = (messages[lang] ?? messages.en) as EnMessages;
  const value = map[key] ?? messages.en[key];
  if (typeof value === "function") {
    return (value as (...a: unknown[]) => string)(...(args as unknown[]));
  }
  return value as string;
}

// Tiny templating: "{home} placement" + { home: "Lithuania" } -> "Lithuania placement".
export function fmt(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    String(vars[k] ?? `{${k}}`),
  );
}

// Custom event name dispatched alongside writes so the same tab updates
// without waiting for the cross-tab `storage` event (which only fires
// when ANOTHER tab modifies localStorage).
const LANG_CHANGE_EVENT = "uzk:lang-change";

export function readLang(): Language {
  if (typeof window === "undefined") return "lt";
  const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
  // LT is the default — this is a Lithuanian Eurovision party app
  // first, EN is for the international guest. Stored "en" wins; any
  // other value (including "lt" or absent) falls back to LT.
  return stored === "en" ? "en" : "lt";
}

export function writeLang(lang: Language): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  window.dispatchEvent(new CustomEvent(LANG_CHANGE_EVENT, { detail: lang }));
}

// Client-side hook. Reads the persisted language and subscribes to
// changes (same-tab via custom event, cross-tab via storage event).
import { useEffect, useState } from "react";

export function useLang(): Language {
  const [lang, setLang] = useState<Language>("lt");
  useEffect(() => {
    setLang(readLang());
    const onChange = () => setLang(readLang());
    window.addEventListener(LANG_CHANGE_EVENT, onChange);
    window.addEventListener("storage", (e) => {
      if (e.key === LANG_STORAGE_KEY) onChange();
    });
    return () => {
      window.removeEventListener(LANG_CHANGE_EVENT, onChange);
    };
  }, []);
  return lang;
}
