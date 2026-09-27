/* ============================================================
   Media jobs as ffmpeg argument lists. Pure functions, so every
   command a tool can run is tested without the engine.

   Each builder takes (inputs, options) and returns { args, output }.
   inputs are virtual file names ("in0.mp4"); output is the name to
   read back. Codecs are the ones the ffmpeg.wasm core ships with:
   H.264 (libx264), VP9 (libvpx), AAC, MP3 (libmp3lame), Opus,
   Vorbis and FLAC.
   ============================================================ */

import { parseTime } from './ffmpeg.js';

export const ext = (name) => String(name).split('.').pop().toLowerCase();
export const stem = (name) => String(name).replace(/\.[^.]+$/, '') || 'media';

const VIDEO_OUT = {
  mp4: ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart'],
  webm: ['-c:v', 'libvpx-vp9', '-row-mt', '1', '-c:a', 'libopus'],
  mov: ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac'],
  mkv: ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac'],
};
export const AUDIO_OUT = {
  mp3: ['-c:a', 'libmp3lame'], m4a: ['-c:a', 'aac'], aac: ['-c:a', 'aac'], ogg: ['-c:a', 'libvorbis'],
  opus: ['-c:a', 'libopus'], wav: ['-c:a', 'pcm_s16le'], flac: ['-c:a', 'flac'],
};
const PRESET = ['-preset', 'veryfast'];

function trimArgs(o) {
  const a = []; const s = parseTime(o.start); const e = parseTime(o.end);
  if (s) a.push('-ss', String(s));
  if (e != null && e > (s || 0)) a.push('-t', String(e - (s || 0)));
  return a;
}

/** Scale to fit a maximum height, keeping the aspect ratio and even dimensions. */
const scaleTo = (h) => (h ? `scale=-2:'min(${h},ih)'` : null);

export function compressVideo([input], { quality = 'balanced', maxHeight = '720', format = 'mp4', mute = false }) {
  const crf = { small: 32, balanced: 27, high: 22 }[quality] ?? 27;
  const vf = scaleTo(Number(maxHeight));
  const output = `out.${format}`;
  const video = format === 'webm' ? ['-c:v', 'libvpx-vp9', '-crf', String(crf + 6), '-b:v', '0', '-row-mt', '1'] : ['-c:v', 'libx264', '-crf', String(crf), ...PRESET, '-pix_fmt', 'yuv420p'];
  return { args: ['-i', input, ...(vf ? ['-vf', vf] : []), ...video, ...(mute ? ['-an'] : format === 'webm' ? ['-c:a', 'libopus', '-b:a', '96k'] : ['-c:a', 'aac', '-b:a', '128k']), ...(format === 'mp4' ? ['-movflags', '+faststart'] : []), output], output };
}

export function trimVideo([input], o) {
  const output = `out.${o.format || ext(input)}`;
  // Stream copy is instant but cuts on keyframes; re-encoding is exact.
  const codec = o.exact ? [...(VIDEO_OUT[ext(output)] || VIDEO_OUT.mp4), ...PRESET] : ['-c', 'copy', '-avoid_negative_ts', 'make_zero'];
  return { args: [...(o.exact ? [] : trimArgs(o)), '-i', input, ...(o.exact ? trimArgs(o) : []), ...codec, output], output };
}

export function videoToGif([input], { fps = 12, width = 480, start, end, loop = true }) {
  const vf = `fps=${fps},scale=${width}:-1:flags=lanczos,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5`;
  return { args: [...trimArgs({ start, end }), '-i', input, '-vf', vf, '-loop', loop ? '0' : '-1', 'out.gif'], output: 'out.gif' };
}

export function transformVideo([input], { rotate = '0', flip = 'none', maxHeight = '', crop = 'none', format = 'mp4' }) {
  const f = [];
  if (crop !== 'none') {
    const [w, h] = crop.split(':').map(Number);
    f.push(`crop='min(iw,ih*${w}/${h})':'min(ih,iw*${h}/${w})'`);
  }
  if (rotate === '90') f.push('transpose=1'); else if (rotate === '270') f.push('transpose=2'); else if (rotate === '180') f.push('transpose=1,transpose=1');
  if (flip === 'h' || flip === 'both') f.push('hflip');
  if (flip === 'v' || flip === 'both') f.push('vflip');
  if (maxHeight) f.push(scaleTo(Number(maxHeight)));
  if (!f.length) throw new Error('Choose at least one change.');
  const output = `out.${format}`;
  return { args: ['-i', input, '-vf', f.join(','), ...VIDEO_OUT[format], ...PRESET, output], output };
}

/** atempo only takes 0.5–2, so larger changes chain it. */
export function atempoChain(speed) {
  const out = []; let s = speed;
  while (s > 2) { out.push('atempo=2'); s /= 2; }
  while (s < 0.5) { out.push('atempo=0.5'); s /= 0.5; }
  out.push(`atempo=${Number(s.toFixed(4))}`);
  return out.join(',');
}

export function speedVideo([input], { speed = 1, reverse = false, loops = 1, mute = false, format = 'mp4' }) {
  const s = Number(speed) || 1;
  const vf = []; const af = [];
  if (reverse) { vf.push('reverse'); af.push('areverse'); }
  if (s !== 1) { vf.push(`setpts=PTS/${s}`); af.push(atempoChain(s)); }
  const loop = Math.max(1, Math.min(20, Number(loops) || 1));
  const output = `out.${format}`;
  return {
    args: [...(loop > 1 ? ['-stream_loop', String(loop - 1)] : []), '-i', input, ...(vf.length ? ['-vf', vf.join(',')] : []), ...(mute ? ['-an'] : af.length ? ['-af', af.join(',')] : []), ...VIDEO_OUT[format], ...PRESET, output],
    output,
  };
}

