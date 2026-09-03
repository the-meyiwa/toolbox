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

    // 2. Fetch audio track preview from iTunes if no direct URL is provided
    if (!audioUrl) {
      const searchTerms = [
        // Stage 1: Exact query with entity=song
        `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=15`,
        // Stage 2: Broader search without entity filter (finds sound effects, soundtracks, instrumentals)
        `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&limit=15`,
        // Stage 3: Simplified search stripping filler words
        `https://itunes.apple.com/search?term=${encodeURIComponent(query.replace(/\b(play|some|music|song|audio|sound|sounds|of|the|a|an|in|for|track)\b/gi, '').trim() || query)}&limit=15`
      ];

      for (const urlEndpoint of searchTerms) {
        if (audioUrl) break;
        try {
          const res = await fetch(urlEndpoint);
          if (res.ok) {
            const data = await res.json();
            const tracks = (data.results || []).filter(r => r.previewUrl);
            if (tracks.length > 0) {
              const track = tracks[0];
              audioUrl = track.previewUrl;
              trackTitle = track.trackName || trackTitle;
              trackArtist = track.artistName || trackArtist;
              trackArtwork = track.artworkUrl100 || track.artworkUrl60 || track.artworkUrl30 || '';
            }
          }
        } catch (err) {
          console.warn('iTunes search endpoint failed:', urlEndpoint, err);
        }
      }
    }

    // 3. If iTunes returned no playable preview, throw clear error (NO synthesized fanfare)
    if (!audioUrl) {
      throw new Error(`Could not find an audio preview for "${query}" on iTunes. Please try searching by track title, artist name, or genre.`);
    }

    const audioId = `aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const audio = typeof Audio !== 'undefined'
      ? new Audio(audioUrl)
      : {
          play: async () => {},
          pause: () => {},
          load: () => {},
          addEventListener: () => {},
          currentTime: 0,
          duration: 30,
          volume: 1
        };
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
      message: `Now playing "${trackTitle}" by ${trackArtist}.`
    };
  }

  getInstance(audioId) {
    if (audioId) return this.instances.get(audioId);
    if (this.currentActiveId) return this.instances.get(this.currentActiveId);
    return null;
  }

  /**
   * Restore a serialized player for a historical result without auto-playing.
   * The HTMLAudioElement is the authoritative source of truth.
   */
  restore(data = {}) {
    if (!data.audioId || !data.url) return null;
    const existing = this.getInstance(data.audioId);
    if (existing) {
      if (existing.audio) {
        existing.isPlaying = !existing.audio.paused && !existing.audio.ended;
        existing.currentTime = existing.audio.currentTime || 0;
      }
      return existing;
    }

    const audio = typeof Audio !== 'undefined'
      ? new Audio(data.url)
      : {
          play: async () => {},
          pause: () => {},
          load: () => {},
          addEventListener: () => {},
          currentTime: 0,
          duration: data.duration || 30,
          volume: data.volume ?? 1,
          paused: true,
          ended: false,
          readyState: 0
        };

    const instance = {
      id: data.audioId,
      audio,
      title: data.title || 'Audio Sample',
      artist: data.artist || 'Toolbox Audio',
      artworkUrl: data.artworkUrl || '',
      url: data.url,
      duration: data.duration || 30,
      currentTime: data.currentTime || 0,
      volume: data.volume ?? 1.0,
      isPlaying: false,
      isEnded: false,
      isReady: false,
      error: null
    };

    if (typeof audio.volume !== 'undefined') {
      audio.volume = instance.volume;
    }

    audio.addEventListener('loadedmetadata', () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        instance.duration = audio.duration;
      }
      if (instance.currentTime > 0 && typeof audio.currentTime !== 'undefined') {
        try { audio.currentTime = instance.currentTime; } catch {}
      }
      instance.isReady = true;
      this.notify('update', instance);
    });

    audio.addEventListener('canplay', () => {
      instance.isReady = true;
      if (instance.currentTime > 0 && typeof audio.currentTime !== 'undefined' && Math.abs(audio.currentTime - instance.currentTime) > 1) {
        try { audio.currentTime = instance.currentTime; } catch {}
      }
      this.notify('update', instance);
    });

    audio.addEventListener('play', () => {
      instance.isPlaying = true;
      instance.isEnded = false;
      this.notify('play', instance);
    });

    audio.addEventListener('pause', () => {
      instance.isPlaying = false;
      this.notify('pause', instance);
    });

    audio.addEventListener('timeupdate', () => {
      instance.currentTime = audio.currentTime;
      instance.isPlaying = !audio.paused && !audio.ended;
      this.notify('timeupdate', instance);
    });

    audio.addEventListener('ended', () => {
      instance.isPlaying = false;
      instance.isEnded = true;
      this.notify('ended', instance);
    });

    audio.addEventListener('error', () => {
      instance.isPlaying = false;
      instance.error = 'Failed to load audio stream.';
      this.notify('error', instance);
    });

    this.instances.set(instance.id, instance);
    this.currentActiveId = instance.id;
    return instance;
  }

  getPlaybackState(audioId) {
    const inst = this.getInstance(audioId);
    if (!inst || !inst.audio) return { isPlaying: false, currentTime: 0, duration: 30 };
    return {
      isPlaying: !inst.audio.paused && !inst.audio.ended,
      currentTime: inst.audio.currentTime || 0,
      duration: inst.audio.duration || inst.duration || 30,
      volume: inst.audio.volume ?? inst.volume
    };
  }

  pause(audioId) {
    const inst = this.getInstance(audioId);
    if (!inst) return { success: false, type: 'audio', message: 'No active audio found to pause.' };
    inst.audio.pause();
    inst.isPlaying = false;
    return { success: true, type: 'audio', audioId: inst.id, action: 'pause', message: `Paused "${inst.title}".` };
  }

  resume(audioId) {
    const inst = this.getInstance(audioId);
    if (!inst) return { success: false, type: 'audio', message: 'No active audio found to resume.' };
    // Stop other audios to prevent competing playback
    this.instances.forEach(other => {
      if (other.id !== inst.id && other.audio && !other.audio.paused) {
        try { other.audio.pause(); other.isPlaying = false; } catch {}
      }
    });
    this.currentActiveId = inst.id;
    inst.audio.play().catch(e => {
      inst.isPlaying = false;
      console.warn('Resume playback failed:', e);
    });
    return { success: true, type: 'audio', audioId: inst.id, action: 'resume', message: `Resumed "${inst.title}".` };
  }

  stop(audioId) {
    const inst = this.getInstance(audioId);
    if (!inst) return { success: false, type: 'audio', message: 'No active audio found to stop.' };
    inst.audio.pause();
    inst.audio.currentTime = 0;
    inst.currentTime = 0;
    inst.isPlaying = false;
    this.notify('stop', inst);
    return { success: true, type: 'audio', audioId: inst.id, action: 'stop', message: `Stopped "${inst.title}".` };
  }

  seek(audioId, seconds) {
    const inst = this.getInstance(audioId);
    if (!inst) return { success: false, type: 'audio', message: 'No active audio found to seek.' };
    const clamped = Math.max(0, Math.min(seconds, inst.duration || 300));
    inst.audio.currentTime = clamped;
    inst.currentTime = clamped;
    this.notify('timeupdate', inst);
    return { success: true, type: 'audio', audioId: inst.id, action: 'seek', time: clamped, message: `Seeked to ${clamped.toFixed(1)}s.` };
  }

  setVolume(audioId, volume) {
    const inst = this.getInstance(audioId);
    if (!inst) return { success: false, type: 'audio', message: 'No active audio found to adjust volume.' };
    const clamped = Math.max(0, Math.min(1.0, volume));
    inst.audio.volume = clamped;
    inst.volume = clamped;
    this.notify('volume', inst);
    return { success: true, type: 'audio', audioId: inst.id, action: 'volume', volume: clamped, message: `Volume set to ${Math.round(clamped * 100)}%.` };
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
}

export const AssistantAudioManager = new AssistantAudioService();
