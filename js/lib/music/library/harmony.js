/* Music Library — chords, harmony, voice leading and counterpoint. */

export default [
  {
    id: 'triads', section: 'chords', title: 'Triads', level: 1,
    summary: 'Three-note chords: major, minor, diminished, augmented.',
    simple: [
      'A **chord** is three or more notes played together. The basic chord is the **triad**: a root, a third above it, and a fifth above it — every other note of a scale (C–E–G).',
      { table: { head: ['Triad', 'Built from', 'Example', 'Sound'], rows: [['Major', 'Major 3rd + minor 3rd', 'C E G', 'Bright, stable'], ['Minor', 'Minor 3rd + major 3rd', 'C E♭ G', 'Dark, sad'], ['Diminished', 'Minor 3rd + minor 3rd', 'C E♭ G♭', 'Tense, unstable'], ['Augmented', 'Major 3rd + major 3rd', 'C E G♯', 'Suspenseful, dreamy']] } },
      { example: { type: 'chord', root: 'C4', quality: '', choose: ['', 'm', 'dim', 'aug'] } },
    ],
    deep: [
      'In a major key the diatonic triads are I, ii, iii, IV, V, vi (major, minor, minor, major, major, minor) and vii° (diminished). In harmonic minor: i, ii°, III+, iv, V, VI, vii°.',
      'The augmented triad divides the octave into three equal major thirds, so it has only four distinct forms; the diminished seventh divides it into four minor thirds (three forms). Both are ambiguous by design and useful for modulation.',
      'Riemannian (neo-Riemannian) theory relates triads by transformations: P (parallel: C↔Cm), R (relative: C↔Am), L (leading-tone exchange: C↔Em). Chains of these explain late-Romantic and film-score progressions that circle-of-fifths theory cannot.',
    ],
    related: ['inversions', 'seventh-chords', 'roman-numerals', 'chord-symbols'],
  },
  {
    id: 'inversions', section: 'chords', title: 'Inversions and figured bass', level: 2,
    summary: 'Which note is in the bass, and the numbers that describe it.',
    simple: [
      'A chord is in **root position** when its root is the lowest note. With the **third** in the bass it is in **first inversion**; with the **fifth** in the bass, **second inversion**.',
      'Inversions make bass lines smoother. Chord symbols show them with a slash: C/E is a C chord with E in the bass.',
      { example: { type: 'chord', root: 'C4', quality: '', inversions: true } },
    ],
    deep: [
      '**Figured bass** (Baroque continuo) writes intervals above the bass: root position 5/3 (usually omitted), first inversion 6 (6/3), second inversion 6/4. Seventh chords: 7, 6/5 (first inversion), 4/3 (second), 4/2 or 2 (third, seventh in the bass). Accidentals alone raise or lower the third above the bass; a slash through a figure raises it.',
      'The second-inversion triad (6/4) is treated as unstable in common practice and appears in specific patterns: cadential 6/4 (I6/4–V, really a V with two suspensions), passing 6/4, pedal (neighbour) 6/4 and arpeggiated 6/4.',
    ],
    related: ['triads', 'seventh-chords', 'voice-leading', 'cadences'],
  },
  {
    id: 'seventh-chords', section: 'chords', title: 'Seventh chords', level: 2,
    summary: 'Add a seventh: maj7, 7, m7, m7♭5, dim7 and more.',
    simple: [
      'Stack one more third on a triad and you get a **seventh chord**. The five common types:',
      { table: { head: ['Name', 'Symbol', 'From C', 'Sound'], rows: [['Major seventh', 'Cmaj7', 'C E G B', 'Lush, jazzy, calm'], ['Dominant seventh', 'C7', 'C E G B♭', 'Bluesy, wants to resolve'], ['Minor seventh', 'Cm7', 'C E♭ G B♭', 'Mellow, soulful'], ['Half-diminished', 'Cm7♭5 / Cø7', 'C E♭ G♭ B♭', 'Dark, searching'], ['Diminished seventh', 'C°7', 'C E♭ G♭ B𝄫', 'Tense, dramatic']] } },
      { example: { type: 'chord', root: 'C4', quality: 'maj7', choose: ['maj7', '7', 'm7', 'm7b5', 'dim7', 'mMaj7'] } },
    ],
    deep: [
      'Diatonic sevenths in major: Imaj7, ii7, iii7, IVmaj7, V7, vi7, viiø7. The V7 is the only diatonic dominant seventh; its tritone (3rd and 7th) is the engine of resolution to I.',
      'The fully diminished seventh (vii°7) of harmonic minor is symmetrical: its notes can be respelled as the vii°7 of three other keys, making it a classic pivot for modulation (Bach, Beethoven) and a staple of silent-film suspense.',
      'In jazz, the 7th is part of the basic chord: a “C” on a jazz chart may be played Cmaj7 or C6; “C7” is always dominant. Minor-major 7 (Cm(maj7)) is the tonic of melodic minor — the James Bond chord.',
    ],
    related: ['triads', 'extended-chords', 'functional-harmony', 'voicings'],
  },
  {
    id: 'extended-chords', section: 'chords', title: '9ths, 11ths and 13ths', level: 3,
    summary: 'Extensions stack more thirds above the seventh.',
    simple: [
      'Keep stacking thirds above a seventh chord and you get **extended chords**: the 9th, 11th and 13th. They add colour and richness; they are the sound of jazz, gospel, neo-soul and R&B.',
      { example: { type: 'chord', root: 'C4', quality: '9', choose: ['maj9', '9', 'm9', '11', 'm11', '13', 'maj13', '6/9'] } },
      'You rarely play every note: players drop the 5th (and often the root, which the bass covers) and keep the 3rd, 7th and the colour tones.',
    ],
    deep: [
      'Avoid-note conventions: on a major chord, the natural 11 clashes with the major 3rd (a minor 9th above it), so major chords take ♯11 (Lydian) instead; on dominant chords the natural 11 is used only as a sus sound. The 13 on a minor chord implies Dorian; ♭13 implies Aeolian.',
      'A 13th chord implies a full seven-note scale (C13 = C E G B♭ D F A = C Mixolydian); voicings choose which notes to state. An “add9” has no 7th; a “9” implies a 7th.',
    ],
    related: ['seventh-chords', 'voicings', 'chord-scale-theory', 'altered-chords', 'gospel-neo-soul'],
  },
  {
    id: 'sus-add-power', section: 'chords', title: 'Suspended, added-note and power chords', level: 1,
    summary: 'sus2, sus4, add9, 6, and the rock power chord.',
    simple: [
      '**Suspended chords** replace the 3rd with the 2nd (sus2) or 4th (sus4). With no 3rd they are neither major nor minor, and sound open or expectant.',
      '**Added-note chords** add a colour without the 7th: add9 (C E G D), 6 (C E G A).',
      'A **power chord** (C5) is just root and fifth, so it stays clear under heavy distortion. It is the backbone of rock and metal.',
      { example: { type: 'chord', root: 'D4', quality: 'sus4', choose: ['sus2', 'sus4', '', 'add9', '6', '5', '7sus4'] } },
    ],
    deep: [
      'In common practice a suspension is a non-chord tone that resolves (4–3), not a chord. As a standalone chord, sus4 arrived with 20th-century popular music; 7sus4 (often written as F/G or Dm7/G) is a modern substitute for V in gospel, pop and jazz (Herbie Hancock’s “Maiden Voyage”).',
    ],
    related: ['triads', 'non-chord-tones', 'guitar'],
  },
  {
    id: 'altered-chords', section: 'chords', title: 'Altered dominants', level: 4,
    summary: '7♭9, 7♯9, 7♯11, 7♭13 and 7alt.',
    simple: [
      'Dominant chords (V7) can take **altered** extensions — ♭9, ♯9, ♯11 (♭5), ♭13 (♯5) — to add bite before resolving. The ♯9 is the “Hendrix chord” (E7♯9 in “Purple Haze”).',
      { example: { type: 'chord', root: 'G3', quality: '7b9', choose: ['7', '7b9', '7#9', '7#11', '7b13', '7alt'] } },
    ],
    deep: [
      'Altered tensions push toward the target chord: ♭9 → 5 of the target, ♯9 → 9 of the target (or ♭9 → root in minor), ♭13 → 9 or 3 of the target. Hence the jazz rule of thumb: use altered dominants resolving to minor chords, natural (9, 13) tensions resolving to major.',
      'Chord–scale matches: 7♭9 (half–whole diminished if 13 present, Phrygian dominant if ♭13), 7♯11 (Lydian dominant), 7alt (altered scale), 7♯5 (whole tone).',
    ],
    related: ['melodic-minor-modes', 'chord-scale-theory', 'tritone-substitution', 'extended-chords'],
  },
  {
    id: 'chord-symbols', section: 'chords', title: 'Reading chord symbols', level: 1,
    summary: 'What C, Cm, C7, Cmaj7, C°, Cø, C+, Csus4 and C/G mean.',
    simple: [
      { table: { head: ['Symbol', 'Chord'], rows: [['C', 'C major'], ['Cm, C−, Cmi', 'C minor'], ['C7', 'C dominant seventh'], ['Cmaj7, CΔ, CM7', 'C major seventh'], ['Cm7, C−7', 'C minor seventh'], ['C°, Cdim', 'C diminished triad'], ['C°7, Cdim7', 'C diminished seventh'], ['Cø, Cm7♭5', 'C half-diminished seventh'], ['C+, Caug', 'C augmented'], ['Csus4, Csus2', 'suspended'], ['C6, Cm6', 'added sixth'], ['Cadd9', 'major with added ninth'], ['C/G', 'C chord with G in the bass']] } },
      { example: { type: 'chordname' } },
    ],
    deep: [
      'Hierarchy of a symbol: root, quality (m, dim, aug, sus), highest seventh-type extension (7, maj7, 9, 11, 13), then alterations and additions in parentheses or ascending order: C7(♭9♯11), C13♯11. A slash chord places a non-root bass; a **polychord** (written with a horizontal line, e.g. D over C7) stacks two chords — the basis of “upper structure” voicings.',
    ],
    related: ['lead-sheets', 'triads', 'seventh-chords', 'voicings'],
  },
  {
    id: 'voicings', section: 'chords', title: 'Voicing chords', level: 3,
    summary: 'Close, open, drop-2, shell, rootless, quartal and upper-structure voicings.',
    simple: [
      'A **voicing** is the specific way you arrange a chord’s notes: which note is on top, how spread out they are, which notes you double or leave out.',
      { list: ['**Close position**: notes packed within an octave.', '**Open position**: spread over more than an octave; richer, clearer.', '**Shell voicing**: just root, 3rd and 7th — the essential notes.', '**Inversion choice**: pick the voicing whose notes move least from the previous chord.'] },
    ],
    deep: [
      '**Drop-2**: take a close voicing and drop the second-from-top note an octave — the standard guitar and big-band sax voicing. **Drop-3** and **drop-2-and-4** spread further.',
      '**Rootless voicings** (Bill Evans, Wynton Kelly): “A” form 3-5-7-9 and “B” form 7-9-3-5 for left-hand piano, alternating to minimise motion through ii–V–I.',
      '**Quartal voicings** stack fourths (McCoy Tyner, “So What” chord: E A D G B over D). **Upper-structure triads** put a major triad on top of a dominant’s 3–7 tritone to spell tensions (D/C7 = 9 ♯11 13).',
      '**Spread and cluster voicings** (Ravel, film scoring), **gospel voicings** (3–7 in the left hand with block triads above) and **guitar CAGED shapes** are further idioms.',
    ],
    related: ['extended-chords', 'voice-leading', 'jazz-harmony', 'piano'],
  },
  {
    id: 'roman-numerals', section: 'harmony', title: 'Roman numeral analysis', level: 2,
    summary: 'Naming chords by their place in the key: I, ii, V7, vi.',
    simple: [
      'Musicians name chords by the **scale degree** of their root, in Roman numerals: I is the chord on the tonic, V the chord on the 5th degree. **Upper case** = major, **lower case** = minor, ° = diminished.',
      'In C major: **I** C, **ii** Dm, **iii** Em, **IV** F, **V** G, **vi** Am, **vii°** B°. The same numerals work in any key, so “I–V–vi–IV” describes a progression in every key at once.',
      { example: { type: 'diatonic', tonic: 'C4', scale: 'major' } },
    ],
    deep: [
      'Figures and symbols add detail: V7, V6/5, ii6, I6/4; ♭VI and ♭VII for borrowed chords; V/V (“five of five”) for secondary dominants; N6 for the Neapolitan; It+6, Fr+6, Ger+6 for augmented sixths. Different schools write minor-key numerals differently (i, iv, V versus I, IV, V in some textbooks).',
      'Roman numerals encode function, not just root: a vii°6 often functions like V7 without its root; a cadential 6/4 is written I6/4 but behaves as a V.',
    ],
    related: ['functional-harmony', 'common-progressions', 'secondary-dominants', 'lead-sheets'],
  },
  {
    id: 'functional-harmony', section: 'harmony', title: 'Harmonic function: tonic, predominant, dominant', level: 2,
    summary: 'Why chords go where they go.',
    simple: [
      'Chords in a key do three jobs:',
      { list: ['**Tonic** (I, sometimes vi or iii): home, rest.', '**Predominant** (IV, ii): moving away, setting up tension.', '**Dominant** (V, vii°): tension that wants to go home to I.'] },
      'The basic story of tonal music is **home → away → tension → home**: I – IV – V – I, or I – ii – V – I.',
      { example: { type: 'progression', tonic: 'C4', numerals: 'I IV V I', choose: ['I IV V I', 'I ii V I', 'I vi IV V', 'ii V I'] } },
    ],
    deep: [
      'Riemann’s function theory reduces all chords to T, S (subdominant) and D; parallel and leading-tone relatives substitute (vi as Tp, iii as Dp or Tl). American pedagogy (Kostka–Payne, Aldwell–Schachter) speaks of tonic, predominant and dominant areas, with harmonic rhythm and bass motion (roots falling by fifth, third or rising by step) as the normative syntax.',
      'Schenkerian analysis sees surface progressions as prolongations of a background I–V–I with a descending upper line (the *Ursatz*). Popular music often reverses norms: IV–I (plagal) and ♭VII–I are as strong as V–I, and loops need not resolve at all.',
    ],
    related: ['roman-numerals', 'cadences', 'common-progressions', 'scale-degrees'],
  },
  {
    id: 'cadences', section: 'harmony', title: 'Cadences', level: 2,
    summary: 'Musical punctuation: perfect, imperfect, plagal, deceptive.',
    simple: [
      'A **cadence** is the chord progression at the end of a phrase — musical punctuation.',
      { table: { head: ['Cadence', 'Chords', 'Effect'], rows: [['Perfect (authentic)', 'V → I', 'Full stop'], ['Plagal', 'IV → I', '“Amen”, gentle close'], ['Imperfect (half)', 'anything → V', 'Comma, question'], ['Interrupted (deceptive)', 'V → vi', 'Surprise, keeps going']] } },
      { example: { type: 'progression', tonic: 'C4', numerals: 'IV V I', choose: ['IV V I', 'IV I', 'I IV V', 'IV V vi'] } },
    ],
    deep: [
      'A **perfect authentic cadence** (PAC) has V–I in root position with the tonic in the top voice; an **imperfect authentic cadence** (IAC) has an inversion or the 3rd/5th on top. The **Phrygian half cadence** (iv6–V in minor) closes Baroque slow movements. **Cadential 6/4**: I6/4–V–I, the 6/4 being a double suspension over the dominant.',
      'Other cadences: the **Picardy third** (a major I ending a minor piece), the **Landini cadence** (14th-century, 7–6–8 in the top voice), the **backdoor cadence** (♭VII7–I in jazz), and in pop the **Aeolian cadence** (♭VI–♭VII–I, the “Mario cadence”).',
    ],
    related: ['functional-harmony', 'phrase-structure', 'common-progressions'],
  },
  {
    id: 'common-progressions', section: 'harmony', title: 'Common chord progressions', level: 1,
    summary: 'The progressions behind thousands of songs.',
    simple: [
      { table: { head: ['Progression', 'Name', 'Heard in'], rows: [['I – V – vi – IV', 'Pop / axis progression', 'Countless pop hits across decades'], ['I – vi – IV – V', '50s / doo-wop', '“Stand by Me”, doo-wop ballads'], ['ii – V – I', 'The jazz cadence', 'Almost every jazz standard'], ['I – IV – V', 'Three-chord song', 'Folk, blues, rock and roll, highlife'], ['vi – IV – I – V', 'Pop minor rotation', 'Emotional pop and worship songs'], ['i – ♭VII – ♭VI – V', 'Andalusian cadence', 'Flamenco, “Hit the Road Jack”'], ['I – V – vi – iii – IV – I – IV – V', 'Pachelbel’s Canon', 'Canon in D and its many borrowings'], ['IV – V – iii – vi', 'Royal road (Ōdō)', 'J-pop, anime themes']] } },
      { example: { type: 'progression', tonic: 'G3', numerals: 'I V vi IV', choose: ['I V vi IV', 'I vi IV V', 'ii V I', 'vi IV I V', 'i bVII bVI V', 'IV V iii vi'] } },
    ],
    deep: [
      'Many progressions are rotations of the same loop (I–V–vi–IV, V–vi–IV–I, vi–IV–I–V, IV–I–V–vi), which is why they feel interchangeable. The **circle progression** (I–IV–vii°–iii–vi–ii–V–I) descends by fifths through every diatonic chord (Vivaldi, “Autumn Leaves”, “Fly Me to the Moon”).',
      '**12-bar blues**: I–I–I–I / IV–IV–I–I / V–IV–I–(V). **Rhythm changes** (from Gershwin’s “I Got Rhythm”): I–vi–ii–V loops with a bridge of dominants around the circle (III7–VI7–II7–V7). The **Montgomery–Ward bridge** (I7–IV–ii7–V7…) and **Coltrane changes** (thirds cycles) are advanced variants.',
      'West African guitar highlife and soukous often cycle I–IV–I–V or I–V over bell-pattern rhythms; Afrobeat (Fela Kuti) often vamps on one or two chords (i7–IV7 Dorian) for long stretches.',
    ],
    related: ['functional-harmony', 'blues', 'jazz-harmony', 'african-music', 'songwriting'],
  },
  {
    id: 'secondary-dominants', section: 'harmony', title: 'Secondary dominants and tonicisation', level: 3,
    summary: 'V of V, V of vi: borrowing a dominant to point at any chord.',
    simple: [
      'Any major or minor chord in a key can get its own dominant. **V/V** (“five of five”) in C major is D major (or D7), which leads strongly to G. The raised note (F♯) is the giveaway.',
      { example: { type: 'progression', tonic: 'C4', numerals: 'I II7 V I', choose: ['I II7 V I', 'I III7 vi', 'I VI7 ii V I', 'I I7 IV'] } },
    ],
    deep: [
      'Secondary dominants and secondary leading-tone chords (vii°/V, vii°7/ii) briefly **tonicise** a chord without leaving the key. Chains of secondary dominants create **extended dominant** sequences (III7–VI7–II7–V7–I, the ragtime and “Sweet Georgia Brown” progression).',
      'The line between tonicisation and modulation is one of duration and cadence: a new key needs to be confirmed by a cadence in it.',
    ],
    related: ['functional-harmony', 'modulation', 'circle-of-fifths', 'jazz-harmony'],
  },
  {
    id: 'modulation', section: 'harmony', title: 'Modulation: changing key', level: 3,
    summary: 'Pivot chords, direct modulation, and the truck-driver key change.',
    simple: [
      '**Modulation** means moving to a new key. A pop song might jump up a half or whole step for the last chorus (the “truck-driver’s gear change”). Classical pieces often move from the home key to the dominant (V) or the relative major/minor.',
    ],
    deep: [
      '**Pivot-chord** modulation uses a chord common to both keys (in C to G: Am is vi in C and ii in G), then cadences in the new key. **Direct (phrase) modulation** simply starts the next phrase in the new key. **Chromatic** modulation moves a voice by half step (C–C♯) to reinterpret a chord. **Enharmonic** modulation respells a diminished seventh or a German sixth (= dominant seventh) to reach distant keys. **Common-tone** modulation holds one note while the harmony shifts around it.',
      'Sonata form is built on the tension of modulation: the exposition moves to a secondary key (V in major, III in minor), the development roams, the recapitulation returns everything to the tonic.',
    ],
    related: ['secondary-dominants', 'relative-parallel', 'augmented-sixths', 'sonata-form'],
  },
  {
    id: 'modal-mixture', section: 'harmony', title: 'Borrowed chords (modal mixture)', level: 3,
    summary: 'Borrowing chords from the parallel minor: iv, ♭VI, ♭VII, ♭III.',
    simple: [
      'Songs in a major key often borrow chords from the **parallel minor**. In C major, borrowing gives Fm (iv), A♭ (♭VI), B♭ (♭VII) and E♭ (♭III). They add an instant bittersweet or epic colour.',
      { example: { type: 'progression', tonic: 'C4', numerals: 'I iv I', choose: ['I iv I', 'I bVI bVII I', 'I bVII IV I', 'I bIII IV I'] } },
    ],
    deep: [
      'In classical usage mixture most often affects the predominant (iv, ii°, ii ø7) and ♭VI; the **Picardy third** is mixture in reverse. In rock the ♭VII–IV–I “double plagal” cadence and ♭VI–♭VII–I are idiomatic; in film music, major chords a major third apart (chromatic mediants) combine with mixture for the heroic sound.',
    ],
    related: ['relative-parallel', 'chromatic-mediants', 'common-progressions', 'rock-pop-harmony'],
  },
  {
    id: 'neapolitan', section: 'harmony', title: 'The Neapolitan sixth', level: 4,
    summary: 'The ♭II chord in first inversion.',
    simple: [
      'The **Neapolitan** is a major chord on the lowered second degree (D♭ major in C), usually in first inversion. It is a dark, dramatic predominant that leads to V.',
    ],
    deep: [
      'Written N6 or ♭II6. Its ♭2 typically falls through the leading note to the dominant (a diminished third in the voice leading, D♭–B), often via a cadential 6/4. Found in Scarlatti, Mozart, Beethoven (“Moonlight” Sonata) and Chopin; in Phrygian-flavoured popular music ♭II appears in root position.',
    ],
    related: ['augmented-sixths', 'modal-mixture', 'cadences'],
  },
  {
    id: 'augmented-sixths', section: 'harmony', title: 'Augmented sixth chords', level: 4,
    summary: 'Italian, French and German sixths.',
    simple: [
      'These chromatic predominant chords contain an **augmented sixth** (A♭ up to F♯ in C) whose notes spread outward by half step to the octave on the dominant (G).',
    ],
    deep: [
      'Built on ♭6 in the bass: **Italian** (♭6, 1, ♯4), **French** (♭6, 1, 2, ♯4 — whole-tone flavoured), **German** (♭6, 1, ♭3, ♯4 — sounds like a dominant seventh on ♭6). The German sixth usually resolves via a cadential 6/4 to avoid parallel fifths (“Mozart fifths” when it does not).',
      'Enharmonically the German sixth equals a dominant seventh (A♭–C–E♭–F♯ = A♭7), which allows modulation to the key a half step down or to distant keys; the same identity underlies the jazz **tritone substitution**.',
    ],
    related: ['neapolitan', 'modulation', 'tritone-substitution'],
  },
  {
    id: 'chromatic-mediants', section: 'harmony', title: 'Chromatic mediants and film harmony', level: 4,
    summary: 'Major chords a third apart, the sound of wonder and heroism.',
    simple: [
      'Moving between two **major chords a third apart** (C to E, C to A♭) sounds magical or heroic. It is a favourite of film composers.',
      { example: { type: 'progression', tonic: 'C4', numerals: 'I III I bVI I', choose: ['I III I bVI I', 'I bIII I', 'I VI I'] } },
    ],
    deep: [
      'Chromatic mediants share one common tone and move the other voices by step (C–E–G to E–G♯–B). Schubert, Liszt, Wagner and Bruckner used them structurally; neo-Riemannian theory describes them as combinations of L, P and R transformations (e.g. C→E = LP; C→A♭ = PL). Hexatonic cycles (C, E, A♭ and their minor partners) produce the “uncanny” sound of much horror and fantasy scoring.',
    ],
    related: ['triads', 'modal-mixture', 'film-scoring'],
  },
  {
    id: 'non-chord-tones', section: 'harmony', title: 'Non-chord tones', level: 2,
    summary: 'Passing notes, neighbours, suspensions, appoggiaturas and more.',
    simple: [
      'Melodies contain notes that are not in the chord. They add motion and tension, then settle onto chord notes:',
      { list: ['**Passing note**: steps between two chord notes (C–D–E over a C chord).', '**Neighbour note**: steps away and back (E–F–E).', '**Suspension**: a note held over from the previous chord, then resolved down by step (4–3, 7–6, 9–8).', '**Appoggiatura**: a leap to a dissonance on the beat that resolves by step — a sigh.', '**Anticipation**: a note of the next chord arriving early.', '**Pedal note**: a sustained bass note under changing chords.'] },
    ],
    deep: [
      'Also: the **escape tone** (échappée: step away, leap back), **retardation** (a suspension resolving up), **cambiata** (a four-note figure in Renaissance counterpoint), **double neighbours**. Accented versus unaccented placement changes their effect; in jazz, **enclosures** (chromatic approach from above and below) and **approach notes** are the same idea applied to bebop lines.',
    ],
    related: ['counterpoint', 'voice-leading', 'melody-basics', 'bebop-language'],
  },
  {
    id: 'voice-leading', section: 'harmony', title: 'Voice leading and four-part writing', level: 3,
    summary: 'How individual lines move from chord to chord.',
    simple: [
      'Chords are made of separate lines (voices). Good **voice leading** moves each voice as little as possible: keep common notes, move others by step.',
      'In four-part (SATB) writing — soprano, alto, tenor, bass — the classic guidelines are: keep voices in range, keep the upper three within an octave of each other, move smoothly, and avoid parallel fifths and octaves.',
    ],
    deep: [
      'Common-practice guidelines: avoid **parallel** (and usually hidden/direct) perfect fifths and octaves between any pair of voices, which weaken the independence of the lines; resolve the leading note up and chordal sevenths down; double the root in root-position triads, avoid doubling the leading note; prefer contrary motion against the bass.',
      'Spacing: no more than an octave between soprano–alto and alto–tenor; the bass may be further away. Typical ranges: soprano C4–G5, alto G3–C5 (or D5), tenor C3–G4, bass E2–C4 (D4).',
      'Modern pop, rock and jazz freely use parallel fifths (power chords, planing), but the idea of smooth inner voices remains central to arranging and orchestration.',
    ],
    related: ['counterpoint', 'voicings', 'inversions', 'arranging'],
  },
  {
    id: 'counterpoint', section: 'harmony', title: 'Counterpoint', level: 3,
    summary: 'Combining independent melodies: species counterpoint to fugue.',
    simple: [
      '**Counterpoint** is the art of combining two or more independent melodies so they sound good together. Think of a round like “Frère Jacques”, or Bach’s interweaving lines.',
      'The good lines move in contrasting directions and rhythms, meet on consonances, and treat dissonances carefully.',
    ],
    deep: [
      '**Species counterpoint** (Fux, *Gradus ad Parnassum*, 1725) trains the craft against a cantus firmus: first species note against note (consonances only), second two notes against one (passing dissonances on weak beats), third four against one (neighbours, cambiata), fourth syncopated (suspensions: 7–6, 4–3, 9–8 above; 2–3 below), fifth florid (all combined).',
      '**Imitation** repeats a line in another voice; a **canon** repeats it strictly (at the octave, fifth, in augmentation, inversion…). **Invertible counterpoint** can swap upper and lower lines (at the octave, the tenth or the twelfth), the core technique of Bach’s inventions and fugues.',
    ],
    related: ['fugue', 'voice-leading', 'non-chord-tones', 'texture'],
  },
  {
    id: 'fugue', section: 'harmony', title: 'Fugue', level: 4,
    summary: 'Subject, answer, countersubject, episodes and stretto.',
    simple: [
      'A **fugue** is a piece where one short melody (the **subject**) is introduced by each voice in turn, then developed. Bach’s *Well-Tempered Clavier* has 48 of them.',
    ],
    deep: [
      '**Exposition**: subject in the tonic; **answer** in the dominant (a *real* answer is an exact transposition; a *tonal* answer adjusts intervals so the tonic–dominant relationship is kept); a **countersubject** accompanies later entries; a **codetta** may link entries. **Episodes** develop fragments, often in sequence, and modulate. Later devices: **stretto** (overlapping entries), **augmentation** and **diminution**, **inversion**, **pedal point**, and in double or triple fugues several subjects.',
      'Fugue is a procedure more than a fixed form; its textures reappear in Mozart’s finales, Beethoven’s late quartets, Shostakovich’s 24 Preludes and Fugues and in jazz (Dave Brubeck, the Modern Jazz Quartet).',
    ],
    related: ['counterpoint', 'form-overview', 'baroque'],
  },
  {
    id: 'harmonic-rhythm', section: 'harmony', title: 'Harmonic rhythm', level: 2,
    summary: 'How often the chords change.',
    simple: [
      '**Harmonic rhythm** is how often the chords change. A chord per bar feels relaxed; two chords per bar feels busier. Speeding up the chord changes towards a cadence builds excitement.',
    ],
    deep: [
      'Placement matters as much as rate: changes on strong beats confirm meter; syncopated changes (pushes) create drive in pop, funk and gospel. Static harmony (a vamp) shifts the listener’s attention to rhythm, timbre and melody, as in Afrobeat, modal jazz and minimalism.',
    ],
    related: ['functional-harmony', 'cadences', 'syncopation'],
  },
];
