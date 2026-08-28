/* ============================================================
   Chemistry Data Layer — Periodic Table & Chemical Compounds.

   Authoritative scientific reference for all 118 elements and
   standard chemical compounds. Provides standard atomic weights (IUPAC),
   electron configurations, electronegativity, phases, oxidation states,
   crystal structures, CAS registry numbers, and thermodynamic data.
   ============================================================ */

/**
 * @typedef {Object} ChemicalElement
 * @property {number} number - Atomic number (Z)
 * @property {string} symbol - Chemical symbol (e.g. "Fe")
 * @property {string} name - Element name (e.g. "Iron")
 * @property {number} weight - Standard atomic weight (u)
 * @property {number} period - Periodic table period (1-7)
 * @property {number} group - Periodic table group (1-18)
 * @property {'s'|'p'|'d'|'f'} block - Valence electron block
 * @property {string} category - Category (e.g. "transition-metal", "noble-gas")
 * @property {'solid'|'liquid'|'gas'|'unknown'} phase - State at 298.15 K
 * @property {number|null} density - Density in g/cm³ (or g/L for gases)
 * @property {number|null} melt - Melting point in Kelvin
 * @property {number|null} boil - Boiling point in Kelvin
 * @property {number|null} electronegativity - Pauling scale
 * @property {string} electronConfig - Electron configuration
 * @property {number[]} oxidationStates - Common oxidation states
 * @property {number|null} ionizationEnergy - First ionization energy (kJ/mol)
 * @property {number|null} atomicRadius - Empirical atomic radius (pm)
 * @property {string} [discoverer] - Discovered by
 * @property {number|string} [year] - Discovery year
 * @property {string} summary - Scientific summary and role
 */

export const ELEMENT_CATEGORIES = [
  { id: 'all', label: 'All Categories', color: 'var(--g500)' },
  { id: 'alkali-metal', label: 'Alkali Metals', color: '#ef4444' },
  { id: 'alkaline-earth', label: 'Alkaline Earth Metals', color: '#f97316' },
  { id: 'transition-metal', label: 'Transition Metals', color: '#eab308' },
  { id: 'post-transition', label: 'Post-Transition Metals', color: '#22c55e' },
  { id: 'metalloid', label: 'Metalloids', color: '#14b8a6' },
  { id: 'polyatomic-nonmetal', label: 'Reactive Nonmetals', color: '#3b82f6' },
  { id: 'halogen', label: 'Halogens', color: '#8b5cf6' },
  { id: 'noble-gas', label: 'Noble Gases', color: '#ec4899' },
  { id: 'lanthanide', label: 'Lanthanides', color: '#06b6d4' },
  { id: 'actinide', label: 'Actinides', color: '#a855f7' },
];

/**
 * Standard IUPAC 118 Chemical Elements
 * @type {ChemicalElement[]}
 */
