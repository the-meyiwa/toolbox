/* ============================================================
   Media tool factory: a file shell whose job is one ops.js builder
   run through ffmpeg.wasm. Tools only choose fields and a builder.
   ============================================================ */

import { makeFileTool } from '../kit/file-tool.js';
import { runFFmpeg, probeDuration } from './ffmpeg.js';
import { ext, stem } from './ops.js';

export const VIDEO_ACCEPT = 'video/*,.mp4,.mov,.webm,.mkv,.avi,.m4v,.3gp';
export const AUDIO_ACCEPT = 'audio/*,.mp3,.wav,.m4a,.aac,.ogg,.opus,.flac,.wma';

/**
 * @param {object} def makeFileTool fields plus
 *   build(inputNames, values, { duration }) → { args, output }
 *   suffix: string for the output name
 *   preview: 'video' | 'audio' | 'image'
 */
export function makeMediaTool(def) {
  return makeFileTool({
    note: 'Processed on this device. The first run downloads the video engine (about 30 MB), then it is cached.',
    ...def,
    async run(files, values, { signal, progress }) {
      const names = files.map((f, i) => `in${i}.${ext(f.name) || 'bin'}`);
      const durations = await Promise.all(files.map((f) => probeDuration(f.file)));
      const duration = durations.reduce((a, d) => a + (d || 0), 0) || null;
      const { args, output } = def.build(names, values, { duration, durations, files });
      const inputs = await Promise.all(files.map(async (f, i) => ({ name: names[i], data: await f.bytes() })));
      const data = await runFFmpeg(inputs, args, output, { signal, onProgress: progress, duration: def.progressDuration ? def.progressDuration(values, duration) : duration });
      const name = `${stem(files[0].name)}-${def.suffix || 'edited'}.${ext(output)}`;
      const before = files.reduce((n, f) => n + f.size, 0);
      return {
        files: [{ name, data }],
        preview: def.preview || (/^(mp3|m4a|aac|ogg|opus|wav|flac)$/.test(ext(output)) ? 'audio' : ext(output) === 'gif' ? 'image' : 'video'),
        note: def.summary ? def.summary(before, data.length, values) : undefined,
      };
    },
  });
}
