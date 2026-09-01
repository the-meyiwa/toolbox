/**
 * TOOLBOX ASSISTANT — Result Presentation Framework
 *
 * Unified system for rendering tool results in conversations.
 * Supports: result-only, interactive cards, workspace operations, and previews.
 *
 * Each renderer is responsible for:
 * 1. Determining if it can render a given result
 * 2. Rendering serialized state to DOM
 * 3. Binding event listeners for interactivity
 * 4. Reconstructing runtime resources (Audio, WebGL, etc.)
 * 5. Cleaning up resources
 */

/**
 * Base Result Renderer — extend this to create new renderers
 */
export class ResultRenderer {
  /**
   * Unique identifier for this renderer
   */
  static id = null;

  /**
   * Human-readable name
   */
  static name = null;

  /**
   * Check if this renderer can handle the given result
   */
  static canRender(result) {
    return false;
  }

  /**
   * Render the result to DOM
   *
   * @param {ToolResult} result - Serialized tool result
   * @param {HTMLElement} container - Where to render
   * @returns {HTMLElement} The rendered element
   */
  static render(result, container) {
    throw new Error('render() not implemented');
  }

  /**
   * Bind event listeners for interactivity
   * Called after render()
   */
  static bindInteractions(result, container) {
    // Override if needed
  }

  /**
   * Reconstruct runtime resources (Audio, WebGL, etc.) from serialized state
   * Called when result becomes interactive or visible
   */
  static async reconstruct(result) {
    // Override if needed
    return result;
  }

  /**
   * Clean up resources (revoke URLs, stop audio, etc.)
   * Called when result is hidden/removed
   */
  static async cleanup(result) {
    // Override if needed
  }
}

/**
 * TEXT RESULT — Simple text/markdown output
 */
export class TextResultRenderer extends ResultRenderer {
  static id = 'text';
  static name = 'Text Output';

  static canRender(result) {
    return result.type === 'result';
  }

  static render(result, container) {
    const el = document.createElement('div');
    el.className = 'assistant-result-text';
    el.textContent = typeof result.data === 'string' ? result.data : (result.data?.message || JSON.stringify(result.data));
    container.appendChild(el);
    return el;
  }
}

/**
 * CODE RESULT — Code output with syntax highlighting
 */
export class CodeResultRenderer extends ResultRenderer {
  static id = 'code';
  static name = 'Code';

  static canRender(result) {
    return result.renderer === 'code' || (result.data?.code && result.data?.language);
  }

  static render(result, container) {
    const el = document.createElement('pre');
    el.className = 'assistant-result-code';

    const code = document.createElement('code');
    code.className = `language-${result.data.language || 'plaintext'}`;
    code.textContent = result.data.code;
    el.appendChild(code);

    container.appendChild(el);
    return el;
  }
}

/**
 * JSON RESULT — Pretty-printed JSON with copy button
 */
export class JsonResultRenderer extends ResultRenderer {
  static id = 'json';
  static name = 'JSON';

  static canRender(result) {
    return result.data?.json !== undefined || result.data?.isJson;
  }

  static render(result, container) {
    const el = document.createElement('div');
    el.className = 'assistant-result-json';

    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(result.data.json || result.data, null, 2);
    el.appendChild(pre);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'assistant-result-copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(pre.textContent);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => copyBtn.textContent = 'Copy', 2000);
    });
    el.appendChild(copyBtn);

    container.appendChild(el);
    return el;
  }
}

/**
 * TABLE RESULT — Structured table/grid output
 */
export class TableResultRenderer extends ResultRenderer {
  static id = 'table';
  static name = 'Table';

  static canRender(result) {
    return result.renderer === 'table' || result.data?.rows;
  }

