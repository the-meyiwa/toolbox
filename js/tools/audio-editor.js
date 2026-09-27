/* Audio Trimmer & Editor — trim, fade, change volume or speed, normalise loudness, loop. */
import { makeMediaTool, AUDIO_ACCEPT } from '../lib/media/media-tool.js';
import { editAudio } from '../lib/media/ops.js';

export default makeMediaTool({
  id: 'audio-editor', accept: AUDIO_ACCEPT, dropLabel: 'Drop an audio file', action: 'Apply', suffix: 'edited', preview: 'audio',
  fields: [
    { key: 'start', label: 'Start (m:ss)', type: 'text', value: '0:00' },
    { key: 'end', label: 'End (m:ss, blank = to the end)', type: 'text', value: '' },
    { key: 'fadeIn', label: 'Fade in (s)', type: 'number', value: 0, min: 0, step: 0.5 },
    { key: 'fadeOut', label: 'Fade out (s)', type: 'number', value: 0, min: 0, step: 0.5 },
    { key: 'volume', label: 'Volume', type: 'range', min: 0, max: 300, value: 100, unit: '%' },
    { key: 'speed', label: 'Speed (pitch kept)', type: 'select', options: [['0.5', '0.5×'], ['0.75', '0.75×'], ['1', '1×'], ['1.25', '1.25×'], ['1.5', '1.5×'], ['2', '2×']], value: '1' },
    { key: 'loops', label: 'Repeat (times)', type: 'number', value: 1, min: 1, max: 50 },
    { key: 'normalize', label: 'Normalise loudness (podcast level)', type: 'checkbox', value: false },
    { key: 'format', label: 'Format', type: 'select', options: [['mp3', 'MP3'], ['m4a', 'M4A'], ['wav', 'WAV'], ['ogg', 'OGG']], value: 'mp3' },
  ],
  build: (names, v, { duration }) => editAudio(names, { ...v, duration }),
});
