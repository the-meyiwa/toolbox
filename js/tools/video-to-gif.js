/* Video to GIF — a sharp, small animated GIF from any clip, with an optimised palette. */
import { makeMediaTool, VIDEO_ACCEPT } from '../lib/media/media-tool.js';
import { videoToGif } from '../lib/media/ops.js';
import { humanBytes } from '../lib/kit/form.js';

export default makeMediaTool({
  id: 'video-to-gif', accept: VIDEO_ACCEPT, dropLabel: 'Drop a video to make a GIF', action: 'Make GIF', suffix: 'animated', preview: 'image',
  fields: [
    { key: 'start', label: 'Start (m:ss)', type: 'text', value: '0:00' },
    { key: 'end', label: 'End (m:ss)', type: 'text', value: '0:05', hint: 'Keep GIFs short: they grow fast.' },
    { key: 'width', label: 'Width', type: 'select', options: [['320', '320 px'], ['480', '480 px'], ['640', '640 px'], ['800', '800 px']], value: '480' },
    { key: 'fps', label: 'Frames per second', type: 'select', options: [['8', '8'], ['12', '12'], ['15', '15'], ['24', '24']], value: '12' },
    { key: 'loop', label: 'Loop forever', type: 'checkbox', value: true },
  ],
  build: videoToGif,
  summary: (_, b) => `${humanBytes(b)} GIF.`,
});
