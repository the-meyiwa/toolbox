/* Video Trimmer — cut a clip out of a video. */
import { makeMediaTool, VIDEO_ACCEPT } from '../lib/media/media-tool.js';
import { trimVideo } from '../lib/media/ops.js';
import { parseTime } from '../lib/media/ffmpeg.js';

export default makeMediaTool({
  id: 'video-trimmer', accept: VIDEO_ACCEPT, dropLabel: 'Drop a video to trim', action: 'Trim', suffix: 'clip',
  fields: [
    { key: 'start', label: 'Start (m:ss)', type: 'text', value: '0:00' },
    { key: 'end', label: 'End (m:ss, blank = to the end)', type: 'text', value: '' },
    { key: 'exact', label: 'Frame-exact cut (slower, re-encodes)', type: 'checkbox', value: false, hint: 'Off: instant and lossless, but starts at the nearest keyframe.' },
  ],
  build: trimVideo,
  progressDuration: (v, d) => { const s = parseTime(v.start) || 0; const e = parseTime(v.end); return (e ?? d ?? 0) - s || d; },
});
