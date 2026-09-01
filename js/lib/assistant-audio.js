/* ============================================================
   TOOLBOX — Assistant Audio Manager
   Manages real-time audio playback, search, synthesized fallbacks,
   and interactive audio player state for the Assistant conversation.
   ============================================================ */

class AssistantAudioService {
  constructor() {
    this.instances = new Map();
    this.currentActiveId = null;
    this.listeners = new Set();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify(event, data) {
    this.listeners.forEach(fn => {
      try { fn(event, data); } catch (e) { console.error('Audio listener error:', e); }
    });
    window.dispatchEvent(new CustomEvent('toolbox:assistant-audio', { detail: { event, ...data } }));
  }

  async playSound({ query = 'sound effect', url = null, title = null, artist = null, artworkUrl = null, loop = false }) {
    // 1. Stop any currently playing audio to prevent overlapping chaos
    this.stopAll();

    let audioUrl = url;
    let trackTitle = title || query;
    let trackArtist = artist || 'Sound Effects';
    let trackArtwork = artworkUrl || '';
    let trackDuration = 30; // standard iTunes preview duration in seconds

    // 2. Fetch audio track preview if no direct URL is provided
    if (!audioUrl) {
      try {
        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=10`);
        if (res.ok) {
          const data = await res.json();
          const tracks = (data.results || []).filter(r => r.previewUrl);
          if (tracks.length > 0) {
            const track = tracks[0];
            audioUrl = track.previewUrl;
            trackTitle = track.trackName || trackTitle;
            trackArtist = track.artistName || trackArtist;
            trackArtwork = track.artworkUrl60 || track.artworkUrl30 || '';
          }
        }
      } catch (err) {
        console.warn('iTunes search failed, attempting fallback:', err);
      }
    }

    // 3. Fallback: Synthesized Web Audio tone/melody if search returned no results
    if (!audioUrl) {
      try {
        const synthData = this.generateSynthAudio(query);
        audioUrl = synthData.url;
        trackTitle = synthData.title;
        trackArtist = 'Toolbox WebAudio Synth';
        trackDuration = synthData.duration;
      } catch (err) {
        throw new Error(`Could not find or synthesize audio for "${query}".`);
      }
    }

    const audioId = `aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const audio = new Audio(audioUrl);
    audio.crossOrigin = 'anonymous';
    audio.volume = 1.0;
    audio.loop = !!loop;

    const instanceData = {
      id: audioId,
      audio,
      title: trackTitle,
      artist: trackArtist,
      artworkUrl: trackArtwork,
      url: audioUrl,
      duration: trackDuration,
      currentTime: 0,
      volume: 1.0,
      isPlaying: false,
      isEnded: false,
      error: null
    };

    // Attach event listeners to real Audio element
    audio.addEventListener('loadedmetadata', () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        instanceData.duration = audio.duration;
      }
      this.notify('update', instanceData);
    });

    audio.addEventListener('play', () => {
      instanceData.isPlaying = true;
      instanceData.isEnded = false;
      this.notify('play', instanceData);
    });

    audio.addEventListener('pause', () => {
      instanceData.isPlaying = false;
      this.notify('pause', instanceData);
    });

    audio.addEventListener('timeupdate', () => {
      instanceData.currentTime = audio.currentTime;
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        instanceData.duration = audio.duration;
      }
      this.notify('timeupdate', instanceData);
    });

    audio.addEventListener('ended', () => {
      instanceData.isPlaying = false;
      instanceData.isEnded = true;
      this.notify('ended', instanceData);
    });

    audio.addEventListener('error', (e) => {
      instanceData.isPlaying = false;
      instanceData.error = 'Failed to load or decode audio stream.';
      this.notify('error', instanceData);
    });

    this.instances.set(audioId, instanceData);
    this.currentActiveId = audioId;

    try {
      await audio.play();
      instanceData.isPlaying = true;
    } catch (e) {
      console.warn('Audio auto-play prevented or failed:', e);
      // Even if autoplay is blocked by browser policies, keep instance registered so user can click Play
    }

    return {
      success: true,
      type: 'audio',
      action: 'play',
      audioId,
      title: trackTitle,
      artist: trackArtist,
      artworkUrl: trackArtwork,
      url: audioUrl,
      duration: instanceData.duration,
      controls: true,
      message: `Playing "${trackTitle}" by ${trackArtist}. Interactive audio controls are displayed.`
    };
  }

