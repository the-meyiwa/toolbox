/* Video Merger — join clips of any format or size into one video. */
import { makeMediaTool, VIDEO_ACCEPT } from '../lib/media/media-tool.js';
import { mergeVideos } from '../lib/media/ops.js';

export default makeMediaTool({
  id: 'video-merger', accept: VIDEO_ACCEPT, dropLabel: 'Drop the clips to join', dropHint: 'they play in the order listed; reorder with the arrows', min: 2, max: 20, action: 'Join clips', suffix: 'joined',
  fields: [
    { key: 'size', label: 'Frame', type: 'select', options: [['1920x1080', '1080p landscape'], ['1280x720', '720p landscape'], ['1080x1920', '1080p portrait'], ['720x1280', '720p portrait'], ['1080x1080', 'Square']], value: '1280x720' },
    { key: 'audio', label: 'Keep sound (every clip must have a sound track)', type: 'checkbox', value: true },
    { key: 'format', label: 'Format', type: 'select', options: [['mp4', 'MP4'], ['webm', 'WebM']], value: 'mp4' },
  ],
  build: (names, v) => { const [width, height] = v.size.split('x').map(Number); return mergeVideos(names, { width, height, format: v.format, audio: v.audio }); },
});
