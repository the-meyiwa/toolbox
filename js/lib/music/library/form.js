/* Music Library — advanced rhythm, melody, form, texture, composition and arranging. */

export default [
  {
    id: 'syncopation', section: 'rhythm', title: 'Syncopation, swing and groove', level: 2,
    summary: 'Accents off the beat, uneven eighths and the feel that makes people move.',
    simple: [
      '**Syncopation** puts emphasis where you do not expect it: on the “and” between beats, or on weak beats. It is the lift in funk, reggae, Afrobeats, jazz and pop.',
      '**Swing** plays pairs of eighth notes unevenly, long–short (“doo-ba doo-ba”), roughly like a triplet with the first two notes tied.',
      '**Groove** is the combined feel of a rhythm section: where each player places notes slightly ahead of or behind the beat, how accents and ghost notes are balanced.',
    ],
    deep: [
      'Swing ratios vary with tempo: near 2:1 (triplet) at medium tempos, flatter (closer to straight) at fast tempos, and heavier at slow shuffles. Micro-timing studies show drummers’ ride patterns and bass players’ lines often sit a few milliseconds apart by design (“laid-back” versus “on top”).',
      '**Backbeat** (accents on 2 and 4) defines rock, R&B and soul; the reggae **one drop** leaves beat 1 empty and hits 3; **clave** organises Afro-Cuban music; the **12/8 bell pattern** organises much West African music; the Brazilian **partido alto** and **bossa nova** patterns are syncopated two-bar cycles.',
    ],
    related: ['rhythm-basics', 'clave-and-latin', 'african-rhythm', 'drum-kit'],
  },
  {
    id: 'tuplets-and-polyrhythm', section: 'rhythm', title: 'Triplets, tuplets and polyrhythm', level: 3,
    summary: 'Three against two, four against three, and layered cycles.',
    simple: [
      'A **triplet** squeezes three notes into the time of two. A **polyrhythm** plays two different even divisions at once: **3 against 2** (“nice cup of tea”), **4 against 3** (“pass the golden butter”).',
      { example: { type: 'polyrhythm', a: 3, b: 2 } },
      'Polyrhythm is central to West African music, where several drum parts interlock in different cycles over a steady bell.',
    ],
    deep: [
      'Distinguish **polyrhythm** (different subdivisions of the same span, e.g. 3:2) from **polymeter** (different bar lengths that realign after their least common multiple, e.g. 4/4 against 3/4 realigning every 12 beats). **Cross-rhythm** is the African-music term for a pattern that implies a conflicting meter against the main one.',
      'Composite rhythm of 3:2 is 1, 2, x, 2, 1 in six pulses; of 4:3, twelve pulses with hits at 0, 3, 4, 6, 8, 9. Chopin, Brahms and Scriabin use 3:2, 4:3 and 5:4 extensively; Meshuggah and progressive metal use polymeter against 4/4.',
    ],
    related: ['african-rhythm', 'time-signatures', 'odd-meters'],
  },
  {
    id: 'odd-meters', section: 'rhythm', title: 'Odd meters and additive rhythm', level: 3,
    summary: '5/4, 7/8, 11/16 and how to feel them.',
    simple: [
      '**Odd meters** have beats that group unevenly. Count them as groups of 2s and 3s: 5/4 as 3+2 (“Take Five”), 7/8 as 2+2+3 or 3+2+2.',
      { example: { type: 'meter', meters: ['5/4', '7/8', '9/8', '11/8'] } },
    ],
    deep: [
      'Balkan dances name their groupings: *lesnoto* 7/8 (3+2+2), *kopanitsa* 11/16 (2+2+3+2+2), *ruchenitsa* 7/16 (2+2+3). Indian tala cycles such as *rupak* (7 beats, 3+2+2) and *jhaptal* (10 beats, 2+3+2+3) are additive; Carnatic music counts with *tala* hand gestures. Aksak rhythms are also found in Turkish usul and in Central African music.',
    ],
    related: ['time-signatures', 'indian-classical', 'tuplets-and-polyrhythm'],
  },
  {
    id: 'melody-basics', section: 'melody', title: 'Melody: contour, steps and leaps', level: 1,
    summary: 'What makes a tune singable and memorable.',
    simple: [
      'A **melody** is a series of notes heard as a line. Most memorable melodies:',
      { list: ['Move mostly by **step**, with occasional **leaps** for drama.', 'After a big leap, often step back in the other direction.', 'Have a clear **contour** — an arch, a wave, a rise to a high point (climax) then a fall.', 'Repeat a short idea (**motif**) with small changes.', 'Land on stable notes (1, 3, 5 of the chord) at important moments.'] },
    ],
    deep: [
      'Gap-fill: listeners expect a leap to be followed by steps that fill the gap (Meyer, Narmour). The climax typically occurs once, often around two-thirds through the phrase. Chord tones on strong beats and non-chord tones on weak beats define a “consonant” melodic style; appoggiaturas reverse this for emotional weight.',
      'Melodic development techniques: **repetition**, **sequence** (repeat at another pitch), **inversion** (upside down), **retrograde** (backwards), **augmentation/diminution** (longer/shorter note values), **fragmentation**, **extension** and **ornamentation**.',
    ],
    related: ['motif-development', 'phrase-structure', 'non-chord-tones', 'songwriting'],
  },
  {
    id: 'motif-development', section: 'melody', title: 'Motifs and development', level: 3,
    summary: 'How composers grow whole pieces from tiny ideas.',
    simple: [
      'A **motif** is a short, recognisable musical idea — Beethoven’s Fifth opens with a four-note one (da-da-da-DUM). Composers repeat, vary and combine motifs to build whole pieces.',
    ],
    deep: [
      'Transformations: transposition, sequence, inversion, retrograde, retrograde inversion, augmentation, diminution, rhythmic displacement, interval expansion/contraction, fragmentation, liquidation (Schoenberg’s term for stripping a motif to its essentials before a cadence). **Developing variation** (Schoenberg on Brahms) derives new themes from earlier motifs; **thematic transformation** (Liszt, Wagner’s *leitmotifs*, film scores) re-characterises one theme for different dramatic situations.',
    ],
    related: ['melody-basics', 'sonata-form', 'film-scoring'],
  },
  {
    id: 'phrase-structure', section: 'melody', title: 'Phrases, periods and sentences', level: 3,
    summary: 'Question and answer: how melodies are paced.',
    simple: [
      'Music breathes in **phrases**, often four bars long. Two phrases often pair as a **question and answer**: the first ends open (on V, a half cadence), the second closes (on I).',
    ],
    deep: [
      'A **period**: antecedent (ending on a weak cadence) + consequent (ending on a stronger one); parallel if both begin alike, contrasting if not. A **sentence** (Schoenberg, Caplin): presentation (a basic idea, then its repetition) + continuation (fragmentation, faster harmonic rhythm) + cadence, typically 2+2+4 bars. Phrase **expansion**, **elision** (one phrase’s end is the next one’s start) and **hypermeter** shape larger spans.',
    ],
    related: ['cadences', 'melody-basics', 'form-overview'],
  },
  {
    id: 'texture', section: 'form', title: 'Texture', level: 1,
    summary: 'Monophony, homophony, polyphony and heterophony.',
    simple: [
      '**Texture** describes how the layers of music fit together:',
      { list: ['**Monophony**: one melody alone (unaccompanied chant, a solo flute).', '**Homophony**: a melody with chords underneath (most pop songs, hymns).', '**Polyphony**: several independent melodies at once (a fugue, Dixieland jazz).', '**Heterophony**: several people playing the same tune with different decorations at the same time (Arabic ensembles, Irish sessions, gamelan).'] },
    ],
    deep: [
      'Further distinctions: melody-and-accompaniment versus chordal homophony (homorhythm); **biphony** (melody over a drone, as in bagpipes and Indian classical music); **interlocking** (hocket, where notes of one line alternate between players — medieval hocket, Ugandan *amadinda* xylophone, Balinese *kotekan*); **layered** textures of minimalism and electronic music.',
    ],
    related: ['counterpoint', 'form-overview', 'gamelan', 'arranging'],
  },
  {
    id: 'form-overview', section: 'form', title: 'Musical form', level: 1,
    summary: 'How pieces are organised: letters for sections, repetition and contrast.',
    simple: [
      '**Form** is the plan of a piece. Musicians label sections with letters: the first idea is **A**, a contrasting idea **B**, a return of the first **A** again.',
      { table: { head: ['Form', 'Plan', 'Example'], rows: [['Strophic', 'A A A (same music, new words)', 'Hymns, folk ballads'], ['Binary', 'A B', 'Baroque dances'], ['Ternary', 'A B A', 'Minuet and trio, many arias'], ['Rondo', 'A B A C A', 'Classical finales'], ['Theme and variations', 'A A′ A″ A‴', '“Twinkle” variations (Mozart)'], ['Verse–chorus', 'Intro, verse, chorus, verse, chorus, bridge, chorus', 'Most pop songs'], ['12-bar blues', 'Repeating 12-bar chord cycle', 'Blues, rock and roll'], ['32-bar AABA', 'A A B A, 8 bars each', 'Jazz standards']] } },
    ],
    deep: [
      '**Rounded binary** (||: A :||: B A′ :||) is the seed of sonata form. **Ritornello** form (Baroque concerto) alternates tutti refrains with solo episodes. **Sonata-rondo** (A B A C A B A) merges rondo with sonata key plans. **Through-composed** pieces (many art songs, film cues) do not repeat sections. **Arch form** (A B C B A) appears in Bartók.',
      'Popular forms: the **AABA** Tin Pan Alley song, **verse–chorus** with pre-chorus and post-chorus, **EDM** form (intro, build, drop, breakdown, build, drop, outro), **hip-hop** 16-bar verses and 8-bar hooks, and the call-and-response cycles of African and African-diaspora music.',
    ],
    related: ['sonata-form', 'song-forms', 'blues', 'fugue', 'phrase-structure'],
  },
  {
    id: 'sonata-form', section: 'form', title: 'Sonata form', level: 4,
    summary: 'Exposition, development, recapitulation.',
    simple: [
      '**Sonata form** is the big form of Classical symphonies and sonatas. It works like a story: introduce two contrasting themes in two keys (**exposition**), put them in conflict and wander through keys (**development**), then bring both themes back in the home key (**recapitulation**).',
    ],
    deep: [
      'Exposition: first theme group (tonic) – transition (modulating) – second theme group (dominant in major, relative major in minor) – closing section, usually repeated. Development: fragmentation, sequence, distant keys, a retransition on the dominant. Recapitulation: both groups in the tonic (the transition is recomposed). Optional slow introduction and coda.',
      'Sonata theory (Hepokoski and Darcy) describes norms such as the **medial caesura** before the second theme and the **essential expositional closure**; Caplin’s formal functions describe themes as sentences and periods. The form evolved from Baroque binary and dominated from Haydn and Mozart through Brahms and beyond.',
    ],
    related: ['form-overview', 'modulation', 'motif-development', 'classical-era'],
  },
  {
    id: 'song-forms', section: 'form', title: 'Song sections: verse, chorus, bridge', level: 1,
    summary: 'The parts of a modern song and what each does.',
    simple: [
      { list: ['**Intro**: sets the mood and groove.', '**Verse**: tells the story; new words each time, same music.', '**Pre-chorus**: builds tension into the chorus.', '**Chorus** (hook): the main message; same words each time; usually the catchiest, highest-energy part.', '**Post-chorus**: a short hook after the chorus (often wordless or a repeated phrase).', '**Bridge** (middle 8): a contrasting section before the last chorus.', '**Outro**: the ending.'] },
      'A common plan: Intro – Verse – Pre-chorus – Chorus – Verse – Pre-chorus – Chorus – Bridge – Chorus – Outro.',
    ],
    deep: [
      'Energy mapping: arrangers add and remove layers (drums, bass, pads, backing vocals) to give each section a distinct density; choruses typically raise melody register, harmonic rhythm or both. Many modern hits move the chorus or hook to the first 30 seconds. In Afrobeats and amapiano, sections are often defined by texture and percussion changes more than chord changes.',
    ],
    related: ['form-overview', 'songwriting', 'arranging', 'modern-genres'],
  },
  {
    id: 'songwriting', section: 'composition', title: 'Songwriting', level: 2,
    summary: 'Melody, lyrics, chords and structure — a practical process.',
    simple: [
      { steps: ['Start with a **hook**: a short lyric phrase or melody you cannot forget.', 'Choose a feel: tempo, groove and a simple chord loop (try I–V–vi–IV or vi–IV–I–V).', 'Write the **chorus** first — it carries the title and main idea.', 'Write verses that tell the story or give details the chorus sums up.', 'Contrast the sections: lower, sparser verses; higher, fuller chorus.', 'Fit words to the rhythm of speech: stressed syllables on strong beats.', 'Record rough demos on your phone; revise ruthlessly.'] },
    ],
    deep: [
      'Prosody — matching lyric stress, vowel length and meaning to melody and rhythm — separates amateur from professional writing (Pat Pattison). Rhyme schemes (AABB, ABAB, XAXA), internal rhyme and the rhythm of line lengths control momentum. Melodic contrast between sections (range, rhythm density, starting beat, register) matters more than harmonic change in modern pop. Co-writing, topline writing (melody and lyrics over a producer’s track) and splits/publishing are the professional reality.',
    ],
    related: ['song-forms', 'melody-basics', 'common-progressions', 'arranging'],
  },
  {
    id: 'arranging', section: 'composition', title: 'Arranging and orchestration basics', level: 3,
    summary: 'Deciding who plays what, and when.',
    simple: [
      'Arranging means deciding which instruments play which parts. Good arrangements give each part its own **space**: in **pitch** (low, middle, high), in **rhythm** (long notes against busy ones) and in **time** (instruments taking turns).',
      'Keep the melody clear: nothing important should sit in the same range at the same time as the vocal.',
    ],
    deep: [
      'Orchestration principles: the harmonic series (wide intervals low, closer high); doubling at the octave for strength, at the unison for colour; register strengths of each instrument (clarinet chalumeau, flute weak low register, horn’s middle); balance (one trumpet ≈ two horns ≈ four woodwinds, roughly, at *forte*); orchestral colours through mutes, divisi and extended techniques. Texts: Rimsky-Korsakov, Adler, Piston; for big band, Sammy Nestico and Rayburn Wright; for production, frequency-range arranging (sub, bass, low-mids, presence, air).',
    ],
    related: ['voicings', 'voice-leading', 'instrument-families', 'transposing-instruments', 'music-production'],
  },
  {
    id: 'film-scoring', section: 'composition', title: 'Film and game music', level: 4,
    summary: 'Leitmotif, hits, underscore and adaptive music.',
    simple: [
      'Film music supports the story: themes for characters (leitmotifs), moods for scenes, and sounds that hit key moments in the picture. Game music adds **adaptive** scoring that changes with what the player does.',
    ],
    deep: [
      'Techniques: leitmotif and thematic transformation (Wagner → Korngold → John Williams), ostinato underscore, synchronisation to frame-accurate timecode and click tracks, **Mickey-Mousing** (music mirroring action), source (diegetic) versus score (non-diegetic) music, **hexatonic and chromatic-mediant harmony** for wonder or menace, trailer music’s rhythmic builds. Game audio uses horizontal re-sequencing and vertical layering (stems enabled by game state) and middleware such as Wwise and FMOD.',
    ],
    related: ['chromatic-mediants', 'motif-development', 'arranging', 'music-production'],
  },
  {
    id: 'music-production', section: 'composition', title: 'Music production basics', level: 2,
    summary: 'DAWs, recording, MIDI, mixing and mastering.',
    simple: [
      'Most modern music is made in a **DAW** (digital audio workstation): FL Studio, Ableton Live, Logic Pro, Pro Tools, Cubase, Reaper or GarageBand.',
      { list: ['**MIDI** records which notes you play (not the sound), so you can change the instrument later.', '**Audio** records real sound through a microphone or instrument input via an **audio interface**.', '**Mixing** balances the tracks: volume, panning, EQ (tone), compression (level control) and effects (reverb, delay).', '**Mastering** is the final polish: overall tone and loudness for release.'] },
    ],
    deep: [
      'Gain staging, sample rate (44.1/48 kHz) and bit depth (24-bit recording), latency and buffer size; subtractive EQ before additive; compression attack/release and ratio; parallel and sidechain compression (the pumping in EDM and Afrobeats); reverb pre-delay and decay; loudness measured in LUFS (streaming platforms normalise around −14 LUFS integrated). Sound design: subtractive, FM, wavetable and granular synthesis; sampling and chopping; 808 bass tuning to the key.',
    ],
    related: ['arranging', 'modern-genres', 'synthesizer'],
  },
];
