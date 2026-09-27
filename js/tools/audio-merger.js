/* Audio Merger — join tracks into one file, with optional crossfades. */
import { makeMediaTool, AUDIO_ACCEPT } from '../lib/media/media-tool.js';
import { mergeAudio } from '../lib/media/ops.js';

export default makeMediaTool({
  id: 'audio-merger', accept: AUDIO_ACCEPT, dropLabel: 'Drop the tracks to join', dropHint: 'they play in the order listed', min: 2, max: 30, action: 'Join tracks', suffix: 'joined', preview: 'audio',
  fields: [
    { key: 'crossfade', label: 'Crossfade (seconds)', type: 'number', value: 0, min: 0, max: 10, step: 0.5 },
    { key: 'format', label: 'Format', type: 'select', options: [['mp3', 'MP3'], ['m4a', 'M4A'], ['wav', 'WAV'], ['ogg', 'OGG']], value: 'mp3' },
  ],
  build: mergeAudio,
});