  static render(result, container) {
    const el = document.createElement('div');
    el.className = 'assistant-result-table';

    const table = document.createElement('table');
    const { rows, columns } = result.data;

    // Header
    if (columns?.length) {
      const thead = document.createElement('thead');
      const tr = document.createElement('tr');
      columns.forEach(col => {
        const th = document.createElement('th');
        th.textContent = col.label || col;
        tr.appendChild(th);
      });
      thead.appendChild(tr);
      table.appendChild(thead);
    }

    // Body
    const tbody = document.createElement('tbody');
    (rows || []).forEach(row => {
      const tr = document.createElement('tr');
      (Array.isArray(row) ? row : Object.values(row)).forEach(cell => {
        const td = document.createElement('td');
        td.textContent = cell;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    el.appendChild(table);
    container.appendChild(el);
    return el;
  }
}

/**
 * ERROR RESULT — Red error message
 */
export class ErrorResultRenderer extends ResultRenderer {
  static id = 'error';
  static name = 'Error';

  static canRender(result) {
    return !result.success || result.error;
  }

  static render(result, container) {
    const el = document.createElement('div');
    el.className = 'assistant-result-error';
    el.textContent = result.error || 'Operation failed';
    container.appendChild(el);
    return el;
  }
}

/**
 * AUDIO PLAYER RESULT — Interactive audio with play/pause/seek
 */
export class AudioPlayerResultRenderer extends ResultRenderer {
  static id = 'audio-player';
  static name = 'Audio Player';

  static canRender(result) {
    return result.renderer === 'audio-player' || (result.data?.url && result.data?.audioId);
  }

  static render(result, container) {
    const data = result.data;
    const el = document.createElement('div');
    el.className = 'assistant-result-audio-player';
    el.setAttribute('data-audio-id', data.audioId);
    el.style.cssText = 'margin-top:8px; padding:14px; background:var(--white); border:1px solid var(--g300); border-radius:14px; box-shadow:0 2px 8px rgba(0,0,0,.05);';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; align-items:center; gap:10px; margin-bottom:12px; min-width:0;';
    if (data.artworkUrl) {
      const artwork = document.createElement('img');
      artwork.src = data.artworkUrl;
      artwork.alt = '';
      artwork.style.cssText = 'width:40px; height:40px; border-radius:9px; object-fit:cover; flex:0 0 auto;';
      header.appendChild(artwork);
    }
    const labels = document.createElement('div');
    labels.style.cssText = 'min-width:0; flex:1;';
    const title = document.createElement('div');
    title.className = 'audio-player-title';
    title.textContent = data.title || 'Audio';
    title.style.cssText = 'font-weight:750; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
    const artist = document.createElement('div');
    artist.textContent = data.artist || 'Toolbox Audio';
    artist.style.cssText = 'font-size:.76rem; color:var(--g600); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;';
    labels.append(title, artist);
    header.appendChild(labels);
    el.appendChild(header);

    // Controls
    const controls = document.createElement('div');
    controls.className = 'audio-player-controls';
    controls.style.cssText = 'display:flex; flex-wrap:wrap; align-items:center; gap:8px;';

    const playBtn = document.createElement('button');
    playBtn.className = 'audio-btn audio-btn-play';
    playBtn.setAttribute('data-action', 'play');
    playBtn.textContent = 'Play';
    playBtn.style.cssText = 'border:0; border-radius:8px; padding:7px 10px; background:var(--black); color:var(--white); font-weight:700; cursor:pointer;';
    controls.appendChild(playBtn);

    const pauseBtn = document.createElement('button');
    pauseBtn.className = 'audio-btn audio-btn-pause';
    pauseBtn.setAttribute('data-action', 'pause');
    pauseBtn.textContent = 'Pause';
    pauseBtn.style.cssText = 'border:1px solid var(--g300); border-radius:8px; padding:7px 10px; background:var(--white); cursor:pointer;';
    controls.appendChild(pauseBtn);

    const stopBtn = document.createElement('button');
    stopBtn.className = 'audio-btn audio-btn-stop';
    stopBtn.setAttribute('data-action', 'stop');
    stopBtn.textContent = 'Stop';
    stopBtn.style.cssText = 'border:1px solid var(--g300); border-radius:8px; padding:7px 10px; background:var(--white); color:#b91c1c; cursor:pointer;';
    controls.appendChild(stopBtn);

    // Progress
    const progress = document.createElement('input');
    progress.type = 'range';
    progress.className = 'audio-player-progress';
    progress.min = 0;
    progress.max = data.duration || 100;
    progress.value = result.state?.currentTime || 0;
    progress.style.cssText = 'flex:1 1 140px; min-width:120px; accent-color:var(--black);';
    controls.appendChild(progress);

    // Volume
    const volume = document.createElement('input');
    volume.type = 'range';
    volume.className = 'audio-player-volume';
    volume.min = 0;
    volume.max = 100;
    volume.value = result.state?.volume ?? 100;
    volume.title = 'Volume';
    volume.style.cssText = 'width:76px; accent-color:var(--black);';
    controls.appendChild(volume);

    el.appendChild(controls);
    container.appendChild(el);

    // Store result ref for event handlers
    el.setAttribute('data-result-id', result.toolCallId);
    el.resultData = result;

    return el;
  }

  static bindInteractions(result, container) {
    const playerEl = container.querySelector(
      `[data-audio-id="${result.data.audioId}"]`
    );
    if (!playerEl) return;

    playerEl.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.getAttribute('data-action');
      try {
        // Import audio manager and execute action
        // This is done at the message level, not here
        window.dispatchEvent(new CustomEvent('assistant:audio-action', {
          detail: {
            audioId: result.data.audioId,
            action,
            toolCallId: result.toolCallId
          }
        }));
      } catch (err) {
        console.error('Audio action failed:', err);
      }
    });
  }

  static async reconstruct(result) {
    // Nothing extra needed for audio — the URL is preserved
    return result;
  }

  static async cleanup(result) {
    // Revoke blob URL if present
    if (result.data?.url?.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(result.data.url);
      } catch {}
    }
  }
}

/** SANDBOX RESULT — readable output from an executed code snippet. */
export class SandboxResultRenderer extends ResultRenderer {
  static id = 'sandbox-output';
  static name = 'Code Execution Output';