/** Join clips of any size or format: each is scaled and padded to the first's frame. */
export function mergeVideos(inputs, { width = 1280, height = 720, format = 'mp4', audio = true }) {
  const parts = inputs.map((_, i) => `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30,format=yuv420p[v${i}]`);
  const cat = audio
    ? `${inputs.map((_, i) => `[v${i}][${i}:a]`).join('')}concat=n=${inputs.length}:v=1:a=1[v][a]`
    : `${inputs.map((_, i) => `[v${i}]`).join('')}concat=n=${inputs.length}:v=1:a=0[v]`;
  const output = `out.${format}`;
  return { args: [...inputs.flatMap((n) => ['-i', n]), '-filter_complex', `${parts.join(';')};${cat}`, '-map', '[v]', ...(audio ? ['-map', '[a]'] : []), ...VIDEO_OUT[format], ...PRESET, output], output };
}

export function addAudio([video, audio], { mode = 'replace', volume = 100, shortest = true }) {
  const vol = Math.max(0, Number(volume) || 100) / 100;
  const output = `out.${ext(video) === 'webm' ? 'webm' : 'mp4'}`;
  const aCodec = output.endsWith('webm') ? ['-c:a', 'libopus'] : ['-c:a', 'aac', '-b:a', '192k'];
  if (mode === 'mix') {
    return { args: ['-i', video, '-i', audio, '-filter_complex', `[1:a]volume=${vol}[m];[0:a][m]amix=inputs=2:duration=first:dropout_transition=2[a]`, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', ...aCodec, output], output };
  }
  return { args: ['-i', video, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', ...(vol !== 1 ? ['-af', `volume=${vol}`] : []), ...aCodec, ...(shortest ? ['-shortest'] : []), output], output };
}

export function convertAudio([input], { format = 'mp3', bitrate = '192', sampleRate = '', channels = '', start, end }) {
  const output = `out.${format}`;
  const lossless = format === 'wav' || format === 'flac';
  return {
    args: [...trimArgs({ start, end }), '-i', input, '-vn', ...AUDIO_OUT[format], ...(lossless ? [] : ['-b:a', `${bitrate}k`]), ...(sampleRate ? ['-ar', sampleRate] : []), ...(channels ? ['-ac', channels] : []), output],
    output,
  };
}

export function editAudio([input], { start, end, fadeIn = 0, fadeOut = 0, volume = 100, speed = 1, normalize = false, format = 'mp3', loops = 1, duration }) {
  const af = [];
  const s = parseTime(start) || 0; const e = parseTime(end);
  const len = (e != null && e > s ? e : duration || 0) - s;
  if (Number(fadeIn) > 0) af.push(`afade=t=in:st=0:d=${fadeIn}`);
  if (Number(fadeOut) > 0 && len > 0) af.push(`afade=t=out:st=${Math.max(0, len - fadeOut)}:d=${fadeOut}`);
  if (Number(volume) !== 100) af.push(`volume=${Number(volume) / 100}`);
  if (normalize) af.push('loudnorm=I=-16:TP=-1.5:LRA=11');
  if (Number(speed) !== 1) af.push(atempoChain(Number(speed)));
  const loop = Math.max(1, Math.min(50, Number(loops) || 1));
  const output = `out.${format}`;
  return {
    args: [...(loop > 1 ? ['-stream_loop', String(loop - 1)] : []), ...trimArgs({ start, end }), '-i', input, '-vn', ...(af.length ? ['-af', af.join(',')] : []), ...AUDIO_OUT[format], ...(format === 'wav' || format === 'flac' ? [] : ['-b:a', '192k']), output],
    output,
  };
}

export function mergeAudio(inputs, { format = 'mp3', crossfade = 0 }) {
  const output = `out.${format}`;
  const cf = Number(crossfade) || 0;
  let graph;
  if (cf > 0 && inputs.length > 1) {
    graph = inputs.slice(1).reduce((acc, _, i) => {
      const prev = i === 0 ? '[0:a]' : `[x${i}]`;
      const out = i === inputs.length - 2 ? '[a]' : `[x${i + 1}]`;
      return `${acc}${acc ? ';' : ''}${prev}[${i + 1}:a]acrossfade=d=${cf}${out}`;
    }, '');
  } else graph = `${inputs.map((_, i) => `[${i}:a]`).join('')}concat=n=${inputs.length}:v=0:a=1[a]`;
  return { args: [...inputs.flatMap((n) => ['-i', n]), '-filter_complex', graph, '-map', '[a]', ...AUDIO_OUT[format], ...(format === 'wav' || format === 'flac' ? [] : ['-b:a', '192k']), output], output };
}

/** A frame as an image, for thumbnails and posters. */
export function grabFrame([input], { at = '0', format = 'jpg' }) {
  const output = `frame.${format}`;
  return { args: ['-ss', String(parseTime(at) || 0), '-i', input, '-frames:v', '1', ...(format === 'jpg' ? ['-q:v', '2'] : []), output], output };
}
