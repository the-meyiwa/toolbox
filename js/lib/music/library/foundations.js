/* Music Library — foundations: sound, pitch, notation, rhythm, expression.
   Topic format: see ./index.js. Inline: **bold**, [[topic-id|link text]]. */

export default [
  {
    id: 'what-is-music', section: 'foundations', title: 'What music is made of', level: 1,
    summary: 'Pitch, rhythm, harmony, melody, timbre, dynamics, texture and form: the building blocks of every style.',
    simple: [
      'All music, from a lullaby to a symphony to an Afrobeats track, is built from a handful of ingredients:',
      { list: ['**Pitch**: how high or low a sound is.', '**Rhythm**: when sounds happen and how long they last.', '**Melody**: a line of pitches in rhythm, the part you hum.', '**Harmony**: pitches sounding together (chords) and how they move.', '**Timbre** (“tam-ber”): the colour of a sound. It is why a flute and a trumpet playing the same note sound different.', '**Dynamics**: how loud or soft.', '**Texture**: how many layers there are and how they fit together.', '**Form**: how a piece is organised over time (verse, chorus, sections).'] },
      'Music theory is simply the names and patterns for these ingredients, so musicians can understand, remember and share what they hear.',
    ],
    deep: [
      'Different traditions weigh the elements differently. West African drumming builds complexity in rhythm and timbre over simple pitch material; Hindustani music builds it in melody (raga) and time cycles (tala) over a drone, with no chord changes at all; European common-practice music (roughly 1600–1900) builds it in functional harmony and large-scale form.',
      'Theory describes practice; it does not prescribe it. Every “rule” in this library is a summary of what a particular repertoire tends to do.',
    ],
    related: ['pitch-and-frequency', 'rhythm-basics', 'melody-basics', 'triads', 'texture', 'form-overview'],
  },
  {
    id: 'pitch-and-frequency', section: 'foundations', title: 'Pitch, frequency and the octave', level: 1,
    summary: 'Pitch is how we hear frequency. Doubling the frequency gives the same note an octave higher.',
    simple: [
      'A sound is a vibration. The faster something vibrates, the higher the **pitch** we hear. Speed of vibration is **frequency**, measured in hertz (Hz), vibrations per second.',
      'The note A above middle C is tuned to **440 Hz** in most modern music. The A an **octave** above is 880 Hz, and the one below is 220 Hz. Notes an octave apart sound so alike that we give them the same letter name.',
      { tip: 'Humans hear roughly 20 Hz to 20,000 Hz. A piano spans about 27.5 Hz (lowest A) to 4,186 Hz (top C).' },
    ],
    deep: [
      'Pitch perception is logarithmic: equal musical steps are equal frequency ratios, not equal differences in hertz. In twelve-tone equal temperament, each semitone multiplies frequency by 2^(1/12) ≈ 1.05946. A semitone is divided into 100 **cents**, so an octave is 1200 cents.',
      'Scientific pitch notation names octaves from C: middle C is C4 (≈261.63 Hz with A4 = 440). MIDI numbers count semitones from C−1, so middle C is 60 and A4 is 69: f = 440 × 2^((n − 69)/12).',
      'Concert pitch has varied: Baroque ensembles often use A = 415 Hz, some orchestras tune to 442–443 Hz, and A = 440 was standardised internationally in 1939 (ISO 16 in 1975).',
      { example: { type: 'harmonics', fundamental: 'A2' } },
    ],
    related: ['harmonic-series', 'equal-temperament', 'note-names', 'timbre'],
  },
  {
    id: 'note-names', section: 'foundations', title: 'Note names and the keyboard', level: 1,
    summary: 'Seven letters, five sharps/flats, twelve notes that repeat in every octave.',
    simple: [
      'Western music uses seven letter names: **A B C D E F G**, then they repeat. On a piano the white keys are these letters; the black keys are between them.',
      'Find **C** just to the left of each group of two black keys. The C nearest the middle of the piano is **middle C**.',
      'A **sharp** (♯) raises a note by the smallest step, a **half step** (semitone); a **flat** (♭) lowers it by a half step. The black key between C and D is both C♯ and D♭. Two names for one key are **enharmonic** equivalents.',
      'There is no black key between **E and F** or between **B and C**: those pairs are already a half step apart.',
      { example: { type: 'piano', from: 48, to: 72, label: 'names' } },
    ],
    deep: [
      'The twelve pitch classes form a cycle; which enharmonic spelling is correct depends on context. In D major the third is F♯, never G♭, because each letter appears once in a scale. In the key of C♯ minor, the leading note is B♯ even though it is played on a white key (C).',
      'Double sharps (𝄪) and double flats (𝄫) exist for the same reason: the leading note of G♯ minor is F𝄪; the diminished seventh above C♯ is B♭, and above C is B𝄫.',
      'Other naming systems: German uses H for B and B for B♭ (hence J.S. Bach’s musical signature B–A–C–H = B♭–A–C–B♮); fixed-do solfège (Italy, France, Spain, Latin America) names C as *do*, D *re* and so on.',
    ],
    related: ['accidentals', 'the-staff', 'half-and-whole-steps', 'solfege'],
  },
  {
    id: 'half-and-whole-steps', section: 'foundations', title: 'Half steps and whole steps', level: 1,
    summary: 'The two smallest building blocks of scales.',
    simple: [
      'A **half step** (semitone) is the distance from one key to the very next key, black or white. A **whole step** (tone) is two half steps.',
      'C to C♯ is a half step. C to D is a whole step. E to F is a half step (no black key between).',
      'Every scale is a pattern of whole and half steps. The major scale is **W W H W W W H**.',
      { example: { type: 'scale', tonic: 'C4', scale: 'major' } },
    ],
    deep: [
      'A **diatonic** semitone changes letter (E–F, C♯–D); a **chromatic** semitone keeps the letter (C–C♯). They are the same size in equal temperament but different in Pythagorean and just tunings, which is why string players and singers may place C♯ and D♭ slightly differently.',
    ],
    related: ['major-scale', 'intervals', 'note-names'],
  },
  {
    id: 'the-staff', section: 'notation', title: 'The staff and clefs', level: 1,
    summary: 'Five lines, four spaces, and a clef that says which notes they are.',
    simple: [
      'Music is written on a **staff** (stave): five lines and four spaces. Higher on the staff means higher in pitch.',
      'A **clef** at the start names the lines:',
      { list: ['**Treble clef** (G clef): its curl wraps the second line, which is **G** above middle C. Used for right hand piano, voice, violin, flute, guitar, trumpet.', '**Bass clef** (F clef): its two dots surround the fourth line, which is **F** below middle C. Used for left hand piano, cello, bass, bassoon, trombone, tuba.'] },
      'Memory aids for treble clef: lines E G B D F (“**E**very **G**ood **B**oy **D**eserves **F**ruit”), spaces spell **F A C E**. Bass clef: lines G B D F A (“**G**ood **B**oys **D**o **F**ine **A**lways”), spaces A C E G (“**A**ll **C**ows **E**at **G**rass”).',
      { example: { type: 'staff', notes: ['E4', 'G4', 'B4', 'D5', 'F5'], labels: ['E', 'G', 'B', 'D', 'F'], caption: 'Treble clef lines' } },
      { example: { type: 'staff', clef: 'bass', notes: ['G2', 'B2', 'D3', 'F3', 'A3'], labels: ['G', 'B', 'D', 'F', 'A'], caption: 'Bass clef lines' } },
      'Notes above or below the staff sit on short **ledger lines**. Middle C sits on one ledger line below the treble staff, and one above the bass staff.',
    ],
    deep: [
      'C clefs mark middle C on whichever line their centre points to: **alto clef** (middle line; viola) and **tenor clef** (fourth line; high cello, bassoon and trombone passages). Historically the soprano, mezzo-soprano and baritone clefs were C or F clefs on other lines.',
      'The **grand staff** joins treble and bass with a brace (piano, harp, organ). Tenor voices read a treble clef with a small 8 below it (sounding an octave lower); guitar reads treble but sounds an octave lower too.',
      '*8va* above notes means play an octave higher; *8vb* an octave lower; *15ma* two octaves higher.',
    ],
    related: ['note-names', 'note-values', 'transposing-instruments', 'reading-music-roadmap'],
  },
  {
    id: 'accidentals', section: 'notation', title: 'Accidentals and key signatures', level: 1,
    summary: 'Sharps, flats and naturals, and how long they last.',
    simple: [
      '**Accidentals** change a note: ♯ sharp (up a half step), ♭ flat (down a half step), ♮ natural (cancels a sharp or flat).',
      'An accidental lasts **until the end of the bar** (measure), for that note on that line or space. A **key signature** at the start of each line applies to every octave of those notes for the whole piece, until changed.',
      { example: { type: 'staff', notes: ['F4', 'F#4', 'F4', 'Bb4', 'B4'], labels: ['F', 'F♯', 'F', 'B♭', 'B'] } },
    ],
    deep: [
      'Sharps enter key signatures in the order **F C G D A E B** (“Father Charles Goes Down And Ends Battle”); flats in the reverse order **B E A D G C F**. For a sharp key, the tonic is a half step above the last sharp; for a flat key, the tonic is the second-to-last flat.',
      '**Courtesy (cautionary) accidentals** in brackets remind the player that a note has returned to normal in the next bar. In much contemporary music, accidentals apply only to the note they precede.',
    ],
    related: ['key-signatures', 'circle-of-fifths', 'note-names'],
  },
  {
    id: 'rhythm-basics', section: 'rhythm', title: 'Beat, tempo and rhythm', level: 1,
    summary: 'The pulse you tap your foot to, how fast it goes, and the patterns on top.',
    simple: [
      'The **beat** (pulse) is the steady tick you tap your foot to. **Tempo** is how fast the beat goes, in **beats per minute (BPM)**. A relaxed walk is about 100 BPM.',
      '**Rhythm** is the pattern of long and short sounds laid over the beat. The same beat can carry endless rhythms.',
      'Beats group into **bars** (measures), with the first beat usually strongest: ONE two three four, ONE two three four.',
      { example: { type: 'metronome', tempo: 96, beats: 4 } },
    ],
    deep: [
      'Tempo terms (Italian) give a character as much as a speed: *Largo* (very slow, broad, 40–60), *Adagio* (slow, at ease, 66–76), *Andante* (walking, 76–108), *Moderato* (108–120), *Allegro* (fast, cheerful, 120–156), *Vivace* (lively, 156–176), *Presto* (very fast, 168–200). Metronome markings appeared after Maelzel’s metronome (1815); Beethoven was among the first to use them.',
      'Rubato is flexible tempo for expression; *accelerando* speeds up, *ritardando/rallentando* slows down, *a tempo* returns to the original speed, a *fermata* (𝄐) holds a note as long as the performer chooses.',
      'Beat hierarchy: the **tactus** (felt beat), its subdivisions, and higher levels (bar, hypermeasure of 2 or 4 bars) form a metric hierarchy that performers shape with weight and phrasing.',
    ],
    related: ['note-values', 'time-signatures', 'syncopation', 'tempo-terms'],
  },
  {
    id: 'note-values', section: 'rhythm', title: 'Note and rest values', level: 1,
    summary: 'How long each note lasts: whole, half, quarter, eighth, sixteenth, and their rests.',
    simple: [
      'The shape of a note tells you how long to hold it. In 4/4 time, where the quarter note gets one beat:',
      { table: { head: ['US name', 'UK name', 'Beats in 4/4'], rows: [['Whole note', 'Semibreve', '4'], ['Half note', 'Minim', '2'], ['Quarter note', 'Crotchet', '1'], ['Eighth note', 'Quaver', '½'], ['Sixteenth note', 'Semiquaver', '¼'], ['Thirty-second note', 'Demisemiquaver', '⅛']] } },
      'Every note has a matching **rest**, a silence of the same length.',
      'A **dot** after a note adds half its value: a dotted half note is 2 + 1 = 3 beats. A **tie** joins two notes of the same pitch into one longer sound.',
    ],
    deep: [
      'A second dot adds a further quarter (double-dotted quarter = 1¾ beats). **Tuplets** squeeze a different number of notes into a beat: a **triplet** fits three in the time of two; quintuplets, sextuplets and septuplets are written with a bracket and number.',
      'Beaming shows the beat: eighth notes are beamed in groups that make the beats visible (in 4/4, usually 2+2+2+2 or 4+4, never across the middle of the bar in traditional engraving); in 6/8 they are beamed in threes.',
      'Early notation (mensural notation, c. 1250–1600) used the longa, breve and semibreve, with perfect (triple) and imperfect (duple) divisions — the origin of the whole note’s old name.',
    ],
    related: ['time-signatures', 'tuplets-and-polyrhythm', 'rhythm-basics'],
  },
  {
    id: 'time-signatures', section: 'rhythm', title: 'Time signatures and meter', level: 1,
    summary: 'Simple and compound, duple, triple and quadruple, and irregular meters.',
    simple: [
      'A **time signature** is two numbers at the start. The **top** number says how many beats are in each bar; the **bottom** number says which note gets the beat (4 = quarter note, 8 = eighth note, 2 = half note).',
      { list: ['**4/4** (common time, 𝄴): four quarter-note beats. Most pop, rock, hip-hop and Afrobeats.', '**3/4**: three beats — waltz, many hymns and folk songs.', '**2/4**: two beats — marches, polka, highlife feels.', '**6/8**: two dotted-quarter beats, each split into three: “ONE-and-a TWO-and-a”. Jigs, many ballads, West African 12/8 bell patterns.'] },
      { example: { type: 'meter', meters: ['2/4', '3/4', '4/4', '6/8', '9/8', '12/8', '5/4', '7/8'] } },
    ],
    deep: [
      '**Simple meters** divide each beat in two; **compound meters** divide each beat in three (6/8, 9/8, 12/8 — the top number divisible by 3 and greater than 3). By number of beats: duple, triple, quadruple.',
      '**Irregular (asymmetric or additive) meters** mix beats of two and three: 5/8 (2+3), 7/8 (2+2+3), the Bulgarian *kopanitsa* in 11/16 (2+2+3+2+2). Balkan and Turkish musicians call these *aksak* (“limping”) rhythms.',
      '**Hemiola** reinterprets two bars of 3/4 as three bars of 2/4 (or 6/8 as 3/4), common at Baroque cadences and in Latin and African music. **Mixed and changing meters** appear in Stravinsky, progressive rock and film music; **metric modulation** (Elliott Carter) moves between tempos through a shared note value.',
    ],
    related: ['note-values', 'syncopation', 'tuplets-and-polyrhythm', 'african-rhythm', 'odd-meters'],
  },
  {
    id: 'dynamics-articulation', section: 'notation', title: 'Dynamics, articulation and expression marks', level: 1,
    summary: 'How loud, how connected, and with what character.',
    simple: [
      '**Dynamics** say how loud to play, from Italian words:',
      { table: { head: ['Mark', 'Italian', 'Meaning'], rows: [['ppp', 'pianississimo', 'as soft as possible'], ['pp', 'pianissimo', 'very soft'], ['p', 'piano', 'soft'], ['mp', 'mezzo-piano', 'moderately soft'], ['mf', 'mezzo-forte', 'moderately loud'], ['f', 'forte', 'loud'], ['ff', 'fortissimo', 'very loud'], ['fff', 'fortississimo', 'as loud as possible']] } },
      '**Crescendo** (< hairpin) means get louder gradually; **decrescendo/diminuendo** (>) get softer.',
      '**Articulation** shapes each note: **staccato** (dot) short and detached; **legato** (slur) smooth and connected; **accent** (>) stronger attack; **tenuto** (line) hold for full length; **marcato** (^) strongly accented.',
    ],
    deep: [
      'Other marks: *sforzando* (sfz) a sudden strong accent; *fp* loud then immediately soft; *subito* suddenly; *dolce* sweetly; *cantabile* singing; *espressivo* expressively; *con moto* with motion; *sotto voce* in an undertone.',
      'String-specific: *pizzicato* (plucked), *arco* (bowed), *con sordino* (with mute), *sul ponticello* (near the bridge, glassy), *sul tasto* (over the fingerboard, soft), *col legno* (with the wood of the bow), up-bow (V) and down-bow (⊓). Wind and brass: *flutter-tongue*, *con sordino* (muted), *bells up*.',
      'A **slur** over different pitches means legato; a **tie** joins the same pitch. Phrasing slurs span whole musical sentences and guide breath and bow.',
    ],
    related: ['ornaments', 'tempo-terms', 'navigation-marks'],
  },
  {
    id: 'tempo-terms', section: 'notation', title: 'Tempo and character terms', level: 2,
    summary: 'The Italian (and French and German) words for speed and mood.',
    simple: [
      { table: { head: ['Term', 'Meaning', 'Approx. BPM'], rows: [['Grave', 'very slow, solemn', '25–45'], ['Largo', 'broadly, very slow', '40–60'], ['Lento', 'slow', '45–60'], ['Adagio', 'slow, at ease', '66–76'], ['Andante', 'at a walking pace', '76–108'], ['Moderato', 'moderate', '108–120'], ['Allegretto', 'moderately fast', '112–120'], ['Allegro', 'fast, bright', '120–156'], ['Vivace', 'lively', '156–176'], ['Presto', 'very fast', '168–200'], ['Prestissimo', 'as fast as possible', '200+']] } },
    ],
    deep: [
      'Modifiers: *molto* (very), *poco* (a little), *poco a poco* (little by little), *meno* (less), *più* (more), *non troppo* (not too much), *assai* (very), *ma non tanto* (but not so much). French scores use *lent, modéré, vif, animé*; German *langsam, mäßig, schnell, lebhaft*.',
      'Beats per minute ranges are conventions, not rules; the character matters more. An *Allegro* by Mozart is often slower than a pop song at 128 BPM.',
    ],
    related: ['rhythm-basics', 'dynamics-articulation'],
  },
  {
    id: 'navigation-marks', section: 'notation', title: 'Repeats, codas and road maps', level: 2,
    summary: 'Repeat signs, first and second endings, D.C., D.S., coda and fine.',
    simple: [
      { list: ['**Repeat signs** (‖: :‖): play the section between them twice.', '**First and second endings** (voltas): play ending 1 the first time, skip to ending 2 on the repeat.', '**D.C.** (*da capo*): go back to the beginning.', '**D.S.** (*dal segno*): go back to the sign 𝄋.', '**Fine**: the end.', '**To Coda** (⊕): jump to the coda, the tail section.'] },
      'Common combinations: **D.C. al Fine** (back to the start, play until Fine) and **D.S. al Coda** (back to the sign, play until “To Coda”, then jump to the coda).',
    ],
    deep: [
      'Lead sheets and jazz charts rely on these to fit a whole song on one page. By convention, repeats inside a D.C. or D.S. are not taken the second time unless marked “con repetizione”. Bar repeat signs (𝄎) repeat the previous bar; multi-bar rests show a number over a thick bar.',
    ],
    related: ['lead-sheets', 'form-overview'],
  },
  {
    id: 'ornaments', section: 'notation', title: 'Ornaments', level: 2,
    summary: 'Trills, mordents, turns, grace notes and more.',
    simple: [
      '**Ornaments** decorate a note:',
      { list: ['**Trill** (tr): alternate quickly with the note above.', '**Mordent**: one quick flick to the note above (upper mordent) or below (lower mordent) and back.', '**Turn** (∽): the note above, the note, the note below, the note.', '**Grace note** (small note): an *acciaccatura* (with a slash) is crushed in as fast as possible; an *appoggiatura* (no slash) takes time from the main note.', '**Glissando**: slide between two notes.'] },
    ],
    deep: [
      'Performance practice changed over time: Baroque trills normally start on the upper note and on the beat (C.P.E. Bach, Quantz), Classical-era trills often do too, and 19th-century trills more often start on the main note. Terminal flourishes (*Nachschlag*) close long trills.',
      'Ornamentation traditions elsewhere are as rich: Irish cuts and rolls, Hindustani *meend* (slides), *gamak* (oscillation), Arabic *tarab* inflections, the melismas of Yoruba and gospel singing.',
    ],
    related: ['dynamics-articulation', 'indian-classical', 'melody-basics'],
  },
  {
    id: 'reading-music-roadmap', section: 'notation', title: 'How to learn to read music', level: 1,
    summary: 'A step-by-step path from zero to fluent sight-reading.',
    simple: [
      { steps: ['Learn the staff and your clef: the line and space names (use the memory aids), then middle C and its neighbours.', 'Learn the note values and count aloud: “1 2 3 4”, “1-and-2-and”.', 'Read tiny tunes in **one hand position** or five notes, slowly, pointing at each note.', 'Add the second clef (piano) or your instrument’s range, a few notes at a time, using landmark notes (C’s, G in treble, F in bass).', 'Read intervals, not just letters: “up a step, down a third” is faster than naming every note.', 'Learn key signatures one at a time as they appear in your pieces.', 'Sight-read something new and easy **every day** for five minutes, without stopping for mistakes.'] },
      { tip: 'Pick material one or two grades easier than what you practise. Sight-reading improves from volume, not difficulty.' },
    ],
    deep: [
      'Fluent readers chunk: they see chords, scale fragments and rhythmic cells as single units, and read ahead of where they are playing (the eye–hand span grows from about 1 to 4+ notes with experience). Train it by covering the bar you are playing.',
      'Rhythm-syllable systems help: Kodály (*ta, ti-ti*), Gordon (*du, du-de*), and Takadimi (*ta, ta-di, ta-ka-di-mi*), which assigns syllables by position in the beat so any rhythm can be spoken.',
    ],
    related: ['the-staff', 'note-values', 'ear-training', 'practice-methods'],
  },
  {
    id: 'lead-sheets', section: 'notation', title: 'Lead sheets, chord charts, tab and the Nashville number system', level: 2,
    summary: 'The shorthand working musicians read.',
    simple: [
      'A **lead sheet** shows only the melody, lyrics and chord symbols; players make up their own parts. A **chord chart** shows just the chords and bar lines.',
      '**Tablature (tab)** shows guitar or bass strings as lines and the fret to play as a number. It shows *where* to play, not rhythm, unless rhythm stems are added.',
      'The **Nashville number system** writes chords as numbers of the scale (1, 4, 5, 6m) so a band can change key instantly: in G, “1 4 5 1” means G C D G.',
    ],
    deep: [
      'Chord symbol conventions vary: C, CM, Cmaj (major); Cm, C−, Cmi (minor); C7 (dominant); Cmaj7, CM7, CΔ7; Cø7 or Cm7♭5; C°7 or Cdim7; C+ or Caug; C/G (C over G bass). Extensions stack in thirds (9, 11, 13), and alterations (♭9, ♯9, ♯11, ♭13) are usually listed in ascending order. “N.C.” means no chord.',
      'Nashville charts use a diamond for whole-bar holds, a dot or “^” for pushes (anticipations), and a line under a group of chords to split a bar. Gospel and session musicians often combine numbers with scale-degree bass (“4/5” = IV chord over the fifth).',
    ],
    related: ['chord-symbols', 'roman-numerals', 'navigation-marks'],
  },
];
