/* Music Library — jazz, blues, popular styles, African, Latin and world music systems. */

export default [
  {
    id: 'blues', section: 'styles', title: 'The blues', level: 1,
    summary: 'The 12-bar form, blue notes and call and response.',
    simple: [
      'The **blues** grew from African American work songs, spirituals and field hollers in the Deep South. It shaped jazz, rock and roll, R&B, soul, rock and hip-hop.',
      'The **12-bar blues** repeats this chord plan (in A: I = A7, IV = D7, V = E7):',
      { table: { head: ['Bars 1–4', 'Bars 5–8', 'Bars 9–12'], rows: [['I · I · I · I', 'IV · IV · I · I', 'V · IV · I · V (turnaround)']] } },
      { example: { type: 'progression', tonic: 'A3', numerals: 'I7 I7 I7 I7 IV7 IV7 I7 I7 V7 IV7 I7 V7', beats: 2 } },
      'Lyrics often follow **AAB**: a line, the line repeated, then an answering line. Melodies use the blues scale and bend notes between major and minor.',
    ],
    deep: [
      'Variants: the **quick change** (IV in bar 2), **8-bar** and **16-bar** blues, **minor blues** (i–iv–i–♭VI7–V7–i), and the **jazz blues** with ii–V turnarounds and passing chords (“Bird blues” adds descending ii–V chains). All three primary chords are dominant sevenths, which violates common-practice function but defines the style.',
      'African retentions include call-and-response, blue-note inflection, riff-based repetition, emphasis on timbre (growls, slides) and cross-rhythm; scholars such as Gerhard Kubik link Delta blues vocal style to the Sahel and savanna traditions of West Africa.',
    ],
    related: ['pentatonic-blues', 'jazz-harmony', 'common-progressions', 'african-music'],
  },
  {
    id: 'jazz-harmony', section: 'jazz', title: 'Jazz harmony essentials', level: 3,
    summary: 'ii–V–I, seventh chords everywhere, guide tones and turnarounds.',
    simple: [
      'Jazz uses **seventh chords** as the basic sound and loves the **ii–V–I** progression: in C, Dm7 – G7 – Cmaj7. Learn it in all twelve keys and you can play much of the jazz repertoire.',
      { example: { type: 'progression', tonic: 'C4', numerals: 'ii7 V7 Imaj7', choose: ['ii7 V7 Imaj7', 'iiø7 V7 i', 'Imaj7 vi7 ii7 V7', 'iii7 VI7 ii7 V7'] } },
      'The **3rd and 7th** of each chord (the **guide tones**) move smoothly by step through a ii–V–I; playing just those shows the harmony clearly.',
    ],
    deep: [
      'Minor ii–V–i uses iiø7 – V7(♭9) – im(maj7) or im6. **Turnarounds**: I–vi–ii–V, iii–VI–ii–V, and substitutions (I–♭III7–♭VI7–♭II7, the “Lady Bird” turnaround). **Backdoor** ii–V: iv7–♭VII7–I. **Deceptive resolutions** and chains of ii–Vs moving by whole or half step (“Tune Up”, “Joy Spring”).',
      'Standard forms: 12-bar blues, 32-bar AABA (“rhythm changes”, “Satin Doll”), ABAC (“All of Me”). Harmonic language evolved from New Orleans triads and sixths, through swing-era 6th and 9th chords and bebop’s altered dominants, to modal, post-bop and contemporary harmony.',
    ],
    related: ['chord-scale-theory', 'tritone-substitution', 'voicings', 'bebop-language', 'modal-jazz'],
  },
  {
    id: 'chord-scale-theory', section: 'jazz', title: 'Chord–scale theory', level: 4,
    summary: 'Matching a scale to every chord for improvisation.',
    simple: [
      'Chord–scale theory pairs each chord with a scale you can improvise with: over Dm7 use D Dorian, over G7 use G Mixolydian, over Cmaj7 use C Ionian (or Lydian).',
    ],
    deep: [
      { table: { head: ['Chord', 'Common scale(s)'], rows: [['maj7', 'Ionian, Lydian (♯11)'], ['m7', 'Dorian, Aeolian, Phrygian (context)'], ['7', 'Mixolydian, Lydian dominant (♯11), bebop dominant'], ['7alt', 'Altered (7th mode of melodic minor)'], ['7♭9', 'Half–whole diminished, Phrygian dominant'], ['m7♭5', 'Locrian, Locrian ♮2'], ['dim7', 'Whole–half diminished'], ['m(maj7)', 'Melodic minor, harmonic minor'], ['7♯5', 'Whole tone'], ['sus4 / 7sus4', 'Mixolydian, Dorian ♭2 for sus♭9']] } },
      'Codified at Berklee (from the 1950s) and in George Russell’s *Lydian Chromatic Concept*, chord–scale theory is a teaching tool. Players also think in chord tones and targets, motifs, and the bebop tradition of approaching chord tones on strong beats.',
    ],
    related: ['modes', 'melodic-minor-modes', 'jazz-harmony', 'altered-chords'],
  },
  {
    id: 'tritone-substitution', section: 'jazz', title: 'Tritone substitution and reharmonisation', level: 4,
    summary: 'Replace a V7 with the dominant a tritone away.',
    simple: [
      'A **tritone sub** replaces a dominant chord with the dominant a tritone (three whole steps) away: instead of G7 → C, play D♭7 → C. The bass slides down by half step, and the two chords share their most important notes.',
      { example: { type: 'progression', tonic: 'C4', numerals: 'ii7 V7 Imaj7', compare: 'ii7 bII7 Imaj7' } },
    ],
    deep: [
      'G7 and D♭7 share the tritone B–F (C♭–F): each chord’s 3rd is the other’s 7th. The sub’s natural tensions are the altered tensions of the original (D♭7’s 9th, E♭, is G7’s ♯9...). Reharmonisation toolbox: tritone subs, related ii–Vs (Dm7–G7 → A♭m7–D♭7), diminished passing chords, chromatic approach chords, pedal points, constant-structure reharm, Coltrane matrix (major-third cycles), and modal interchange.',
    ],
    related: ['jazz-harmony', 'augmented-sixths', 'altered-chords', 'reharmonisation'],
  },
  {
    id: 'reharmonisation', section: 'jazz', title: 'Reharmonising a melody', level: 4,
    summary: 'New chords under an old tune.',
    simple: [
      'To **reharmonise** is to keep a melody but change the chords under it. Start by finding which melody notes can be the 3rd, 5th, 7th, 9th or 11th of another chord.',
    ],
    deep: [
      'Methods: substitute by function (vi or iii for I, ii for IV); insert ii–Vs before target chords; tritone subs; chromatic planing (parallel voicings following the melody); pedal-point reharm; modal interchange (♭VI, ♭VII, iv); **constant-structure** harmony (Bill Evans, Kenny Wheeler); gospel **walk-ups** with passing diminished chords; the **Coltrane** changes (Giant Steps, 1959) cycling keys a major third apart.',
    ],
    related: ['tritone-substitution', 'modal-mixture', 'gospel-neo-soul'],
  },
  {
    id: 'bebop-language', section: 'jazz', title: 'Bebop language', level: 4,
    summary: 'Enclosures, approach notes, bebop scales and target notes.',
    simple: [
      'Bebop improvisers (Charlie Parker, Dizzy Gillespie) played fast eighth-note lines that outline the chords precisely. They aim for chord notes on the beats and decorate them with chromatic notes.',
    ],
    deep: [
      '**Bebop scales** add a passing tone (the major 7th to Mixolydian; the ♯5 to major) so an eight-note descending line puts chord tones on downbeats. **Enclosures** surround a target (scale step above, chromatic below). **Digital patterns** (1-2-3-5), the “Cry Me a River” and “Honeysuckle Rose” licks, 3-to-♭9 figures over dominants, ii–V arpeggio superimposition, and quoting are core vocabulary; learned by **transcribing** solos by ear.',
    ],
    related: ['non-chord-tones', 'chord-scale-theory', 'jazz-harmony', 'ear-training'],
  },
  {
    id: 'modal-jazz', section: 'jazz', title: 'Modal jazz', level: 3,
    summary: 'Long stretches on one mode: “So What”, “Impressions”.',
    simple: [
      '**Modal jazz** (late 1950s: Miles Davis’s *Kind of Blue*, John Coltrane) replaces fast chord changes with long sections on one mode, giving improvisers space for melody.',
    ],
    deep: [
      '“So What” and “Impressions”: 16 bars D Dorian, 8 bars E♭ Dorian, 8 bars D Dorian. Harmonic language: quartal voicings, pedals, slash chords, sus chords, avoiding V–I resolutions. It fed into post-bop (Herbie Hancock, Wayne Shorter), jazz-rock fusion and Afrobeat’s Dorian vamps.',
    ],
    related: ['modes', 'voicings', 'jazz-harmony'],
  },
  {
    id: 'rock-pop-harmony', section: 'styles', title: 'Rock and pop harmony', level: 2,
    summary: 'Power chords, ♭VII, loops and riffs.',
    simple: [
      'Rock and pop harmony often breaks classical rules on purpose: chords borrowed from minor (♭VI, ♭VII), **power chords**, **riffs** that repeat, and **loops** of four chords that never fully resolve.',
      { example: { type: 'progression', tonic: 'D4', numerals: 'I bVII IV I', choose: ['I bVII IV I', 'I bVI bVII I', 'i bVII bVI bVII', 'I V vi IV'] } },
    ],
    deep: [
      'Features catalogued by Temperley, Moore and others: the plagal and double-plagal (♭VII–IV–I) cadences; Mixolydian and Aeolian modality; the **melodic–harmonic divorce** (blues-derived melody notes clashing with chords); pentatonic-based riffs; pedal-bass progressions; chromatic line clichés (Am–Am(maj7)–Am7–Am6); and loop-based form where the groove, not the cadence, carries the song.',
    ],
    related: ['modal-mixture', 'common-progressions', 'sus-add-power', 'song-forms'],
  },
  {
    id: 'gospel-neo-soul', section: 'styles', title: 'Gospel, R&B and neo-soul harmony', level: 4,
    summary: 'Passing chords, walk-ups, extended voicings and the 2–5–1.',
    simple: [
      'Gospel and R&B keyboard players fill every gap with **passing chords** and rich **extended voicings** (9ths, 11ths, 13ths). A hallmark is the **walk-up**: climbing chords that lead into the next section.',
      { example: { type: 'progression', tonic: 'C4', numerals: 'I7 IV7 #iv°7 I V7 vi', beats: 2 } },
    ],
    deep: [
      'Vocabulary: ii–V–I and “1-4-1” (I–IV/I–I) movements; ♯iv°7 and ♯i°7 passing diminished chords; 7♯9 and 13♭9 dominants; minor 11 and major 9 colours; tritone and “backdoor” substitutions; the **gospel 2–5–1** with chromatic approach chords; **“1–7–6”** bass walk-downs with slash chords; **shouts** in fast 6/8 or 4/4 with stabs. Neo-soul (D’Angelo, Erykah Badu, Robert Glasper) adds quartal and cluster voicings over laid-back, “drunk” J Dilla-style timing.',
    ],
    related: ['extended-chords', 'voicings', 'reharmonisation', 'modern-genres'],
  },
  {
    id: 'modern-genres', section: 'styles', title: 'Hip-hop, electronic, Afrobeats and amapiano', level: 2,
    summary: 'How modern genres are built: loops, drums, bass and texture.',
    simple: [
      { list: ['**Hip-hop**: drum patterns (boom-bap swing or trap hi-hat rolls), a sampled or played loop, a tuned **808** bass, 16-bar verses and a hook.', '**House/techno**: four-on-the-floor kick at 120–130 BPM; tension and release come from filters and adding/removing layers.', '**Afrobeats** (Nigeria, Ghana): mid-tempo (about 95–115 BPM), syncopated percussion and log drums, a light chord loop, melodic vocals often mixing English and Nigerian Pidgin or Yoruba.', '**Amapiano** (South Africa): about 110–115 BPM, piano chords, jazzy harmony and the signature pitched **log drum** bass.'] },
    ],
    deep: [
      'Trap programs hi-hats in 1/8 with rolls in 1/32 and triplets, snare/clap on beat 3 (half-time feel at 130–150 BPM). Afrobeats rhythms often derive from the 3-3-2 (tresillo) and the West African bell pattern, and from highlife guitar and Fela Kuti’s Afrobeat (which is a different, earlier genre). Amapiano borrows from kwaito, deep house and jazz. Production techniques — sidechain, vocal chops, drum programming swing — are as much part of the style as notes.',
    ],
    related: ['african-music', 'music-production', 'syncopation', 'song-forms'],
  },
  {
    id: 'african-music', section: 'world', title: 'African music', level: 2,
    summary: 'Highlife, jùjú, Afrobeat, mbira, kora and the traditions behind them.',
    simple: [
      'Africa has thousands of musical traditions. Shared features across many of them:',
      { list: ['**Call and response** between a lead singer and chorus or instruments.', '**Polyrhythm**: several interlocking rhythms at once, anchored by a bell or clap pattern.', '**Repetition with variation**: short cycles repeated and gradually changed.', '**Music joined with dance, language and ceremony**.', '**Tonal languages** shaping melody: Yoruba **talking drums** (dùndún, gángan) literally speak phrases.'] },
      'Modern West African styles include **highlife** (Ghana and Nigeria), **jùjú** (King Sunny Adé), **fújì**, **Afrobeat** (Fela Kuti and Tony Allen) and today’s **Afrobeats**.',
    ],
    deep: [
      'Instruments and systems: the **kora** (21-string harp-lute of the Mande griots), **balafon** and **amadinda** xylophones (interlocking playing), the **mbira** (Shona lamellophone with interlocking kushaura and kutsinhira parts), **djembe** and dunun ensembles, the **sekere**, **agogo** bells, **ìyá ìlù** lead drums, and the Ethiopian **kiñit** modal system (tezeta, bati, anchihoye, ambassel).',
      'Scholarship: Kofi Agawu critiques the exoticising focus on rhythm and emphasises the role of topos (time-line) and language; J.H. Kwabena Nketia’s *The Music of Africa* remains a foundation; Simha Arom analysed Central African polyphony. Tuning is often not equal-tempered: Shona mbira tunings vary by player, and many xylophones approach equidistant heptatonic or pentatonic scales.',
    ],
    related: ['african-rhythm', 'modern-genres', 'blues', 'talking-drum'],
  },
  {
    id: 'african-rhythm', section: 'world', title: 'African rhythm: bell patterns and time-lines', level: 3,
    summary: 'The 12/8 standard pattern, tresillo and interlocking parts.',
    simple: [
      'Many West and Central African ensembles are organised by a repeating **bell pattern** (time-line) that everyone listens to. The best-known has seven strokes in twelve pulses:',
      { example: { type: 'bell', pattern: 'x.x.xx.x.x.x', pulses: 12 } },
      'Other drums interlock around it, each playing a short repeated part. The magic is in how the parts fit together.',
    ],
    deep: [
      'The **standard pattern** (x.x.xx.x.x.x) is heard in Ewe *agbekor*, Yoruba bàtá, Afro-Cuban *bembé* and the Brazilian *candomblé*; it is the diatonic scale’s rhythmic cousin (Pressing, Toussaint). The **tresillo** (x..x..x., 3+3+2) and **son clave** travelled to the Caribbean and the Americas and underlie rumba, salsa, reggaeton, highlife and Afrobeats. Many ensembles are felt in four dotted-quarter beats against which the bell and drums create cross-rhythm (3 against 2, 4 against 3).',
    ],
    related: ['african-music', 'clave-and-latin', 'tuplets-and-polyrhythm', 'syncopation'],
  },
  {
    id: 'talking-drum', section: 'world', title: 'The Yoruba talking drum', level: 3,
    summary: 'A drum that speaks: dùndún and the pitch of language.',
    simple: [
      'Yoruba is a **tonal language**: the pitch of each syllable changes the word’s meaning. The hourglass **dùndún** drum is squeezed under the arm to change its pitch, so a drummer can play the tones and rhythm of speech — praise names, proverbs and greetings — which listeners understand.',
    ],
    deep: [
      'The dùndún ensemble includes the lead *ìyá ìlù*, the *gángan*, and supporting *kànnàngó*, *omele* and *gúdúgúdú*. Players use a curved stick (*kọ̀ngọ̀*) and the hand. Similar speech surrogacy exists in the Akan *atumpan* drums (Ghana) and in whistled and horn languages across West Africa. Talking drums appear in jùjú, fújì and modern Nigerian pop.',
    ],
    related: ['african-music', 'african-rhythm', 'hand-percussion'],
  },
  {
    id: 'clave-and-latin', section: 'world', title: 'Clave and Latin rhythm', level: 3,
    summary: 'Son and rumba clave, montuno, tumbao, bossa nova.',
    simple: [
      '**Clave** is a two-bar rhythm that organises Afro-Cuban music. The **son clave** (3–2) has three hits in the first bar and two in the second:',
      { example: { type: 'bell', pattern: 'x..x..x...x.x...', pulses: 16 } },
      'Musicians say a part is “in clave” when it fits the pattern’s direction (3–2 or 2–3).',
    ],
    deep: [
      '**Rumba clave** delays the third stroke. Around the clave: the conga **tumbao**, the piano **montuno** (syncopated, repeated chord figure), the bass **tumbao** anticipating chord changes, the cowbell **cáscara** and **campana**. Brazilian **samba** (surdo on 2, partido-alto guitar patterns) and **bossa nova** (Jobim, João Gilberto: a clave-like guitar pattern over jazz harmony), Argentine **tango** (habanera and 3-3-2), and Caribbean **reggaeton** (dembow, derived from dancehall and tresillo) are related families.',
    ],
    related: ['african-rhythm', 'syncopation', 'modern-genres'],
  },
  {
    id: 'indian-classical', section: 'world', title: 'Indian classical music: raga and tala', level: 3,
    summary: 'Hindustani and Carnatic traditions, raga, tala, drone and improvisation.',
    simple: [
      'Indian classical music has two main traditions: **Hindustani** (north) and **Carnatic** (south). There are no chord changes; a **drone** (tanpura) holds the tonic and fifth while a soloist develops a **raga**.',
      { list: ['**Raga**: a melodic framework — a set of notes plus characteristic phrases, ornaments and mood, often tied to a time of day or season.', '**Tala**: a rhythmic cycle, such as *teental* (16 beats) or *rupak* (7 beats), kept on the **tabla** or **mridangam**.', '**Swaras**: the note names *Sa Re Ga Ma Pa Dha Ni*, like do re mi.'] },
    ],
    deep: [
      'Hindustani ragas are grouped into ten **thaats** (Bhatkhande): Bilawal (major), Khamaj, Kafi, Asavari, Bhairavi, Bhairav, Kalyan, Marwa, Poorvi, Todi. Carnatic music uses the 72 **melakarta** parent scales (Venkatamakhin). A raga specifies ascent and descent (*aroha, avaroha*), important notes (*vadi, samvadi*), phrases (*pakad*) and ornaments (*meend* slides, *gamaka* oscillations, *andolan*). Performances unfold from free-time *alap* through *jor* and *jhala* to composed and improvised sections over tala; rhythmic cadences such as the *tihai* (a phrase played three times to land on *sam*, beat 1) are signature devices. Theory recognises 22 **shrutis** per octave, though practice is shaped by intonation, not fixed pitches.',
    ],
    related: ['world-scales', 'odd-meters', 'microtonality', 'ornaments'],
  },
  {
    id: 'arabic-maqam', section: 'world', title: 'Arabic maqam, Persian dastgah and Turkish makam', level: 4,
    summary: 'Modal systems with quarter tones, jins and melodic paths.',
    simple: [
      'Music across the Arab world, Turkey and Iran is built on **maqam** (modes). Each maqam has its own notes — some between the piano keys — its own typical phrases and its own emotional character. Instruments include the **oud**, **qanun**, **ney** and **darbuka**.',
    ],
    deep: [
      'A maqam is built from **ajnas** (singular *jins*), three- to five-note cells such as Rast, Bayati, Hijaz, Saba, Nahawand, Kurd and Sikah, joined into a scale with a characteristic *sayr* (melodic path, including where to begin, emphasise and modulate). Arabic practice notates neutral intervals as half-flats (e.g. E half-flat in Rast), commonly approximated as quarter tones in 24-tone equal temperament, though real intonation varies by region and maqam. Rhythmic modes (*iqa‘at*: maqsum, masmudi, saidi, samai thaqil 10/8) organise the time.',
      'Turkish **makam** theory (Arel–Ezgi–Uzdilek) divides the whole tone into 9 commas (53-TET approximations). Persian **dastgah** music comprises seven dastgahs and five avaz, each a collection of *gusheh* melodies catalogued in the *radif*.',
    ],
    related: ['world-scales', 'microtonality', 'texture'],
  },
  {
    id: 'gamelan', section: 'world', title: 'Gamelan (Indonesia)', level: 4,
    summary: 'Bronze orchestras, slendro and pelog, colotomic cycles.',
    simple: [
      'A **gamelan** is an ensemble of bronze gongs, metallophones and drums from Java and Bali. The music is organised in repeating cycles marked by gongs; layers move at different speeds, from the slow core melody to fast interlocking decorations.',
    ],
    deep: [
      'Two tuning systems: **slendro** (5 near-equal steps per octave) and **pelog** (7 unequal steps, from which pentatonic subsets called *pathet* are drawn). Each gamelan is tuned as a set, so no two are identical. **Colotomic structure**: the gong ageng marks the end of the cycle (*gongan*), with kenong, kempul and ketuk subdividing it. Javanese music uses *balungan* (skeletal melody) elaborated by bonang, gender, rebab, suling and voice; Balinese *gamelan gong kebyar* features explosive tempo changes and **kotekan** interlocking, with instruments tuned in pairs slightly apart to produce shimmering beats (*ombak*). Debussy heard gamelan at the 1889 Paris Exposition.',
    ],
    related: ['world-scales', 'texture', 'impressionism', 'microtonality'],
  },
  {
    id: 'east-asian', section: 'world', title: 'Chinese and Japanese traditions', level: 3,
    summary: 'Pentatonic modes, the pipa, guqin, koto and shakuhachi.',
    simple: [
      '**Chinese** music uses five main notes (gong, shang, jue, zhi, yu — like do re mi so la) with extra passing notes. Instruments include the **erhu** (two-string fiddle), **pipa** (lute), **guzheng** (zither), **guqin** (seven-string zither) and **dizi** (flute).',
      '**Japanese** traditional music uses scales like **in** and **yo**, instruments like the **koto**, **shamisen** and **shakuhachi**, and values **ma** — meaningful silence and space.',
    ],
    deep: [
      'Chinese theory derives the 12 *lü* by the “add and subtract a third” method (*sanfen sunyi*), equivalent to a cycle of 3:2 fifths; Zhu Zaiyu published an exact equal-temperament calculation in 1584. Notation includes *gongche* and the numbered *jianpu* (1 = do) widely used today in China and Indonesia. Japanese *gagaku* (court music) preserves Tang-era forms; *jo-ha-kyū* describes acceleration through a piece.',
    ],
    related: ['pentatonic-blues', 'world-scales', 'equal-temperament'],
  },
  {
    id: 'flamenco', section: 'world', title: 'Flamenco', level: 3,
    summary: 'Compás, the Phrygian mode and the Andalusian cadence.',
    simple: [
      '**Flamenco** from Andalusia (southern Spain) combines song (*cante*), guitar (*toque*), dance (*baile*) and hand-clapping (*palmas*). Much of it uses the **Phrygian** sound with a major chord on the tonic, and the descending **Andalusian cadence** (Am–G–F–E).',
    ],
    deep: [
      'Flamenco forms (*palos*) are defined by **compás** — rhythmic cycles such as the 12-beat soleá and bulerías (accents on 3, 6, 8, 10, 12), the alternating 6/8 and 3/4 of the sevillanas and the 4-beat tangos and tientos. The “flamenco mode” is Phrygian with a major I (E–F–G♯ colour), related to the Arabic and Jewish musical heritage of al-Andalus.',
    ],
    related: ['modes', 'common-progressions', 'time-signatures'],
  },
];