  static canRender(result) {
    return result.renderer === 'sandbox-output' ||
      (result.data?.language && Object.hasOwn(result.data, 'output'));
  }

  static render(result, container) {
    const data = result.data;
    const el = document.createElement('section');
    el.className = 'assistant-result-sandbox-output';
    el.style.cssText = 'margin-top:8px; overflow:hidden; border:1px solid var(--g300); border-radius:12px; background:#111827; color:#e5e7eb;';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; gap:12px; padding:8px 12px; background:#1f2937; font-size:.75rem;';
    const label = document.createElement('strong');
    label.textContent = `${data.language || 'Code'} output`;
    const duration = document.createElement('span');
    duration.textContent = data.executionTimeMs ? `${data.executionTimeMs} ms` : 'Completed';
    duration.style.color = '#9ca3af';
    header.append(label, duration);

    const output = document.createElement('pre');
    output.style.cssText = 'margin:0; padding:12px; overflow:auto; white-space:pre-wrap; font:12px/1.55 var(--mono, ui-monospace, monospace);';
    output.textContent = data.error || data.output || 'No output returned.';
    el.append(header, output);
    container.appendChild(el);
    return el;
  }
}

export class SpeedTestResultRenderer extends ResultRenderer {
  static id = 'speed-test';
  static name = 'Speed Test';
  static canRender(result) { return result.renderer === 'speed-test' || typeof result.data?.downloadSpeedMbps !== 'undefined'; }
  static render(result, container) {
    const data = result.data;
    const el = document.createElement('section');
    el.className = 'assistant-result-speed-test';
    el.style.cssText = 'margin-top:8px; padding:14px; border:1px solid var(--g300); border-radius:14px; background:var(--white);';
    const header = document.createElement('div');
    header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:12px;';
    const title = document.createElement('strong');
    title.textContent = 'Network Speed Test';
    const location = document.createElement('span');
    location.textContent = data.city || data.country || 'Online';
    location.style.cssText = 'font-size:.75rem; color:var(--g600);';
    header.append(title, location);
    const metrics = document.createElement('div');
    metrics.style.cssText = 'display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:8px;';
    for (const [label, value, unit] of [
      ['Download', data.downloadSpeedMbps, 'Mbps'],
      ['Latency', data.latencyMs, 'ms'],
      ['Jitter', data.jitterMs, 'ms']
    ]) {
      const metric = document.createElement('div');
      metric.style.cssText = 'padding:9px 8px; border:1px solid var(--g200); border-radius:9px; background:var(--g50); text-align:center;';
      const name = document.createElement('div');
      name.textContent = label;
      name.style.cssText = 'font-size:.65rem; color:var(--g600); font-weight:700; text-transform:uppercase;';
      const number = document.createElement('div');
      number.textContent = `${value ?? '—'} ${unit}`;
      number.style.cssText = 'margin-top:3px; font:700 1rem var(--mono, ui-monospace, monospace);';
      metric.append(name, number);
      metrics.appendChild(metric);
    }
    const footer = document.createElement('div');
    footer.textContent = [data.isp, data.ip, data.verdict].filter(Boolean).join(' · ');
    footer.style.cssText = 'margin-top:10px; font-size:.75rem; color:var(--g600);';
    el.append(header, metrics, footer);
    container.appendChild(el);
    return el;
  }
}

/**
 * CHART RESULT — Data visualization (charts, graphs)
 */
export class ChartResultRenderer extends ResultRenderer {
  static id = 'chart';
  static name = 'Chart';

