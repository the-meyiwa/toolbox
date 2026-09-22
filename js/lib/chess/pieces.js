/* Toolbox piece set — drawn for this app in the same soft-monochrome language
   as the rest of the interface. 45×45 viewBox, one outline weight. */

const BASE = 'M11 38.5h23c0-1.8-1-2.8-2.8-2.8H13.8c-1.8 0-2.8 1-2.8 2.8z';

const SHAPES = {
  p: {
    body: ['M22.5 8.5a5 5 0 0 0-3.4 8.7c-2.4 1.5-3.9 4-3.9 6.9 0 2 .8 3.8 2 5.1-3.3 1.6-5.9 5.1-6.4 10.3h23.4c-.5-5.2-3.1-8.7-6.4-10.3 1.2-1.3 2-3.1 2-5.1 0-2.9-1.5-5.4-3.9-6.9a5 5 0 0 0-3.4-8.7z'],
    detail: [],
  },
  r: {
    body: [
      'M10.5 38.5h24v-3.4h-24z',
      'M13 35.1l1.9-4.6h15.2l1.9 4.6z',
      'M15 30.5V18.6h15v11.9z',
      'M12.4 18.6l2.6-2.6h15l2.6 2.6z',
      'M12.4 16V9.5h4.3v2.7h3.6V9.5h4.4v2.7h3.6V9.5h4.3V16z',
    ],
    detail: [],
  },
  n: {
    body: ['M13.2 38.5h20.9c.3-6.6-1.4-11.1-4.2-14.8 1.1-3.6.6-7.3-1.6-10.3l1.5-4.7-4.3 2.1c-1.3-.8-2.9-1.2-4.6-1.2-5.8 0-9.6 4.4-11.6 10.4l-1.8 4.5 2.4 2.7 3.2-2.1 3.7-.4c-1.3 2-3.3 4.1-4.7 7-1.1 2.3-1.6 4.4-1.4 6.8z'],
    detail: ['M16.5 21.8c1.1-.3 2.3-.9 3.2-1.8'],
    eye: [19.3, 15.4, 1.3],
  },
  b: {
    body: [
      BASE,
      'M15.6 35.7c.8-2.5 1.9-4.2 3.4-5.3h7c1.5 1.1 2.6 2.8 3.4 5.3z',
      'M22.5 11.2c-4.7 3.2-8 7.8-8 12.5 0 3.4 1.9 5.5 4.5 6.7h7c2.6-1.2 4.5-3.3 4.5-6.7 0-4.7-3.3-9.3-8-12.5z',
      'M22.5 6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 1 0 0-4.8z',
    ],
    detail: ['M25.2 16.3l-4.6 6.4', 'M17.8 30.4h9.4'],
  },
  q: {
    body: [
      BASE,
      'M13.3 35.7L11 17.6l5.6 8.5.6-11.9 3.2 10.4 2.1-12.2 2.1 12.2 3.2-10.4.6 11.9 5.6-8.5-2.3 18.1z',
      'M11 13.4a2 2 0 1 0 0 4 2 2 0 1 0 0-4z', 'M17.2 10.1a2 2 0 1 0 0 4 2 2 0 1 0 0-4z',
      'M22.5 8.3a2 2 0 1 0 0 4 2 2 0 1 0 0-4z', 'M27.8 10.1a2 2 0 1 0 0 4 2 2 0 1 0 0-4z',
      'M34 13.4a2 2 0 1 0 0 4 2 2 0 1 0 0-4z',
    ],
    detail: ['M14.3 31.2h16.4'],
  },
  k: {
    body: [
      BASE,
      'M13.9 35.7c-.6-3.4-1.8-6.5-3.3-9.3-1.8-3.4.4-7 4.1-7.1 3.2-.1 5.5 1.6 7.8 4.4 2.3-2.8 4.6-4.5 7.8-4.4 3.7.1 5.9 3.7 4.1 7.1-1.5 2.8-2.7 5.9-3.3 9.3z',
      'M22.5 23.7c-1.2-2.4-2.6-4.4-2.6-6.2 0-1.5 1.1-2.6 2.6-2.6s2.6 1.1 2.6 2.6c0 1.8-1.4 3.8-2.6 6.2z',
    ],
    detail: ['M14.6 31.2h15.8'],
    cross: ['M22.5 5.2v9.2', 'M18.9 8.8h7.2'],
  },
};

const PALETTE = {
  w: { fill: '#fbfbfa', stroke: '#161616', detail: '#161616' },
  b: { fill: '#1d1d1d', stroke: '#050505', detail: '#e9e9e7' },
};

/** SVG markup for a piece. color 'w' | 'b', type 'p' 'n' 'b' 'r' 'q' 'k'. */
export function pieceSvg(color, type) {
  const s = SHAPES[type], c = PALETTE[color];
  const body = s.body.map(d => `<path d="${d}"/>`).join('');
  const detail = s.detail.map(d => `<path d="${d}" fill="none" stroke="${c.detail}"/>`).join('');
  const eye = s.eye ? `<circle cx="${s.eye[0]}" cy="${s.eye[1]}" r="${s.eye[2]}" fill="${c.detail}" stroke="none"/>` : '';
  const cross = s.cross ? s.cross.map(d => `<path d="${d}" fill="none" stroke="${c.stroke}" stroke-width="2.4"/>`).join('') : '';
  return `<svg viewBox="0 0 45 45" aria-hidden="true" focusable="false"><g fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round">${cross}${body}${detail}${eye}</g></svg>`;
}

export const PIECE_NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
