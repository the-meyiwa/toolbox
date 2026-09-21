/**
 * Dimensional profiles for the North American Toyota Corolla sedans covered by
 * the Automobile Guide. Published dimensions are used verbatim; styling knots
 * (bonnet rise, glasshouse spline, lamp outlines) are Toolbox approximations
 * tuned to match side/front reference proportions and are labelled as such in
 * each package manifest.
 */

const IN = 0.0254;

/** 2014–2016 Corolla (E170, North America). */
export const E170 = {
  id: 'toyota-corolla-2014-2016',
  // Published: 182.6 in length, 69.9 in width, 57.3 in height, 106.3 in wheelbase,
  // 60.3 / 60.4 in front / rear track (2014 LE/S, Edmunds).
  L: 182.6 * IN, HW: 69.9 * IN / 2, H: 57.3 * IN, WB: 106.3 * IN,
  trackF: 60.3 * IN, trackR: 60.4 * IN,
  axleFU: 0.935,
  // Representative 16-inch fitment: 205/55R16 (grade-dependent; 15/16/17-inch fitted).
  tyre: { width: 0.205, aspect: 0.55, rimIn: 16 },
  archR: 0.372,
  noseA: 0.80, noseN: 2.6, tailA: 0.62, tailN: 2.3,
  leanF: { amt: 0.095, y0: 0.42, span: 0.34 },
  leanR: { amt: 0.13, y0: 0.45, span: 0.58 },
  vfPeak: 0.64, vfAmt: 0.065,
  bottomF: 0.2, sillY: 0.19, rockerTop: 0.32, bottomR: 0.24, bumperTopR: 0.62, rearPanelTop: 0.8,
  hood: { y0: 0.745, rise: 0.215, pow: 0.72, rearU: 1.52, crown: 0.035, zMax: 0.78 },
  belt: { u0: 1.52, y0: 0.925, u1: 3.97, y1: 1.035, pow: 1.1 },
  doors: { frontU: 1.6, bU: 2.62, rearEndU: 3.5, quarterGlassU: 3.3 },
  deck: { u0: 3.97, uPeak: 4.42, y0: 1.055, y1: 1.075, crown: 0.02, z0: 0.62, z1: 0.68 },
  glass: {
    cowlU: 1.64, roofFrontU: 2.45, roofRearU: 3.32, deckU: 3.97,
    center: [[1.64, 0.93], [1.9, 1.075], [2.2, 1.28], [2.45, 1.415], [2.7, 1.449], [2.9, 57.3 * IN], [3.12, 1.442], [3.32, 1.412], [3.55, 1.295], [3.8, 1.14], [3.97, 1.055]],
    railZ: [[1.64, 0.86], [1.95, 0.76], [2.2, 0.69], [2.45, 0.64], [2.9, 0.615], [3.32, 0.615], [3.7, 0.62], [3.97, 0.62]],
    crown: [[1.64, 0], [1.9, 0.03], [2.2, 0.045], [2.45, 0.05], [3.32, 0.05], [3.7, 0.035], [3.97, 0.02]]
  },
  lamps: {
    head: { zInner: 0.42, uOuter: 0.66, yLow: 0.615 },
    upperGrille: { z: 0.41, yLow: 0.665 },
    lowerGrille: { yLow: 0.25, yHigh: 0.53, zBottom: 0.53, zTop: 0.39 },
    fog: { z: 0.66, y: 0.345, r: 0.042 },
    tailOuterU: 4.3, tailInnerZ: 0.44, tailLow: 0.8
  },
  cabin: { dashU: 2.05, steerU: 2.3, frontSeatU: 2.72, rearSeatU: 3.38, pedalU: 1.86 },
  engine: { uCrank: 0.86 },
  features: { kneeAirbag: true, cushionAirbag: true }
};

/** 2013 Corolla (E140 facelift, North America). */
export const E140 = {
  id: 'toyota-corolla-2013',
  // Published: 102.4 in wheelbase, 179.3 in length (base; S 180.0 in),
  // 69.3 in width, 57.7 in height (Wikipedia, E140 North America).
  L: 179.3 * IN, HW: 69.3 * IN / 2, H: 57.7 * IN, WB: 102.4 * IN,
  // 60.2 / 60.4 in front / rear track (2013 S, carspecs.us).
  trackF: 60.2 * IN, trackR: 60.4 * IN,
  axleFU: 0.9,
  // 195/65R15 on 15-inch wheels (listed for the 2013 S automatic, carspecs.us).
  tyre: { width: 0.195, aspect: 0.65, rimIn: 15 },
  archR: 0.37,
  noseA: 0.74, noseN: 2.4, tailA: 0.58, tailN: 2.2,
  leanF: { amt: 0.085, y0: 0.44, span: 0.34 },
  leanR: { amt: 0.11, y0: 0.46, span: 0.56 },
  vfPeak: 0.66, vfAmt: 0.07,
  bottomF: 0.21, sillY: 0.19, rockerTop: 0.32, bottomR: 0.25, bumperTopR: 0.63, rearPanelTop: 0.81,
  hood: { y0: 0.76, rise: 0.21, pow: 0.72, rearU: 1.44, crown: 0.04, zMax: 0.76 },
  belt: { u0: 1.44, y0: 0.93, u1: 3.86, y1: 1.05, pow: 1.1 },
  doors: { frontU: 1.52, bU: 2.52, rearEndU: 3.36, quarterGlassU: 3.18 },
  deck: { u0: 3.86, uPeak: 4.3, y0: 1.07, y1: 1.085, crown: 0.02, z0: 0.62, z1: 0.68 },
  glass: {
    cowlU: 1.56, roofFrontU: 2.32, roofRearU: 3.2, deckU: 3.86,
    center: [[1.56, 0.94], [1.8, 1.09], [2.08, 1.3], [2.32, 1.43], [2.6, 1.462], [2.75, 57.7 * IN], [3.0, 1.455], [3.2, 1.425], [3.45, 1.3], [3.7, 1.15], [3.86, 1.07]],
    railZ: [[1.56, 0.85], [1.85, 0.76], [2.1, 0.69], [2.32, 0.645], [2.75, 0.62], [3.2, 0.62], [3.6, 0.625], [3.86, 0.625]],
    crown: [[1.56, 0], [1.8, 0.03], [2.08, 0.05], [2.32, 0.055], [3.2, 0.055], [3.6, 0.035], [3.86, 0.02]]
  },
  lamps: {
    head: { zInner: 0.38, uOuter: 0.56, yLow: 0.62 },
    upperGrille: { z: 0.37, yLow: 0.66 },
    lowerGrille: { yLow: 0.29, yHigh: 0.46, zBottom: 0.42, zTop: 0.36 },
    fog: { z: 0.62, y: 0.37, r: 0.038 },
    tailOuterU: 4.2, tailInnerZ: 0.46, tailLow: 0.81
  },
  cabin: { dashU: 1.97, steerU: 2.22, frontSeatU: 2.64, rearSeatU: 3.26, pedalU: 1.78 },
  engine: { uCrank: 0.83 },
  // 2013 North American Corolla: front, side and curtain airbags only.
  features: { kneeAirbag: false, cushionAirbag: false }
};

export function derive(p) {
  const tyreOD = p.tyre.rimIn * IN + 2 * p.tyre.width * p.tyre.aspect;
  return { ...p, tyreOD, wheelY: tyreOD / 2, axleRU: p.axleFU + p.WB, rimD: p.tyre.rimIn * IN };
}
