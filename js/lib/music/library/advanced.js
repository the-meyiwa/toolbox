/* Music Library — 20th-century and post-tonal theory, tuning, temperament and acoustics. */

export default [
  {
    id: 'impressionism', section: 'modern', title: 'Impressionist harmony', level: 3,
    summary: 'Debussy and Ravel: planing, whole-tone, pentatonic and unresolved colour.',
    simple: [
      'Around 1890–1920, **Debussy** and **Ravel** treated chords as colours rather than steps in a journey home. They moved whole chords in parallel, used whole-tone and pentatonic scales, and let dissonances float without resolving.',
    ],
    deep: [
      'Techniques: **planing** (parallel chords, diatonic or chromatic/real), unresolved ninth and eleventh chords, **whole-tone** and **octatonic** collections, pentatonic melody (influenced by gamelan and East Asian music), modal mixture, pedal points, extended forms built on timbre and register (“La cathédrale engloutie”, “Voiles”). The language flowed directly into jazz (Bill Evans) and film music.',
    ],
    related: ['symmetric-scales', 'gamelan', 'extended-chords', 'twentieth-century'],
  },
  {
    id: 'post-tonal', section: 'modern', title: 'Post-tonal theory and set classes', level: 4,
    summary: 'Pitch classes, normal form, prime form, Forte numbers and interval vectors.',
    simple: [
      'After about 1908, composers such as Schoenberg, Berg and Webern wrote **atonal** music with no home key. To analyse it, theorists count notes as **pitch classes** 0–11 (C = 0, C♯ = 1 … B = 11) and study the collections (sets) they form.',
    ],
    deep: [
      '**Normal form**: the most compact ascending ordering of a set. **Prime form**: the normal form transposed to start on 0 and compared with its inversion, choosing the one packed most to the left — e.g. the major and minor triads are both set class **(037)**, Forte **3-11**. **Interval vector** counts interval classes 1–6: the diatonic scale is ⟨254361⟩, the major triad ⟨001110⟩. **Z-related** sets share a vector without being related by transposition or inversion (4-Z15 and 4-Z29, the “all-interval tetrachords”).',
      'Operations: transposition Tn (add n mod 12) and inversion In (n − x mod 12). **Combinatoriality**, **invariance** and **set-class genera** extend the theory; Allen Forte’s *The Structure of Atonal Music* (1973) and Joseph Straus’s *Introduction to Post-Tonal Theory* are the standard references.',
    ],
    related: ['twelve-tone', 'symmetric-scales', 'twentieth-century'],
  },
  {
    id: 'twelve-tone', section: 'modern', title: 'Twelve-tone technique and serialism', level: 4,
    summary: 'Rows, the 48 forms and the matrix.',
    simple: [
      '**Twelve-tone** music (Schoenberg, 1920s) arranges all twelve notes in a fixed order called a **row** (series). The whole piece is built from that row, played forwards, backwards, upside down, and transposed — so no note becomes a home note.',
    ],
    deep: [
      'Row forms: **P** (prime), **I** (inversion), **R** (retrograde), **RI** (retrograde inversion), each in 12 transpositions: 48 forms, laid out in a 12 × 12 **matrix**. **Hexachordal combinatoriality** (the first hexachord of P0 combining with the first of I5 to make all twelve notes) was central to Schoenberg’s later style. Berg’s rows often contain triads (Violin Concerto); Webern favoured symmetrical, derived rows. **Integral (total) serialism** (Messiaen’s *Mode de valeurs*, Boulez, Stockhausen, Babbitt) serialises durations, dynamics and articulations too.',
    ],
    related: ['post-tonal', 'twentieth-century'],
  },
  {
    id: 'twentieth-century', section: 'modern', title: 'Twentieth-century and contemporary techniques', level: 3,
    summary: 'Polytonality, quartal harmony, minimalism, spectralism, aleatoric music.',
    simple: [
      'Twentieth-century composers explored many new approaches:',
      { list: ['**Polytonality**: two keys at once (Stravinsky, Milhaud).', '**Quartal harmony**: chords built in fourths instead of thirds (Hindemith, jazz).', '**Minimalism**: repeating patterns that change slowly (Steve Reich, Philip Glass, Terry Riley).', '**Aleatoric** music: chance elements (John Cage).', '**Electronic and tape music**: sounds made or transformed with technology.'] },
    ],
    deep: [
      'Also: **neoclassicism** (Stravinsky, Prokofiev), **folk modalism** (Bartók’s axis and acoustic scale, Kodály), **pandiatonicism** (diatonic notes without functional progression, Copland), **sound-mass** (Ligeti’s micropolyphony, Penderecki’s clusters), **spectralism** (Grisey, Murail: harmony derived from analysed spectra), **process music** (Reich’s phasing in *Piano Phase*; Glass’s additive rhythm), **new complexity** (Ferneyhough), **postminimalism** (Adams), **holy minimalism** (Pärt’s tintinnabuli), and **extended techniques** (multiphonics, prepared piano, bowed percussion).',
    ],
    related: ['impressionism', 'post-tonal', 'microtonality', 'minimalism-process'],
  },
  {
    id: 'minimalism-process', section: 'modern', title: 'Minimalism and process music', level: 3,
    summary: 'Repetition, phasing and additive rhythm.',
    simple: [
      '**Minimalist** music repeats short patterns for a long time and changes them gradually, so small shifts feel huge. Terry Riley’s *In C* (1964) has 53 short phrases performers repeat at will.',
    ],
    deep: [
      '**Phasing** (Reich, *It’s Gonna Rain*, *Piano Phase*): identical patterns drift out of sync to form new resultant rhythms. **Additive and subtractive** processes (Glass, *Music in Twelve Parts*) lengthen or shorten patterns note by note. Reich cited Ghanaian Ewe drumming and Balinese gamelan as influences. Minimalism fed into ambient, electronic dance music and film scoring.',
    ],
    related: ['twentieth-century', 'african-rhythm', 'gamelan'],
  },
  {
    id: 'harmonic-series', section: 'acoustics', title: 'The harmonic series', level: 2,
    summary: 'The overtones inside every note.',
    simple: [
      'When you play a note, you also hear fainter higher notes called **overtones** (harmonics) at 2×, 3×, 4× … the frequency. From a low C they are: C, C, G, C, E, G, B♭ (flat), C, D, E …',
      { example: { type: 'harmonics', fundamental: 'C2' } },
      'These overtones blend into one sound. Their mix gives each instrument its **timbre**, and their intervals (octave, fifth, fourth, major third) are the most consonant intervals.',
    ],
    deep: [
      'Harmonic n has frequency n·f. Intervals between successive harmonics shrink: 2:1 octave, 3:2 fifth, 4:3 fourth, 5:4 major third, 6:5 minor third, 7:6 septimal minor third. The 7th harmonic is 31 cents flat of equal-tempered B♭, the 11th about half-way between F and F♯. Brass players select harmonics by lip tension (natural horns and bugles play only these notes); string players touch nodes to sound natural harmonics.',
      'Real instruments are often **inharmonic**: piano strings’ stiffness raises upper partials (hence “stretched” octave tuning), and bells and gongs have non-integer partials (the minor-third “hum” of a church bell).',
    ],
    related: ['timbre', 'just-intonation', 'consonance-dissonance', 'pitch-and-frequency'],
  },
  {
    id: 'timbre', section: 'acoustics', title: 'Timbre and how instruments make sound', level: 2,
    summary: 'Vibrating strings, air columns, membranes, bars and electronics.',
    simple: [
      'Instruments make sound in a few ways:',
      { list: ['**Strings** (chordophones): plucked, bowed or struck strings — guitar, violin, piano, kora.', '**Wind** (aerophones): vibrating air in a tube — flute, clarinet, trumpet, voice (sort of).', '**Membranes** (membranophones): a stretched skin — drums, talking drum.', '**Solid bodies** (idiophones): the instrument itself vibrates — xylophone, bells, mbira, shakers.', '**Electronics** (electrophones): synthesizers and electric instruments.'] },
      'Timbre is shaped by which overtones are loud, how the sound starts (attack) and how it changes over time.',
    ],
    deep: [
      'This is the Hornbostel–Sachs classification (1914). Acoustics: open cylindrical pipes (flute) support all harmonics; closed cylindrical pipes (clarinet) favour odd harmonics, so the clarinet overblows a twelfth; conical bores (oboe, saxophone) behave like open pipes. Formants — resonant frequency bands fixed by body shape — explain why vowels and instruments keep their identity across pitches. The **envelope** (ADSR in synthesis) and transients are as important to recognition as the steady spectrum.',
    ],
    related: ['harmonic-series', 'instrument-families', 'synthesizer'],
  },
  {
    id: 'pythagorean-tuning', section: 'acoustics', title: 'Pythagorean tuning', level: 4,
    summary: 'Tuning by pure fifths, and the comma that spoils it.',
    simple: [
      'Tuning by stacking pure fifths (3:2) was the medieval European approach, credited to Pythagoras. It gives beautiful fifths but very bright, tense major thirds.',
    ],
    deep: [
      'Twelve pure fifths exceed seven octaves by the **Pythagorean comma**, 531441:524288 ≈ 23.46 cents; closing the circle forces one badly out-of-tune “wolf” fifth. The Pythagorean major third (81:64, 407.8 cents) is 21.5 cents (the **syntonic comma**, 81:80) wider than the pure 5:4 third — acceptable in medieval music where thirds were dissonances, problematic once triads became the norm.',
    ],
    related: ['just-intonation', 'equal-temperament', 'circle-of-fifths'],
  },
  {
    id: 'just-intonation', section: 'acoustics', title: 'Just intonation and meantone', level: 4,
    summary: 'Pure intervals from simple ratios, and historic compromises.',
    simple: [
      '**Just intonation** tunes intervals to simple ratios from the harmonic series: the major third 5:4, the fifth 3:2. Chords sound very pure — but only in one key. Choirs and string quartets naturally lean towards just intervals.',
      { example: { type: 'just' } },
    ],
    deep: [
      'A just major scale (1, 9/8, 5/4, 4/3, 3/2, 5/3, 15/8) has two sizes of whole tone (9/8 and 10/9) and one of its fifths (D–A, 40:27) is a comma flat. **Quarter-comma meantone** (Renaissance and early Baroque) tempers each fifth by ¼ syntonic comma to make pure major thirds in common keys, with a wolf in remote keys. **Well temperaments** (Werckmeister, Kirnberger, Vallotti, Young) distribute the comma unevenly so every key is usable but each has its own colour — the tuning world of Bach’s *Well-Tempered Clavier*. Extended just intonation (Harry Partch, Ben Johnston) uses higher primes (7, 11, 13).',
    ],
    related: ['equal-temperament', 'pythagorean-tuning', 'harmonic-series', 'microtonality'],
  },
  {
    id: 'equal-temperament', section: 'acoustics', title: 'Equal temperament and cents', level: 3,
    summary: 'Twelve equal semitones: every key usable, nothing quite pure.',
    simple: [
      'Modern keyboards use **twelve-tone equal temperament**: the octave is split into twelve equal half steps. Every key sounds the same and you can play in all of them, but most intervals are very slightly out from pure.',
    ],
    deep: [
      'Each semitone is 2^(1/12) (100 cents). The ET fifth is 700 cents (pure: 701.96), the ET major third 400 cents (pure: 386.31, about 14 cents narrower). ET became standard for pianos in the 19th century; the mathematics was published independently by Zhu Zaiyu (1584) and Simon Stevin (c. 1605). Other equal divisions: 19-TET and 31-TET approximate meantone; 24-TET gives quarter tones; 53-TET approximates Pythagorean and just intervals almost perfectly (Turkish theory).',
    ],
    related: ['just-intonation', 'pitch-and-frequency', 'microtonality'],
  },
  {
    id: 'microtonality', section: 'acoustics', title: 'Microtones', level: 4,
    summary: 'Intervals smaller than a semitone, in tradition and experiment.',
    simple: [
      '**Microtones** are intervals smaller than a half step. They are normal in Arabic, Turkish, Persian and Indian music and in blues singing, and are explored by experimental composers and some modern rock bands.',
    ],
    deep: [
      'Notation: half-sharp and half-flat symbols (Arabic, Tartini-style), arrows for small inflections, Helmholtz–Ellis symbols for just ratios, cents deviations above notes. Composers and systems: Julián Carrillo (Sonido 13), Alois Hába, Ivan Wyschnegradsky (quarter tones), Harry Partch (43-tone just scale), Wendy Carlos (alpha, beta, gamma scales), Easley Blackwood, spectralists, and rock bands such as King Gizzard & the Lizard Wizard using 24-TET guitars.',
    ],
    related: ['arabic-maqam', 'indian-classical', 'just-intonation', 'equal-temperament'],
  },
];
