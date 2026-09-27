/* Video Compressor — shrink a video for sharing, by quality and size. */
import { makeMediaTool, VIDEO_ACCEPT } from '../lib/media/media-tool.js';
import { compressVideo } from '../lib/media/ops.js';
import { humanBytes } from '../lib/kit/form.js';

export default makeMediaTool({
  id: 'video-compressor', accept: VIDEO_ACCEPT, dropLabel: 'Drop a video to compress', action: 'Compress', suffix: 'compressed',
  fields: [
    { key: 'quality', label: 'Quality', type: 'seg', options: [['small', 'Smallest'], ['balanced', 'Balanced'], ['high', 'High']], value: 'balanced' },
    { key: 'maxHeight', label: 'Maximum size', type: 'select', options: [['1080', '1080p'], ['720', '720p'], ['480', '480p'], ['360', '360p'], ['0', 'Keep original']], value: '720' },
    { key: 'format', label: 'Format', type: 'select', options: [['mp4', 'MP4 (plays everywhere)'], ['webm', 'WebM (smaller, slower)']], value: 'mp4' },
    { key: 'mute', label: 'Remove sound', type: 'checkbox', value: false },
  ],
  build: compressVideo,
  summary: (a, b) => `${humanBytes(a)} → ${humanBytes(b)} (${b < a ? `${Math.round((1 - b / a) * 100)}% smaller` : 'no smaller: try a lower size or quality'}).`,
});
