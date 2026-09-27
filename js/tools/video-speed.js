/* Video Speed, Reverse & Loop — speed up, slow down, play backwards or repeat a clip. */
import { makeMediaTool, VIDEO_ACCEPT } from '../lib/media/media-tool.js';
import { speedVideo } from '../lib/media/ops.js';

export default makeMediaTool({
  id: 'video-speed', accept: VIDEO_ACCEPT, dropLabel: 'Drop a video', action: 'Apply', suffix: 'speed',
  fields: [
    { key: 'speed', label: 'Speed', type: 'select', options: [['0.25', '0.25× (very slow)'], ['0.5', '0.5×'], ['0.75', '0.75×'], ['1', '1× (normal)'], ['1.5', '1.5×'], ['2', '2×'], ['4', '4× (timelapse)'], ['8', '8×']], value: '2' },
    { key: 'reverse', label: 'Play backwards', type: 'checkbox', value: false, hint: 'Reversing holds the whole clip in memory: keep it short.' },
    { key: 'loops', label: 'Repeat (times)', type: 'number', value: 1, min: 1, max: 20 },
    { key: 'mute', label: 'Remove sound', type: 'checkbox', value: false },
    { key: 'format', label: 'Format', type: 'select', options: [['mp4', 'MP4'], ['webm', 'WebM']], value: 'mp4' },
  ],
  build: speedVideo,
  progressDuration: (v, d) => (d ? (d * Math.max(1, Number(v.loops) || 1)) / (Number(v.speed) || 1) : null),
});
