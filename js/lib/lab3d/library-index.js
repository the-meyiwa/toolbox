/* ============================================================
   3D Lab — library index (ids only)

   A light copy of the catalogue for the Assistant's tool description,
   so loading the Assistant does not pull in three.js and every model
   builder. tests/unit/lab3d.test.js checks it matches catalog.js.
   ============================================================ */

export const MODEL_INDEX = {
  Tech: [
    'iphone-17-pro',
    'iphone-17-pro-max',
    'iphone-17',
    'iphone-air',
    'iphone-16-pro',
    'android-phone',
    'tablet',
    'laptop',
    'monitor',
    'keyboard',
    'mouse',
    'headphones',
    'game-controller',
    'smartwatch',
    'desktop-pc',
    'drone',
    'camera'
  ],
  Furniture: [
    'office-chair',
    'gaming-chair',
    'dining-chair',
    'bar-stool',
    'desk',
    'dining-table',
    'coffee-table',
    'sofa',
    'armchair',
    'bed',
    'bookshelf',
    'desk-lamp',
    'floor-lamp',
    'potted-plant'
  ],
  'Home & kitchen': [
    'mug',
    'wine-glass',
    'bottle',
    'teapot',
    'plate',
    'lightbulb',
    'candle',
    'book',
    'pencil',
    'hammer',
    'crate',
    'barrel',
    'traffic-cone'
  ],
  'Sport & games': [
    'trophy',
    'football',
    'basketball',
    'die',
    'chess-piece',
    'chess-set',
    'guitar'
  ],
  'Nature & buildings': [
    'tree',
    'pine-tree',
    'rock',
    'house'
  ],
  Vehicles: [
    'car',
    'bicycle',
    'airplane',
    'rocket'
  ],
  'Props & replicas': [
    'ak-47',
    'mp5',
    'katana'
  ]
};

export const SHAPE_INDEX = [
  ['cube',['width','height','depth']],
  ['sphere',['radius','segments']],
  ['cylinder',['radius','height','segments']],
  ['cone',['radius','height','segments']],
  ['pyramid',['width','height']],
  ['torus',['radius','tube','segments']],
  ['capsule',['radius','height']],
  ['hemisphere',['radius','segments']],
  ['plane',['width','depth']],
  ['disc',['radius','height']],
  ['tube',['radius','wall','height']],
  ['prism',['width','height','depth']],
  ['tetrahedron',['radius']],
  ['octahedron',['radius']],
  ['dodecahedron',['radius']],
  ['icosahedron',['radius']],
  ['rounded-box',['width','height','depth','round']],
  ['geodesic-sphere',['radius','detail']],
  ['hex-prism',['radius','height']],
  ['star',['points','radius','inner','depth']],
  ['heart',['size','depth']],
  ['gear',['teeth','radius','hole','depth']],
  ['spring',['radius','wire','turns','height']],
  ['arrow',['size','depth']],
  ['cross',['size','depth']],
  ['l-bracket',['size','thickness','depth']],
  ['stairs',['steps','width','height','depth']],
  ['vase',['height','radius','segments']],
  ['bowl',['radius','segments']],
  ['wedge',['width','height','depth']],
  ['chain-link',['size','wire']],
  ['torus-knot',['radius','tube','p','q']],
  ['trefoil',['size','tube']],
  ['mobius',['radius','width','twists']],
  ['klein-bottle',['size']],
  ['superellipsoid',['radius','e1','e2']],
  ['supershape',['radius','m','n1','n2','n3']],
  ['seashell',['size','turns']],
  ['menger-sponge',['size','level']],
  ['sierpinski',['size','level']],
  ['helicoid',['radius','height','turns']],
  ['enneper',['size','extent']],
  ['dini',['size','twist']],
  ['hyperboloid',['radius','height','waist']],
  ['spherical-harmonic',['size','m1','m2','m3','m4']],
  ['twisted-torus',['radius','tube','sides','twist']],
];