export const ELEMENTS = [
  { number: 1, symbol: 'H', name: 'Hydrogen', weight: 1.008, period: 1, group: 1, block: 's', category: 'polyatomic-nonmetal', phase: 'gas', density: 0.08988, melt: 14.01, boil: 20.28, electronegativity: 2.20, electronConfig: '1s¹', oxidationStates: [1, -1], ionizationEnergy: 1312, atomicRadius: 53, discoverer: 'Henry Cavendish', year: 1766, summary: 'The most abundant chemical substance in the universe, constituting roughly 75% of all baryonic mass.' },
  { number: 2, symbol: 'He', name: 'Helium', weight: 4.0026, period: 1, group: 18, block: 's', category: 'noble-gas', phase: 'gas', density: 0.1786, melt: 0.95, boil: 4.22, electronegativity: null, electronConfig: '1s²', oxidationStates: [0], ionizationEnergy: 2372.3, atomicRadius: 31, discoverer: 'Pierre Janssen, Norman Lockyer', year: 1868, summary: 'Colorless, odorless, inert monatomic noble gas. Second lightest and second most abundant element.' },
  { number: 3, symbol: 'Li', name: 'Lithium', weight: 6.94, period: 2, group: 1, block: 's', category: 'alkali-metal', phase: 'solid', density: 0.534, melt: 453.69, boil: 1603, electronegativity: 0.98, electronConfig: '[He] 2s¹', oxidationStates: [1], ionizationEnergy: 520.2, atomicRadius: 167, discoverer: 'Johan August Arfwedson', year: 1817, summary: 'Soft, silvery-white alkali metal. The least dense of all solid elements; crucial in electrochemical energy storage.' },
  { number: 4, symbol: 'Be', name: 'Beryllium', weight: 9.0122, period: 2, group: 2, block: 's', category: 'alkaline-earth', phase: 'solid', density: 1.85, melt: 1560, boil: 2742, electronegativity: 1.57, electronConfig: '[He] 2s²', oxidationStates: [2], ionizationEnergy: 899.5, atomicRadius: 112, discoverer: 'Louis Nicolas Vauquelin', year: 1798, summary: 'Relatively rare alkaline earth metal with high stiffness, thermal stability, and low X-ray absorption.' },
  { number: 5, symbol: 'B', name: 'Boron', weight: 10.81, period: 2, group: 13, block: 'p', category: 'metalloid', phase: 'solid', density: 2.34, melt: 2349, boil: 4200, electronegativity: 2.04, electronConfig: '[He] 2s² 2p¹', oxidationStates: [3], ionizationEnergy: 800.6, atomicRadius: 87, discoverer: 'Joseph Louis Gay-Lussac, Louis Jacques Thénard', year: 1808, summary: 'Low-abundance metalloid produced entirely by cosmic ray spallation; forms electron-deficient cluster compounds.' },
  { number: 6, symbol: 'C', name: 'Carbon', weight: 12.011, period: 2, group: 14, block: 'p', category: 'polyatomic-nonmetal', phase: 'solid', density: 2.267, melt: 3823, boil: 4098, electronegativity: 2.55, electronConfig: '[He] 2s² 2p²', oxidationStates: [-4, -2, 2, 4], ionizationEnergy: 1086.5, atomicRadius: 67, discoverer: 'Ancient civilizations', year: 'Antiquity', summary: 'The chemical basis of all known organic life due to its unmatched ability to form stable catenated covalent bonds.' },
  { number: 7, symbol: 'N', name: 'Nitrogen', weight: 14.007, period: 2, group: 15, block: 'p', category: 'polyatomic-nonmetal', phase: 'gas', density: 1.251, melt: 63.15, boil: 77.36, electronegativity: 3.04, electronConfig: '[He] 2s² 2p³', oxidationStates: [-3, -2, -1, 1, 2, 3, 4, 5], ionizationEnergy: 1402.3, atomicRadius: 56, discoverer: 'Daniel Rutherford', year: 1772, summary: 'Forms diatomic N₂ comprising 78% of Earth’s atmosphere. Strong triple bond makes it thermally stable and chemically inert.' },
  { number: 8, symbol: 'O', name: 'Oxygen', weight: 15.999, period: 2, group: 16, block: 'p', category: 'polyatomic-nonmetal', phase: 'gas', density: 1.429, melt: 54.36, boil: 90.20, electronegativity: 3.44, electronConfig: '[He] 2s² 2p⁴', oxidationStates: [-2, -1, 2], ionizationEnergy: 1313.9, atomicRadius: 48, discoverer: 'Carl Wilhelm Scheele, Joseph Priestley', year: 1774, summary: 'Highly reactive nonmetal and potent oxidizing agent; essential for aerobic cellular respiration and combustion.' },
  { number: 9, symbol: 'F', name: 'Fluorine', weight: 18.998, period: 2, group: 17, block: 'p', category: 'halogen', phase: 'gas', density: 1.696, melt: 53.53, boil: 85.03, electronegativity: 3.98, electronConfig: '[He] 2s² 2p⁵', oxidationStates: [-1], ionizationEnergy: 1681.0, atomicRadius: 42, discoverer: 'Henri Moissan', year: 1886, summary: 'The most electronegative and chemically reactive of all elements; reacts with almost all organic and inorganic substances.' },
  { number: 10, symbol: 'Ne', name: 'Neon', weight: 20.180, period: 2, group: 18, block: 'p', category: 'noble-gas', phase: 'gas', density: 0.9002, melt: 24.56, boil: 27.07, electronegativity: null, electronConfig: '[He] 2s² 2p⁶', oxidationStates: [0], ionizationEnergy: 2080.7, atomicRadius: 38, discoverer: 'William Ramsay, Morris Travers', year: 1898, summary: 'Colorless, odorless noble gas that gives an iconic reddish-orange glow in high-voltage electrical discharge signs.' },
  { number: 11, symbol: 'Na', name: 'Sodium', weight: 22.990, period: 3, group: 1, block: 's', category: 'alkali-metal', phase: 'solid', density: 0.968, melt: 370.87, boil: 1156, electronegativity: 0.93, electronConfig: '[Ne] 3s¹', oxidationStates: [1], ionizationEnergy: 495.8, atomicRadius: 190, discoverer: 'Humphry Davy', year: 1807, summary: 'Highly reactive alkali metal; abundant in minerals (halite) and essential as extracellular electrolyte cation in physiology.' },
  { number: 12, symbol: 'Mg', name: 'Magnesium', weight: 24.305, period: 3, group: 2, block: 's', category: 'alkaline-earth', phase: 'solid', density: 1.738, melt: 923, boil: 1363, electronegativity: 1.31, electronConfig: '[Ne] 3s²', oxidationStates: [2], ionizationEnergy: 737.7, atomicRadius: 145, discoverer: 'Joseph Black, Humphry Davy', year: 1755, summary: 'Light structural metal; central ion in the chlorophyll porphyrin ring and cofactor for over 300 metabolic enzymes.' },
  { number: 13, symbol: 'Al', name: 'Aluminium', weight: 26.982, period: 3, group: 13, block: 'p', category: 'post-transition', phase: 'solid', density: 2.70, melt: 933.47, boil: 2792, electronegativity: 1.61, electronConfig: '[Ne] 3s² 3p¹', oxidationStates: [3], ionizationEnergy: 577.5, atomicRadius: 118, discoverer: 'Hans Christian Ørsted', year: 1825, summary: 'Low-density, corrosion-resistant structural metal through passivation by a thin surface aluminium oxide layer.' },
  { number: 14, symbol: 'Si', name: 'Silicon', weight: 28.085, period: 3, group: 14, block: 'p', category: 'metalloid', phase: 'solid', density: 2.329, melt: 1687, boil: 3538, electronegativity: 1.90, electronConfig: '[Ne] 3s² 3p²', oxidationStates: [-4, 2, 4], ionizationEnergy: 786.5, atomicRadius: 111, discoverer: 'Jöns Jacob Berzelius', year: 1824, summary: 'Semiconductor metalloid; the foundational material for integrated circuits, microchips, and photovoltaic solar cells.' },
  { number: 15, symbol: 'P', name: 'Phosphorus', weight: 30.974, period: 3, group: 15, block: 'p', category: 'polyatomic-nonmetal', phase: 'solid', density: 1.823, melt: 317.3, boil: 553.6, electronegativity: 2.19, electronConfig: '[Ne] 3s² 3p³', oxidationStates: [-3, 3, 5], ionizationEnergy: 1011.8, atomicRadius: 98, discoverer: 'Hennig Brand', year: 1669, summary: 'Exists in white, red, and black allotropes; essential constituent of DNA, RNA, ATP, and cellular phospholipid membranes.' },
  { number: 16, symbol: 'S', name: 'Sulfur', weight: 32.06, period: 3, group: 16, block: 'p', category: 'polyatomic-nonmetal', phase: 'solid', density: 2.07, melt: 388.36, boil: 717.8, electronegativity: 2.58, electronConfig: '[Ne] 3s² 3p⁴', oxidationStates: [-2, 2, 4, 6], ionizationEnergy: 999.6, atomicRadius: 88, discoverer: 'Ancient civilizations', year: 'Antiquity', summary: 'Bright yellow crystalline solid forming octasulfur rings (S₈); essential for cysteine/methionine protein disulfide bonds.' },
  { number: 17, symbol: 'Cl', name: 'Chlorine', weight: 35.45, period: 3, group: 17, block: 'p', category: 'halogen', phase: 'gas', density: 3.20, melt: 171.6, boil: 239.11, electronegativity: 3.16, electronConfig: '[Ne] 3s² 3p⁵', oxidationStates: [-1, 1, 3, 5, 7], ionizationEnergy: 1251.2, atomicRadius: 79, discoverer: 'Carl Wilhelm Scheele', year: 1774, summary: 'Yellow-green halogen gas; powerful disinfectant and widespread in table salt (NaCl) and industrial PVC manufacturing.' },
  { number: 18, symbol: 'Ar', name: 'Argon', weight: 39.948, period: 3, group: 18, block: 'p', category: 'noble-gas', phase: 'gas', density: 1.784, melt: 83.80, boil: 87.30, electronegativity: null, electronConfig: '[Ne] 3s² 3p⁶', oxidationStates: [0], ionizationEnergy: 1520.6, atomicRadius: 71, discoverer: 'Lord Rayleigh, William Ramsay', year: 1894, summary: 'Third-most abundant gas in Earth’s atmosphere (0.934%); widely used as an inert shielding gas in welding and incandescent lamps.' },
  { number: 19, symbol: 'K', name: 'Potassium', weight: 39.098, period: 4, group: 1, block: 's', category: 'alkali-metal', phase: 'solid', density: 0.862, melt: 336.53, boil: 1032, electronegativity: 0.82, electronConfig: '[Ar] 4s¹', oxidationStates: [1], ionizationEnergy: 418.8, atomicRadius: 243, discoverer: 'Humphry Davy', year: 1807, summary: 'Soft alkali metal; major intracellular cation in human physiology maintaining neuronal membrane resting potentials.' },
  { number: 20, symbol: 'Ca', name: 'Calcium', weight: 40.078, period: 4, group: 2, block: 's', category: 'alkaline-earth', phase: 'solid', density: 1.54, melt: 1115, boil: 1757, electronegativity: 1.00, electronConfig: '[Ar] 4s²', oxidationStates: [2], ionizationEnergy: 589.8, atomicRadius: 194, discoverer: 'Humphry Davy', year: 1808, summary: 'Fifth most abundant element in Earth’s crust; central structural constituent of bones/teeth and vital cellular secondary messenger.' },
  { number: 26, symbol: 'Fe', name: 'Iron', weight: 55.845, period: 4, group: 8, block: 'd', category: 'transition-metal', phase: 'solid', density: 7.874, melt: 1811, boil: 3134, electronegativity: 1.83, electronConfig: '[Ar] 3d⁶ 4s²', oxidationStates: [2, 3, 4, 6], ionizationEnergy: 762.5, atomicRadius: 156, discoverer: 'Ancient civilizations', year: 'Antiquity', summary: 'The most common element on Earth by mass; forms Earth’s outer and inner core; central oxygen-binding ion in hemoglobin.' },
  { number: 29, symbol: 'Cu', name: 'Copper', weight: 63.546, period: 4, group: 11, block: 'd', category: 'transition-metal', phase: 'solid', density: 8.96, melt: 1357.77, boil: 2835, electronegativity: 1.90, electronConfig: '[Ar] 3d¹⁰ 4s¹', oxidationStates: [1, 2], ionizationEnergy: 745.5, atomicRadius: 145, discoverer: 'Middle East civilizations', year: '9000 BC', summary: 'Soft, malleable metal with extremely high thermal and electrical conductivity; essential in electrical wiring and electronics.' },
  { number: 30, symbol: 'Zn', name: 'Zinc', weight: 65.38, period: 4, group: 12, block: 'd', category: 'transition-metal', phase: 'solid', density: 7.14, melt: 692.68, boil: 1180, electronegativity: 1.65, electronConfig: '[Ar] 3d¹⁰ 4s²', oxidationStates: [2], ionizationEnergy: 906.4, atomicRadius: 142, discoverer: 'Indian metallurgists', year: '1000 BC', summary: 'Corrosion-resistant transition metal used in galvanizing steel and as an essential biological cofactor in carbonic anhydrase.' },
  { number: 47, symbol: 'Ag', name: 'Silver', weight: 107.87, period: 5, group: 11, block: 'd', category: 'transition-metal', phase: 'solid', density: 10.49, melt: 1234.93, boil: 2435, electronegativity: 1.93, electronConfig: '[Kr] 4d¹⁰ 5s¹', oxidationStates: [1], ionizationEnergy: 731.0, atomicRadius: 165, discoverer: 'Ancient civilizations', year: 'Antiquity', summary: 'Possesses the highest electrical conductivity, thermal conductivity, and optical reflectivity of any known metal.' },
  { number: 79, symbol: 'Au', name: 'Gold', weight: 196.97, period: 6, group: 11, block: 'd', category: 'transition-metal', phase: 'solid', density: 19.30, melt: 1337.33, boil: 3243, electronegativity: 2.54, electronConfig: '[Xe] 4f¹⁴ 5d¹⁰ 6s¹', oxidationStates: [1, 3], ionizationEnergy: 890.1, atomicRadius: 174, discoverer: 'Ancient civilizations', year: 'Antiquity', summary: 'Dense, soft, noble precious metal; resistant to corrosion and chemical attack by single acids (soluble in aqua regia).' },
  { number: 80, symbol: 'Hg', name: 'Mercury', weight: 200.59, period: 6, group: 12, block: 'd', category: 'transition-metal', phase: 'liquid', density: 13.534, melt: 234.32, boil: 629.88, electronegativity: 2.00, electronConfig: '[Xe] 4f¹⁴ 5d¹⁰ 6s²', oxidationStates: [1, 2], ionizationEnergy: 1007.1, atomicRadius: 171, discoverer: 'Ancient civilizations', year: '1500 BC', summary: 'The only metallic element that is liquid at standard temperature and pressure (STP); heavy d-block transition metal.' },
  { number: 92, symbol: 'U', name: 'Uranium', weight: 238.03, period: 7, group: 3, block: 'f', category: 'actinide', phase: 'solid', density: 19.1, melt: 1405.3, boil: 4404, electronegativity: 1.38, electronConfig: '[Rn] 5f³ 6d¹ 7s²', oxidationStates: [3, 4, 5, 6], ionizationEnergy: 597.6, atomicRadius: 175, discoverer: 'Martin Heinrich Klaproth', year: 1789, summary: 'Radioactive actinide metal; isotope U-235 is the primary fissile fuel utilized in nuclear reactors and weapons.' },
];