  getInstance(audioId) {
    if (audioId) return this.instances.get(audioId);
    if (this.currentActiveId) return this.instances.get(this.currentActiveId);
    return null;
  }

  pause(audioId) {
    const inst = this.getInstance(audioId);
    if (!inst) return { success: false, message: 'No active audio found to pause.' };
    inst.audio.pause();
    return { success: true, audioId: inst.id, action: 'pause', message: `Paused "${inst.title}".` };
  }

  resume(audioId) {
    const inst = this.getInstance(audioId);
    if (!inst) return { success: false, message: 'No active audio found to resume.' };
    inst.audio.play().catch(e => console.error('Resume failed:', e));
    return { success: true, audioId: inst.id, action: 'resume', message: `Resumed "${inst.title}".` };
  }

  stop(audioId) {
    const inst = this.getInstance(audioId);
    if (!inst) return { success: false, message: 'No active audio found to stop.' };
    inst.audio.pause();
    inst.audio.currentTime = 0;
    inst.currentTime = 0;
    inst.isPlaying = false;
    this.notify('stop', inst);
    return { success: true, audioId: inst.id, action: 'stop', message: `Stopped "${inst.title}".` };
  }

  seek(audioId, seconds) {
    const inst = this.getInstance(audioId);
    if (!inst) return { success: false, message: 'No active audio found to seek.' };
    const clamped = Math.max(0, Math.min(seconds, inst.duration || 300));
    inst.audio.currentTime = clamped;
    inst.currentTime = clamped;
    this.notify('timeupdate', inst);
    return { success: true, audioId: inst.id, action: 'seek', time: clamped, message: `Seeked to ${clamped.toFixed(1)}s.` };
  }

  setVolume(audioId, volume) {
    const inst = this.getInstance(audioId);
    if (!inst) return { success: false, message: 'No active audio found to adjust volume.' };
    const clamped = Math.max(0, Math.min(1.0, volume));
    inst.audio.volume = clamped;
    inst.volume = clamped;
    this.notify('volume', inst);
    return { success: true, audioId: inst.id, action: 'volume', volume: clamped, message: `Volume set to ${Math.round(clamped * 100)}%.` };
  }

  stopAll() {
    this.instances.forEach(inst => {
      try {
        if (inst.audio) {
          inst.audio.pause();
          inst.audio.currentTime = 0;
          inst.audio.src = '';
          inst.audio.load();
        }
        inst.isPlaying = false;
      } catch (e) {}
    });
    this.instances.clear();
    this.currentActiveId = null;
  }

  destroyAll() {
    this.stopAll();
  }

  generateSynthAudio(query) {
    // Generate a simple pleasant melody/arpeggio data URL as audio/wav
    const sampleRate = 22050;
    const duration = 2.5;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new Float32Array(numSamples);

    let baseFreq = 440; // A4
    const lower = (query || '').toLowerCase();
    if (lower.includes('piano') || lower.includes('chord')) baseFreq = 261.63; // C4
    else if (lower.includes('laser') || lower.includes('beep')) baseFreq = 880; // A5
    else if (lower.includes('bass') || lower.includes('drum')) baseFreq = 110; // A2

    const notes = [baseFreq, baseFreq * 1.25, baseFreq * 1.5, baseFreq * 2];
    const noteDuration = duration / notes.length;

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const noteIdx = Math.min(notes.length - 1, Math.floor(t / noteDuration));
      const freq = notes[noteIdx];
      const noteTime = t % noteDuration;
      const env = Math.exp(-3 * (noteTime / noteDuration));
      buffer[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.4;
    }

    // Convert Float32Array to 16-bit PCM WAV Data URI
    const wavBuffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(wavBuffer);

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(view, 8, 'WAVE');
    // fmt sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    // data sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, numSamples * 2, true);

    let offset = 44;
    for (let i = 0; i < numSamples; i++) {
      const s = Math.max(-1, Math.min(1, buffer[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }

    const blob = new Blob([view], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);

    return {
      url,
      title: `${query.charAt(0).toUpperCase() + query.slice(1)} (Synth Sample)`,
      duration: duration
    };
  }
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

export const AssistantAudioManager = new AssistantAudioService();
