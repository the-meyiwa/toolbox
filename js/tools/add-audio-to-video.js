/* Add Audio to Video — replace a video's sound with music or a voice-over, or mix it in. */
import { makeMediaTool } from '../lib/media/media-tool.js';
import { addAudio } from '../lib/media/ops.js';

export default makeMediaTool({
  id: 'add-audio-to-video', accept: 'video/*,audio/*,.mp4,.mov,.webm,.mkv,.mp3,.wav,.m4a,.aac,.ogg,.flac', dropLabel: 'Drop a video, then an audio file', dropHint: 'the video first, the sound second', min: 2, max: 2, action: 'Combine', suffix: 'with-audio',
  fields: [
    { key: 'mode', label: 'Sound', type: 'seg', options: [['replace', 'Replace'], ['mix', 'Mix with original']], value: 'replace' },
    { key: 'volume', label: 'New audio volume', type: 'range', min: 0, max: 200, value: 100, unit: '%' },
    { key: 'shortest', label: 'End when the shorter one ends', type: 'checkbox', value: true, show: (v) => v.mode === 'replace' },
  ],
  build: addAudio,
  progressDuration: (_, d) => d,
});