  static canRender(result) {
    return result.renderer === 'chart' || result.data?.chart;
  }

  static render(result, container) {
    const el = document.createElement('div');
    el.className = 'assistant-result-chart';

    // For now, just render JSON representation
    // Real implementation would use Chart.js or similar
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(result.data, null, 2);
    el.appendChild(pre);

    container.appendChild(el);
    return el;
  }
}

/**
 * REGISTRY — Maps renderer types to renderer classes
 */
export const RESULT_RENDERERS = [
  AudioPlayerResultRenderer,
  SandboxResultRenderer,
  SpeedTestResultRenderer,
  ErrorResultRenderer,
  JsonResultRenderer,
  CodeResultRenderer,
  TableResultRenderer,
  ChartResultRenderer,
  TextResultRenderer
];

/**
 * Find appropriate renderer for a result
 */
export function selectRenderer(result) {
  for (const Renderer of RESULT_RENDERERS) {
    if (Renderer.canRender(result)) {
      return Renderer;
    }
  }
  return TextResultRenderer; // default fallback
}

/**
 * Render a tool result to DOM
 */
export async function renderToolResult(result, container) {
  try {
    // Handle errors specially
    if (!result.success) {
      ErrorResultRenderer.render(result, container);
      return;
    }

    const Renderer = selectRenderer(result);

    // Reconstruct if interactive
    if (result.type === 'interactive') {
      result = await Renderer.reconstruct(result);
    }

    // Render to DOM
    const el = Renderer.render(result, container);

    // Bind interactions
    if (result.type === 'interactive') {
      Renderer.bindInteractions(result, container);
    }

    return el;
  } catch (err) {
    console.error('Failed to render result:', err);
    ErrorResultRenderer.render({
      success: false,
      error: `Failed to render result: ${err.message}`
    }, container);
  }
}

/**
 * Clean up a rendered result
 */
export async function cleanupToolResult(result, container) {
  try {
    const Renderer = selectRenderer(result);
    await Renderer.cleanup(result);
  } catch (err) {
    console.error('Failed to cleanup result:', err);
  }
}
