/* Rotate, Flip, Crop & Resize Video — fix a sideways phone video or reframe for social. */
import { makeMediaTool, VIDEO_ACCEPT } from '../lib/media/media-tool.js';
import { transformVideo } from '../lib/media/ops.js';

export default makeMediaTool({
  id: 'video-editor', accept: VIDEO_ACCEPT, dropLabel: 'Drop a video', action: 'Apply', suffix: 'edited',
  fields: [
    { key: 'rotate', label: 'Rotate', type: 'select', options: [['0', 'No rotation'], ['90', '90° clockwise'], ['180', '180°'], ['270', '90° anticlockwise']], value: '0' },
    { key: 'flip', label: 'Flip', type: 'select', options: [['none', 'No flip'], ['h', 'Mirror (horizontal)'], ['v', 'Upside down (vertical)'], ['both', 'Both']], value: 'none' },
    { key: 'crop', label: 'Crop to', type: 'select', options: [['none', 'Keep frame'], ['1:1', 'Square 1:1'], ['9:16', 'Portrait 9:16 (Reels, TikTok)'], ['4:5', 'Portrait 4:5 (feed)'], ['16:9', 'Widescreen 16:9']], value: 'none' },
    { key: 'maxHeight', label: 'Resize to', type: 'select', options: [['', 'Keep size'], ['1080', '1080p'], ['720', '720p'], ['480', '480p'], ['360', '360p']], value: '' },
    { key: 'format', label: 'Format', type: 'select', options: [['mp4', 'MP4'], ['webm', 'WebM']], value: 'mp4' },
  ],
  build: transformVideo,
});
