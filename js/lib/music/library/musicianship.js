/* Music Library — ear training, practice, instruments in general, and history. */

export default [
  {
    id: 'ear-training', section: 'musicianship', title: 'Ear training', level: 1,
    summary: 'Recognising intervals, chords, rhythms and melodies by sound.',
    simple: [
      '**Ear training** teaches you to recognise what you hear: intervals, chords, scales, rhythms and whole melodies. It makes you faster at learning songs, improvising, tuning and playing with others.',
      { steps: ['Sing everything you practise — even badly.', 'Learn intervals with reference songs (see the interval table).', 'Tell major from minor chords, then the four triads, then seventh chords.', 'Sing back short melodies, then write them down (dictation).', 'Work out songs by ear on your instrument: bass line first, then melody, then chords.'] },
      { example: { type: 'eartrainer' } },
    ],
    deep: [
      '**Functional ear training** (hearing each note’s relationship to the tonic) often transfers better to real music than isolated intervals: play a cadence to set the key, then identify scale degrees. Relative pitch can be trained at any age; absolute (perfect) pitch is much more common in people who began music very young and in speakers of tonal languages (Deutsch et al.), though adults can improve pitch-class identification with sustained training.',
      'Advanced ear skills: chord quality and inversion, harmonic dictation (bass line + Roman numerals), recognising modes and tensions, **transcription** of solos, and **audiation** (Gordon: hearing music inwardly with understanding).',
    ],
    related: ['intervals', 'solfege', 'practice-methods', 'bebop-language'],
  },
  {
    id: 'solfege', section: 'musicianship', title: 'Solfège: do re mi', level: 1,
    summary: 'Singing syllables for scale degrees: movable and fixed do.',
    simple: [
      '**Solfège** gives each scale degree a syllable: **do re mi fa sol la ti do**. Singing with solfège trains you to hear each note’s role in the key.',
      'In **movable do**, *do* is always the tonic of the current key. In **fixed do** (used in Italy, France, Spain and much of Latin America), *do* is always C.',
      'Chromatic syllables: raised — *di ri fi si li*; lowered — *ra me se le te*.',
    ],
    deep: [
      'Minor keys are sung either **la-based** (the tonic is *la*: la ti do re mi fa sol) or **do-based** (do re me fa sol le te). The Kodály method pairs movable do with the **Curwen hand signs** and rhythm syllables; Guido of Arezzo introduced *ut re mi fa sol la* (from the hymn *Ut queant laxis*) in the 11th century, along with the **Guidonian hand** and hexachord system. Indian *sargam* (Sa Re Ga Ma Pa Dha Ni) and the Chinese jianpu numbers are parallel systems.',
    ],
    related: ['ear-training', 'scale-degrees', 'note-names', 'indian-classical'],
  },
  {
    id: 'practice-methods', section: 'musicianship', title: 'How to practise effectively', level: 1,
    summary: 'Deliberate practice, slow practice, spacing and recording yourself.',
    simple: [
      { steps: ['Set a **specific goal** for each session (“bars 9–16 at 80 BPM, no stops”).', 'Warm up for a few minutes: long tones, scales or simple exercises.', 'Practise the **hard bits slowly** and correctly, then raise the tempo in small steps with a metronome.', 'Short, frequent sessions (20–30 minutes daily) beat one long session a week.', 'Mix it up: technique, pieces, sight-reading, ear and improvisation.', '**Record yourself** and listen back as if you were the teacher.', 'End with something you enjoy playing.'] },
    ],
    deep: [
      'Research on expertise (Ericsson) emphasises **deliberate practice**: focused work at the edge of ability with immediate feedback. Motor learning studies support **interleaved** and **variable** practice for retention, **spacing** over days, **mental practice** as a supplement, and practising at performance tempo in chunks as well as slowly. Avoid repeating errors; stop, isolate, fix, then re-embed in context. Performance anxiety responds to regular mock performances, breathing, and cognitive reframing; beta blockers are sometimes prescribed by doctors for severe cases.',
    ],
    related: ['reading-music-roadmap', 'ear-training', 'theory-roadmap'],
  },
  {
    id: 'improvisation-basics', section: 'musicianship', title: 'Starting to improvise', level: 2,
    summary: 'Making up music on the spot, step by step.',
    simple: [
      { steps: ['Pick a backing loop (two chords is enough) and one scale that fits, such as the minor pentatonic.', 'Play just **three notes** for a while; make rhythms interesting.', 'Leave space: play a short phrase, then rest.', 'Repeat a phrase and change one thing (a note, the rhythm, the ending).', 'Aim for chord notes on strong beats; use other notes to connect them.', 'Copy phrases you like from recordings, then change them (that is how every improviser learns).'] },
    ],
    deep: [
      'Frameworks: motivic development, call and response with yourself, target-note practice through changes, guide-tone lines, chord-tone soloing before scales, rhythmic displacement, “outside” playing (side-slipping, superimposition) resolved back “inside”. Traditions of improvisation include Baroque continuo and cadenzas, Indian alap and taan, Arabic taqsim, jazz, blues, gospel, flamenco falsetas and griot praise singing.',
    ],
    related: ['pentatonic-blues', 'chord-scale-theory', 'bebop-language', 'blues'],
  },
  {
    id: 'instrument-families', section: 'instruments', title: 'Instrument families and ranges', level: 1,
    summary: 'Strings, woodwind, brass, percussion, keyboards, voices.',
    simple: [
      'The orchestra has four families: **strings** (violin, viola, cello, double bass, harp), **woodwind** (flute, oboe, clarinet, bassoon, saxophone), **brass** (trumpet, horn, trombone, tuba) and **percussion** (timpani, snare, cymbals, xylophone…). Bands add **keyboards**, guitars, bass and drum kit; choirs add **voices** (soprano, alto, tenor, bass).',
      { table: { head: ['Instrument', 'Approximate written or sounding range'], rows: [['Piano', 'A0–C8 (88 keys)'], ['Violin', 'G3–A7'], ['Viola', 'C3–E6'], ['Cello', 'C2–C6'], ['Double bass', 'E1–G4 (sounds)'], ['Flute', 'C4–C7'], ['Clarinet in B♭', 'D3–C7 (sounds a tone lower)'], ['Alto saxophone', 'D♭3–A5 (sounds)'], ['Trumpet in B♭', 'E3–C6 (sounds)'], ['Horn in F', 'B1–F5 (sounds)'], ['Trombone', 'E2–F5'], ['Tuba', 'D1–F4'], ['Guitar', 'E2–B5 (sounds)'], ['Bass guitar', 'E1–G4 (sounds)'], ['Soprano voice', 'C4–A5'], ['Alto voice', 'F3–D5'], ['Tenor voice', 'C3–A4'], ['Bass voice', 'E2–E4']] } },
    ],
    deep: [
      'Score order (top to bottom): woodwinds, brass, percussion, keyboards and harp, soloists and voices, strings. Ranges above are practical; professional players extend them. Hornbostel–Sachs classifies instruments by vibrating body rather than by orchestral family, which better fits the world’s instruments.',
    ],
    related: ['timbre', 'transposing-instruments', 'arranging'],
  },
  {
    id: 'transposing-instruments', section: 'instruments', title: 'Transposing instruments', level: 3,
    summary: 'Why a clarinet’s written C sounds B♭.',
    simple: [
      'Some instruments read music written in a different key from how it sounds. A **B♭ trumpet** or **clarinet** playing a written C sounds a B♭. An **E♭ alto sax** playing a written C sounds an E♭ (a major sixth lower).',
      'This lets players use the same fingerings on instruments of the same family in different sizes.',
      { example: { type: 'transpose' } },
    ],
    deep: [
      'Name the instrument by its sounding pitch for written C: in B♭ (clarinet, trumpet, soprano and tenor sax), in E♭ (alto and baritone sax, E♭ clarinet), in F (horn, cor anglais), in A (A clarinet). To write for a B♭ instrument, write a major second **higher** than concert pitch (tenor sax: a major ninth higher). Octave transposers: guitar and double bass sound an octave lower than written; piccolo, glockenspiel and celesta sound higher.',
    ],
    related: ['instrument-families', 'arranging', 'the-staff'],
  },
  {
    id: 'medieval-renaissance', section: 'history', title: 'Medieval and Renaissance music (c. 500–1600)', level: 2,
    summary: 'Chant, organum, the Notre-Dame school, Ars Nova, Josquin and Palestrina.',
    simple: [
      'European notated music begins with **Gregorian chant**: single-line sung prayers. From around 900, singers added a second line (**organum**), and polyphony grew. The **Renaissance** (c. 1400–1600) brought smooth, balanced polyphony by composers like **Josquin des Prez** and **Palestrina**, and the printing of music.',
    ],
    deep: [
      'Milestones: neumes and the staff (Guido of Arezzo), the Notre-Dame school (Léonin, Pérotin) and rhythmic modes, Ars Nova (Philippe de Vitry, Machaut) and isorhythm, Ars subtilior, the English *contenance angloise* (Dunstable) with its thirds and sixths, the Franco-Flemish masters (Du Fay, Ockeghem, Josquin), Palestrina’s style after the Council of Trent, the madrigal (Marenzio, Gesualdo’s chromaticism, Monteverdi), and instrumental dance music. Theory: the modal system, hexachords and musica ficta.',
    ],
    related: ['modes', 'counterpoint', 'baroque'],
  },
  {
    id: 'baroque', section: 'history', title: 'Baroque (c. 1600–1750)', level: 2,
    summary: 'Opera, figured bass, the concerto, Bach, Handel and Vivaldi.',
    simple: [
      'The Baroque era invented **opera** and the **concerto**, and built music over a **basso continuo** (a bass line with improvised chords). Major–minor keys replaced the old modes. Key composers: **Monteverdi, Vivaldi, Bach, Handel, Purcell, Scarlatti**.',
    ],
    deep: [
      'Techniques and forms: figured bass, ritornello form, the fugue, dance suites (allemande, courante, sarabande, gigue), the trio sonata, the *concerto grosso*, the Doctrine of the Affections, terraced dynamics, ornamentation conventions, and well-tempered tunings. Rameau’s *Traité de l’harmonie* (1722) laid the foundations of chord-root theory.',
    ],
    related: ['fugue', 'counterpoint', 'inversions', 'classical-era'],
  },
  {
    id: 'classical-era', section: 'history', title: 'Classical era (c. 1750–1820)', level: 2,
    summary: 'Haydn, Mozart, Beethoven: clarity, balance and sonata form.',
    simple: [
      'The Classical era prized clear melodies with simple accompaniment, balanced phrases and dramatic contrasts. It developed the **symphony**, **string quartet** and **sonata**. Key composers: **Haydn, Mozart, Beethoven** (who also opened the Romantic era).',
    ],
    deep: [
      'Galant style and *Empfindsamkeit* (C.P.E. Bach) led into the Viennese Classical style: periodic phrasing, Alberti bass, homophonic texture, harmonic rhythm that clarifies form, and the sonata cycle (fast–slow–minuet–fast). The fortepiano replaced the harpsichord; public concerts and published scores grew.',
    ],
    related: ['sonata-form', 'phrase-structure', 'romantic-era'],
  },
  {
    id: 'romantic-era', section: 'history', title: 'Romantic era (c. 1820–1900)', level: 2,
    summary: 'Emotion, nationalism, virtuosity and expanding harmony.',
    simple: [
      'Romantic composers wanted music to express intense emotions, stories and national identity. Orchestras got bigger and harmony more chromatic. Key composers: **Schubert, Chopin, Liszt, Wagner, Verdi, Brahms, Tchaikovsky, Dvořák**.',
    ],
    deep: [
      'Features: chromatic harmony and remote modulation (third relations, enharmonic pivots), the Lied and character piece, programme music and the symphonic poem, leitmotif and music drama (Wagner’s *Tristan* chord and its unresolved tonality), nationalist schools (the Russian Five, Smetana, Grieg), virtuosity (Paganini, Liszt), and the expansion of the orchestra (Berlioz’s treatise). Late Romanticism (Mahler, Strauss) stretched tonality to its limits.',
    ],
    related: ['chromatic-mediants', 'augmented-sixths', 'twentieth-century'],
  },
  {
    id: 'jazz-history', section: 'history', title: 'A short history of jazz', level: 2,
    summary: 'From New Orleans to today.',
    simple: [
      { list: ['**1900s–1920s**: New Orleans jazz — collective improvisation (Louis Armstrong).', '**1930s**: Swing — big bands (Duke Ellington, Count Basie).', '**1940s**: Bebop — fast, complex improvisation (Charlie Parker, Dizzy Gillespie).', '**1950s**: Cool, hard bop, and modal jazz (Miles Davis, Art Blakey).', '**1960s**: Free jazz and post-bop (Ornette Coleman, John Coltrane, Wayne Shorter).', '**1970s**: Fusion with rock and funk (Weather Report, Herbie Hancock), and **Ethio-jazz** (Mulatu Astatke).', '**1980s–now**: neo-traditional, contemporary and global jazz, hip-hop fusions (Robert Glasper, Kamasi Washington, Shabaka Hutchings).'] },
    ],
    deep: [
      'Roots: blues, ragtime (Scott Joplin), brass-band music, spirituals and the Afro-Caribbean “Spanish tinge”. African jazz developed its own lineages: South African marabi and mbaqanga into Hugh Masekela and Abdullah Ibrahim, Nigerian highlife-jazz, and Fela Kuti’s Afrobeat fusion of jazz, funk and Yoruba music.',
    ],
    related: ['jazz-harmony', 'blues', 'bebop-language', 'modal-jazz'],
  },
  {
    id: 'popular-history', section: 'history', title: 'A short history of popular music', level: 1,
    summary: 'Blues and gospel to rock, soul, reggae, hip-hop, Afrobeats and K-pop.',
    simple: [
      { list: ['**1920s–40s**: blues, jazz, Tin Pan Alley, country, gospel; West African highlife begins.', '**1950s**: rhythm and blues and rock and roll; Latin mambo and cha-cha.', '**1960s**: soul and Motown, the Beatles and rock, reggae (Jamaica), bossa nova (Brazil), jùjú (Nigeria).', '**1970s**: funk, disco, punk, Afrobeat (Fela Kuti), salsa, early hip-hop (Bronx).', '**1980s–90s**: synth-pop, house and techno, hip-hop’s golden age, R&B, grunge, dancehall, kwaito.', '**2000s–now**: streaming, trap, EDM, Afrobeats (Wizkid, Burna Boy, Davido, Tems), amapiano, K-pop, Latin urban and reggaeton.'] },
    ],
    deep: [
      'Technology shaped each wave: the microphone (crooning), the electric guitar and amplifier, multitrack tape, synthesizers and drum machines (the Roland TR-808, 1980), sampling, the DAW and Auto-Tune, and streaming algorithms that favour short intros and early hooks.',
    ],
    related: ['modern-genres', 'rock-pop-harmony', 'african-music', 'song-forms'],
  },
  {
    id: 'theory-roadmap', section: 'roadmaps', title: 'Roadmap: learning music theory', level: 1,
    summary: 'A path from first notes to advanced harmony.',
    simple: [
      { roadmap: [
        { stage: 'Beginner (weeks 1–8)', items: ['[[note-names|Note names and the keyboard]]', '[[the-staff|The staff and clefs]]', '[[note-values|Note values]] and [[time-signatures|time signatures]]', '[[half-and-whole-steps|Half and whole steps]]', '[[major-scale|The major scale]]'] },
        { stage: 'Foundation (months 2–6)', items: ['[[intervals|Intervals]]', '[[key-signatures|Keys]] and the [[circle-of-fifths|circle of fifths]]', '[[minor-scales|Minor scales]]', '[[triads|Triads]] and [[inversions|inversions]]', '[[roman-numerals|Roman numerals]] and [[common-progressions|common progressions]]'] },
        { stage: 'Intermediate (6–18 months)', items: ['[[seventh-chords|Seventh chords]]', '[[functional-harmony|Harmonic function]] and [[cadences|cadences]]', '[[modes|Modes]]', '[[non-chord-tones|Non-chord tones]]', '[[form-overview|Form]] and [[phrase-structure|phrase structure]]', '[[voice-leading|Voice leading]]'] },
        { stage: 'Advanced (1.5–3 years)', items: ['[[secondary-dominants|Secondary dominants]] and [[modulation|modulation]]', '[[modal-mixture|Borrowed chords]]', '[[counterpoint|Counterpoint]]', '[[jazz-harmony|Jazz harmony]] or [[sonata-form|sonata form]]', '[[extended-chords|Extended chords]]'] },
        { stage: 'Expert', items: ['[[augmented-sixths|Augmented sixths]] and the [[neapolitan|Neapolitan]]', '[[chord-scale-theory|Chord–scale theory]] and [[reharmonisation|reharmonisation]]', '[[post-tonal|Post-tonal theory]]', '[[just-intonation|Tuning systems]]', 'A world tradition in depth: [[indian-classical|raga]], [[arabic-maqam|maqam]], [[african-rhythm|African rhythm]]'] },
      ] },
      { tip: 'Always apply each topic on your instrument and in songs you love. Theory sticks when you hear and play it.' },
    ],
    deep: [
      'Exam frameworks follow similar arcs: ABRSM and Trinity theory grades 1–8, the AP Music Theory syllabus (US), and university sequences (fundamentals, diatonic harmony, chromatic harmony, form, post-tonal). Jazz programmes add ear training and transcription from the start.',
    ],
    related: ['reading-music-roadmap', 'practice-methods', 'ear-training'],
  },
];