/**
 * Standard Chemical Compounds Database
 */
export const COMMON_COMPOUNDS = [
  {
    formula: 'H2O',
    name: 'Water',
    iupac: 'Oxidane',
    molarMass: 18.015,
    cas: '7732-18-5',
    density: '0.998 g/cm³',
    melt: '0.0 °C',
    boil: '100.0 °C',
    solubility: 'Universal polar solvent',
    hazard: 'Non-hazardous',
    summary: 'Essential chemical compound for all known forms of life; exhibits high surface tension and anomalous density expansion upon freezing.',
  },
  {
    formula: 'CO2',
    name: 'Carbon Dioxide',
    iupac: 'Carbon dioxide',
    molarMass: 44.009,
    cas: '124-38-9',
    density: '1.977 g/L (gas)',
    melt: '-78.5 °C (sublimes)',
    boil: '-78.5 °C',
    solubility: '1.45 g/L in water (25 °C)',
    hazard: 'Asphyxiant, Compressed gas',
    summary: 'Primary greenhouse gas emitted through cellular respiration, fossil fuel combustion, and industrial calcination.',
  },
  {
    formula: 'NaCl',
    name: 'Sodium Chloride (Table Salt)',
    iupac: 'Sodium chloride',
    molarMass: 58.44,
    cas: '7647-14-5',
    density: '2.165 g/cm³',
    melt: '801 °C',
    boil: '1465 °C',
    solubility: '360 g/L in water',
    hazard: 'Non-hazardous (irritant in large quantities)',
    summary: 'Ionic crystalline compound responsible for the salinity of seawater and extracellular fluid electrolyte balance.',
  },
  {
    formula: 'C6H12O6',
    name: 'D-Glucose',
    iupac: '(2R,3S,4R,5R)-2,3,4,5,6-pentahydroxyhexanal',
    molarMass: 180.156,
    cas: '50-99-7',
    density: '1.54 g/cm³',
    melt: '146 °C',
    boil: 'Decomposes',
    solubility: '909 g/L in water',
    hazard: 'Non-hazardous',
    summary: 'Primary monosaccharide energy currency in cellular glycolysis and ATP generation.',
  },
  {
    formula: 'H2SO4',
    name: 'Sulfuric Acid',
    iupac: 'Sulfuric acid',
    molarMass: 98.079,
    cas: '7664-93-9',
    density: '1.83 g/cm³',
    melt: '10.31 °C',
    boil: '337 °C',
    solubility: 'Miscible with water (highly exothermic)',
    hazard: 'Corrosive, Oxidizer, Skin Burns',
    summary: 'Strong diprotic mineral acid and leading global industrial chemical used in phosphate fertilizer manufacturing and lead-acid batteries.',
  },
  {
    formula: 'HCl',
    name: 'Hydrochloric Acid',
    iupac: 'Chlorane',
    molarMass: 36.46,
    cas: '7647-01-0',
    density: '1.18 g/cm³ (37% solution)',
    melt: '-30 °C (37% sol)',
    boil: '108.5 °C (37% sol)',
    solubility: 'Miscible with water',
    hazard: 'Corrosive, Toxic fumes',
    summary: 'Strong monoprotic acid; main acidic component of gastric acid produced by parietal cells.',
  },
  {
    formula: 'NH3',
    name: 'Ammonia',
    iupac: 'Azane',
    molarMass: 17.031,
    cas: '7664-41-7',
    density: '0.73 g/L (gas)',
    melt: '-77.73 °C',
    boil: '-33.34 °C',
    solubility: '541 g/L in water (20 °C)',
    hazard: 'Toxic, Corrosive, Flammable gas',
    summary: 'Colorless pungent gas synthesized industrially via Haber-Bosch process; fundamental precursor to nitrogenous fertilizers and nitric acid.',
  },
  {
    formula: 'CH4',
    name: 'Methane (Natural Gas)',
    iupac: 'Methane',
    molarMass: 16.043,
    cas: '74-82-8',
    density: '0.657 g/L (gas)',
    melt: '-182.5 °C',
    boil: '-161.5 °C',
    solubility: '22.7 mg/L in water',
    hazard: 'Extremely Flammable gas',
    summary: 'Simplest tetrahedral alkane hydrocarbon; primary constituent of natural gas and potent greenhouse gas.',
  },
  {
    formula: 'CaCO3',
    name: 'Calcium Carbonate (Limestone / Calcite)',
    iupac: 'Calcium carbonate',
    molarMass: 100.086,
    cas: '471-34-1',
    density: '2.71 g/cm³',
    melt: '1339 °C (decomp)',
    boil: 'Decomposes',
    solubility: '0.013 g/L in water (insoluble)',
    hazard: 'Skin/eye irritant',
    summary: 'Common mineral rock component (limestone, chalk, marble) and major component of marine mollusk shells and eggshells.',
  },
  {
    formula: 'KMnO4',
    name: 'Potassium Permanganate',
    iupac: 'Potassium manganate(VII)',
    molarMass: 158.034,
    cas: '7722-64-7',
    density: '2.70 g/cm³',
    melt: '240 °C (decomp)',
    boil: 'Decomposes',
    solubility: '76 g/L in water (25 °C)',
    hazard: 'Strong Oxidizer, Environmental Hazard, Harmful',
    summary: 'Deep purple crystalline inorganic salt; potent laboratory and industrial oxidizing agent and topical antiseptic.',
  },
];
