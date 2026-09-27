/* Audio Converter — convert between MP3, M4A, WAV, FLAC, OGG and Opus, or pull the sound out of a video. */
import { makeMediaTool, AUDIO_ACCEPT, VIDEO_ACCEPT } from '../lib/media/media-tool.js';
import { convertAudio } from '../lib/media/ops.js';

export default makeMediaTool({
  id: 'audio-converter', accept: `${AUDIO_ACCEPT},${VIDEO_ACCEPT}`, dropLabel: 'Drop audio, or a video to extract its sound', action: 'Convert', suffix: 'audio', preview: 'audio',
  fields: [
    { key: 'format', label: 'Format', type: 'select', options: [['mp3', 'MP3'], ['m4a', 'M4A (AAC)'], ['wav', 'WAV (uncompressed)'], ['flac', 'FLAC (lossless)'], ['ogg', 'OGG Vorbis'], ['opus', 'Opus']], value: 'mp3' },
    { key: 'bitrate', label: 'Bitrate', type: 'select', options: [['96', '96 kbps'], ['128', '128 kbps'], ['192', '192 kbps'], ['256', '256 kbps'], ['320', '320 kbps']], value: '192', show: (v) => v.format !== 'wav' && v.format !== 'flac' },
    { key: 'sampleRate', label: 'Sample rate', type: 'select', options: [['', 'Keep'], ['44100', '44.1 kHz'], ['48000', '48 kHz'], ['22050', '22 kHz'], ['16000', '16 kHz (speech)']], value: '' },
    { key: 'channels', label: 'Channels', type: 'select', options: [['', 'Keep'], ['1', 'Mono'], ['2', 'Stereo']], value: '' },
  ],
  build: convertAudio,
});
