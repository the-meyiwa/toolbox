/* ============================================================
   Test DOM Environment Mock for Toolbox
   Provides complete mock browser globals, DOM tree, events,
   canvas 2D/WebGL, Web Audio, localStorage, and storage APIs.
   ============================================================ */

function createMockWebGLContext(canvas) {
  return {
    canvas,
    drawingBufferWidth: 800,
    drawingBufferHeight: 600,
    TEXTURE_2D: 0x0DE1,
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    FLOAT: 0x1406,
    COLOR_BUFFER_BIT: 0x00004000,
    DEPTH_BUFFER_BIT: 0x00000100,
    STENCIL_BUFFER_BIT: 0x00000400,
    VERTEX_SHADER: 0x8B31,
    FRAGMENT_SHADER: 0x8B30,
    COMPILE_STATUS: 0x8B81,
    LINK_STATUS: 0x8B82,
    ARRAY_BUFFER: 0x8892,
    ELEMENT_ARRAY_BUFFER: 0x8893,
    STATIC_DRAW: 0x88E4,
    DYNAMIC_DRAW: 0x88E8,
    TRIANGLES: 0x0004,
    DEPTH_TEST: 0x0B71,
    CULL_FACE: 0x0B44,
    BLEND: 0x0BE2,
    SCISSOR_TEST: 0x0C11,
    MAX_TEXTURE_SIZE: 4096,
    MAX_CUBE_MAP_TEXTURE_SIZE: 4096,
    MAX_RENDERBUFFER_SIZE: 4096,
    MAX_VERTEX_ATTRIBS: 16,
    MAX_VERTEX_UNIFORM_VECTORS: 1024,
    MAX_VARYING_VECTORS: 30,
    MAX_COMBINED_TEXTURE_IMAGE_UNITS: 32,
    MAX_VERTEX_TEXTURE_IMAGE_UNITS: 16,
    MAX_TEXTURE_IMAGE_UNITS: 16,
    MAX_FRAGMENT_UNIFORM_VECTORS: 1024,
    SHADING_LANGUAGE_VERSION: 0x8B8C,
    VENDOR: 0x1F00,
    RENDERER: 0x1F01,
    VERSION: 0x1F02,
    getExtension: () => null,
    getParameter: (param) => {
      if (param === 0x8B8C) return 'WebGL GLSL ES 1.0';
      if (param === 0x1F00) return 'WebKit';
      if (param === 0x1F01) return 'WebKit WebGL';
      if (param === 0x1F02) return 'WebGL 1.0';
      return 4096;
    },
    getShaderPrecisionFormat: () => ({ rangeMin: 127, rangeMax: 127, precision: 23 }),
    getContextAttributes: () => ({ alpha: true, depth: true, stencil: false, antialias: true }),
    createBuffer: () => ({}),
    bindBuffer: () => {},
    bufferData: () => {},
    bufferSubData: () => {},
    deleteBuffer: () => {},
    createTexture: () => ({}),
    bindTexture: () => {},
    texParameteri: () => {},
    texParameterf: () => {},
    texImage2D: () => {},
    texSubImage2D: () => {},
    deleteTexture: () => {},
    createFramebuffer: () => ({}),
    bindFramebuffer: () => {},
    framebufferTexture2D: () => {},
    deleteFramebuffer: () => {},
    createRenderbuffer: () => ({}),
    bindRenderbuffer: () => {},
    renderbufferStorage: () => {},
    deleteRenderbuffer: () => {},
    createProgram: () => ({}),
    deleteProgram: () => {},
    createShader: () => ({}),
    deleteShader: () => {},
    shaderSource: () => {},
    compileShader: () => {},
    getShaderParameter: () => true,
    getShaderInfoLog: () => '',
    attachShader: () => {},
    linkProgram: () => {},
    getProgramParameter: () => true,
    getProgramInfoLog: () => '',
    useProgram: () => {},
    getUniformLocation: (prog, name) => ({ name }),
    getAttribLocation: () => 0,
    enableVertexAttribArray: () => {},
    disableVertexAttribArray: () => {},
    vertexAttribPointer: () => {},
    uniform1i: () => {},
    uniform1f: () => {},
    uniform2f: () => {},
    uniform3f: () => {},
    uniform4f: () => {},
    uniform1fv: () => {},
    uniform2fv: () => {},
    uniform3fv: () => {},
    uniform4fv: () => {},
    uniformMatrix2fv: () => {},
    uniformMatrix3fv: () => {},
    uniformMatrix4fv: () => {},
    drawArrays: () => {},
    drawElements: () => {},
    enable: () => {},
    disable: () => {},
    depthFunc: () => {},
    depthMask: () => {},
    clearDepth: () => {},
    clearColor: () => {},
    clear: () => {},
    viewport: () => {},
    scissor: () => {},
    blendFunc: () => {},
    blendFuncSeparate: () => {},
    blendEquation: () => {},
    cullFace: () => {},
    frontFace: () => {},
    lineWidth: () => {},
    activeTexture: () => {},
    generateMipmap: () => {},
    clearStencil: () => {},
    colorMask: () => {},
    stencilMask: () => {},
    stencilFunc: () => {},
    stencilOp: () => {},
    polygonOffset: () => {},
    sampleCoverage: () => {},
    hint: () => {},
    isContextLost: () => false,
    texImage3D: () => {},
    texSubImage3D: () => {},
    texStorage2D: () => {},
    texStorage3D: () => {},
    createVertexArray: () => ({}),
    bindVertexArray: () => {},
    deleteVertexArray: () => {},
    drawBuffers: () => {},
    createQuery: () => ({}),
    deleteQuery: () => {},
    beginQuery: () => {},
    endQuery: () => {},
    getQueryParameter: () => true,
  };
}

class MockClassList {
  constructor(el) {
    this._el = el;
    this._classes = new Set();
  }
  add(...names) {
    for (const n of names) if (n) this._classes.add(n);
    this._sync();
  }
  remove(...names) {
    for (const n of names) this._classes.delete(n);
    this._sync();
  }
  toggle(name, force) {
    const has = this._classes.has(name);
    const next = force !== undefined ? Boolean(force) : !has;
    if (next) this._classes.add(name);
    else this._classes.delete(name);
    this._sync();
    return next;
  }
  contains(name) {
    return this._classes.has(name);
  }
  _sync() {
    this._el._attributes.set('class', Array.from(this._classes).join(' '));
  }
  _load(classStr) {
    this._classes.clear();
    if (classStr) {
      classStr.split(/\s+/).filter(Boolean).forEach(c => this._classes.add(c));
    }
  }
}

class MockNode {
  constructor() {
    this.childNodes = [];
    this.parentNode = null;
    this.parentElement = null;
  }

  get ownerDocument() { return globalThis.document || null; }
  getRootNode() { return globalThis.document || this; }
  get firstChild() { return this.childNodes[0] || null; }
  get lastChild() { return this.childNodes[this.childNodes.length - 1] || null; }
  get children() { return this.childNodes.filter(n => n instanceof MockElement); }

  get nextElementSibling() {
    if (!this.parentElement) return null;
    const siblings = this.parentElement.children;
    const idx = siblings.indexOf(this);
    return idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;
  }

  get previousElementSibling() {
    if (!this.parentElement) return null;
    const siblings = this.parentElement.children;
    const idx = siblings.indexOf(this);
    return idx > 0 ? siblings[idx - 1] : null;
  }

  contains(other) {
    let cur = other;
    while (cur) {
      if (cur === this) return true;
      cur = cur.parentNode;
    }
    return false;
  }

  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    this.childNodes.push(child);
    child.parentNode = this;
    child.parentElement = this instanceof MockElement ? this : null;
    if (child.tagName === 'SCRIPT' || child.tagName === 'LINK') {
      setTimeout(() => {
        try { child.onload?.({ target: child }); } catch {}
      }, 0);
    }
    return child;
  }

  removeChild(child) {
    const idx = this.childNodes.indexOf(child);
    if (idx !== -1) {
      this.childNodes.splice(idx, 1);
      child.parentNode = null;
      child.parentElement = null;
    }
    return child;
  }

  replaceChild(newChild, oldChild) {
    const idx = this.childNodes.indexOf(oldChild);
    if (idx !== -1) {
      if (newChild.parentNode) newChild.parentNode.removeChild(newChild);
      this.childNodes[idx] = newChild;
      newChild.parentNode = this;
      newChild.parentElement = this instanceof MockElement ? this : null;
      oldChild.parentNode = null;
      oldChild.parentElement = null;
    }
    return oldChild;
  }

  replaceWith(...nodes) {
    if (!this.parentElement) return;
    const parent = this.parentElement;
    const idx = parent.childNodes.indexOf(this);
    if (idx !== -1) {
      parent.childNodes.splice(idx, 1, ...nodes);
      this.parentNode = null;
      this.parentElement = null;
      for (const n of nodes) {
        if (n.parentNode) n.parentNode.removeChild(n);
        n.parentNode = parent;
        n.parentElement = parent;
      }
    }
  }

  prepend(...nodes) {
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (n.parentNode) n.parentNode.removeChild(n);
      this.childNodes.unshift(n);
      n.parentNode = this;
      n.parentElement = this instanceof MockElement ? this : null;
    }
  }

  remove() {
    if (this.parentNode) this.parentNode.removeChild(this);
  }
}

class MockElement extends MockNode {
  constructor(tagName = 'div') {
    super();
    this.tagName = tagName.toUpperCase();
    this.nodeName = this.tagName;
    this.nodeType = 1;
    this._attributes = new Map();
    this.classList = new MockClassList(this);
    this.dataset = {};
    this.style = {};
    this._listeners = new Map();
    this._value = '';
    this._checked = false;
    this._disabled = false;
    this.hidden = false;
  }

  get id() { return this.getAttribute('id') || ''; }
  set id(val) { this.setAttribute('id', val); }

  get className() { return this.getAttribute('class') || ''; }
  set className(val) {
    this.setAttribute('class', val);
    this.classList._load(val);
  }

  get value() {
    if (this.tagName === 'SELECT') {
      if (this._value) return this._value;
      const sel = this.selectedOptions[0];
      if (sel) return sel.getAttribute('value') ?? sel.textContent;
      return '';
    }
    return this._value;
  }
  set value(val) { this._value = String(val ?? ''); }

  get checked() { return this._checked; }
  set checked(val) { this._checked = Boolean(val); }

  select() {}
  setSelectionRange(start, end) {
    this.selectionStart = start;
    this.selectionEnd = end;
  }

  get options() {
    return this.querySelectorAll('option');
  }

  get selectedOptions() {
    const opts = this.options;
    const selected = opts.filter(o => o.hasAttribute('selected') || o.selected);
    return selected.length ? selected : (opts.length ? [opts[0]] : []);
  }

  get selectedIndex() {
    const opts = this.options;
    const sel = this.selectedOptions[0];
    return sel ? opts.indexOf(sel) : -1;
  }

  get textContent() {
    return this.childNodes.map(n => n.textContent ?? '').join('');
  }
  set textContent(val) {
    this.childNodes = [];
    this.appendChild(new MockTextNode(String(val ?? '')));
  }

  get innerText() { return this.textContent; }
  set innerText(val) { this.textContent = val; }

  get innerHTML() {
    return this._renderHTML();
  }
  set innerHTML(html) {
    this.childNodes = [];
    this._parseHTML(html);
  }

  setAttribute(name, value) {
    const val = String(value);
    this._attributes.set(name, val);
    if (name === 'class') this.classList._load(val);
    if (name.startsWith('data-')) {
      const prop = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.dataset[prop] = val;
    }
    if (name === 'value') this._value = val;
    if (name === 'checked') this._checked = true;
    if (name === 'disabled') this._disabled = true;
    if (name === 'hidden') this.hidden = true;
  }

  getAttribute(name) {
    return this._attributes.has(name) ? this._attributes.get(name) : null;
  }

  hasAttribute(name) {
    return this._attributes.has(name);
  }

  removeAttribute(name) {
    this._attributes.delete(name);
    if (name === 'class') this.classList._load('');
    if (name.startsWith('data-')) {
      const prop = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      delete this.dataset[prop];
    }
    if (name === 'checked') this._checked = false;
    if (name === 'disabled') this._disabled = false;
    if (name === 'hidden') this.hidden = false;
  }

  addEventListener(type, listener) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(listener);
  }

  removeEventListener(type, listener) {
    this._listeners.get(type)?.delete(listener);
  }

  dispatchEvent(event) {
    event.target = this;
    event.currentTarget = this;
    let node = this;
    while (node) {
      const listeners = node._listeners.get(event.type);
      if (listeners) {
        for (const fn of Array.from(listeners)) {
          try {
            fn.call(node, event);
          } catch (e) {
            console.error(`Error in event listener for ${event.type}:`, e);
          }
          if (event._stopPropagation) break;
        }
      }
      if (event._stopPropagation || !event.bubbles) break;
      node = node.parentElement;
    }
    return !event.defaultPrevented;
  }

  click() {
    this.dispatchEvent(new MockEvent('click', { bubbles: true, cancelable: true }));
  }

  focus() {
    this.dispatchEvent(new MockEvent('focus', { bubbles: false }));
  }

  blur() {
    this.dispatchEvent(new MockEvent('blur', { bubbles: false }));
  }

  getBoundingClientRect() {
    return { x: 0, y: 0, width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600 };
  }

  scrollIntoView() {}

  closest(selector) {
    let current = this;
    while (current) {
      if (current instanceof MockElement && current._matchesSelector(selector)) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  querySelector(selector) {
    const all = this.querySelectorAll(selector);
    return all[0] || null;
  }

  querySelectorAll(selector) {
    const results = [];
    const walk = (node) => {
      if (node instanceof MockElement) {
        if (node !== this && node._matchesSelector(selector)) {
          results.push(node);
        }
        for (const child of node.childNodes) walk(child);
      }
    };
    walk(this);
    return results;
  }

  getElementById(id) {
    return this.querySelector(`#${id}`);
  }

  getElementsByClassName(name) {
    return this.querySelectorAll(`.${name}`);
  }

  getElementsByTagName(name) {
    return this.querySelectorAll(name);
  }

  _matchesSelector(sel) {
    if (!sel) return false;
    sel = sel.trim();
    if (sel.includes(',')) {
      return sel.split(',').some(part => this._matchesSelector(part.trim()));
    }
    if (sel === '*') return true;
    const tagMatch = sel.match(/^([a-zA-Z0-9\-]+)/);
    if (tagMatch) {
      if (this.tagName.toLowerCase() !== tagMatch[1].toLowerCase()) return false;
      sel = sel.slice(tagMatch[1].length).trim();
      if (!sel) return true;
    }
    if (sel.startsWith('#')) return this.id === sel.slice(1);
    if (sel.startsWith('.')) {
      const parts = sel.split('.').filter(Boolean);
      return parts.every(c => this.classList.contains(c));
    }
    if (sel.startsWith('[') && sel.endsWith(']')) {
      const inner = sel.slice(1, -1);
      const [attr, val] = inner.split('=');
      if (!val) return this.hasAttribute(attr);
      const cleanVal = val.replace(/^["']|["']$/g, '');
      return this.getAttribute(attr) === cleanVal;
    }
    return this.tagName.toLowerCase() === sel.toLowerCase();
  }

  _renderHTML() {
    let out = '';
    for (const child of this.childNodes) {
      if (child instanceof MockTextNode) {
        out += child.textContent;
      } else if (child instanceof MockElement) {
        const tag = child.tagName.toLowerCase();
        let attrs = '';
        for (const [k, v] of child._attributes) {
          attrs += ` ${k}="${String(v).replace(/"/g, '&quot;')}"`;
        }
        out += `<${tag}${attrs}>${child.innerHTML}</${tag}>`;
      }
    }
    return out;
  }

  _parseHTML(html) {
    if (!html) return;
    const voidTags = new Set([
      'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'
    ]);
    const tokenRegex = /<!--[\s\S]*?-->|<!DOCTYPE[^>]*>|<(\/)?([a-zA-Z0-9\-]+)([^>]*)>|([^<]+)/gi;
    const stack = [this];
    let match;
    while ((match = tokenRegex.exec(html)) !== null) {
      if (match[4]) {
        const current = stack[stack.length - 1];
        if (current) current.appendChild(new MockTextNode(match[4]));
      } else if (match[2]) {
        const isClosing = Boolean(match[1]);
        const tagName = match[2].toLowerCase();
        const attrStr = match[3] || '';
        const isSelfClosing = attrStr.trim().endsWith('/') || voidTags.has(tagName);

        if (isClosing) {
          for (let i = stack.length - 1; i > 0; i--) {
            if (stack[i].tagName && stack[i].tagName.toLowerCase() === tagName) {
              stack.length = i;
              break;
            }
          }
        } else {
          const el = new MockElement(tagName);
          this._parseAttrs(el, attrStr);
          const current = stack[stack.length - 1];
          if (current) current.appendChild(el);
          if (!isSelfClosing) {
            stack.push(el);
          }
        }
      }
    }
  }

  _parseAttrs(el, attrStr) {
    if (!attrStr) return;
    const attrRegex = /([a-zA-Z0-9\-_:@]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    let m;
    while ((m = attrRegex.exec(attrStr)) !== null) {
      const name = m[1];
      const val = m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : ''));
      el.setAttribute(name, val);
    }
  }

  getContext(type) {
    if (type === '2d') {
      return {
        canvas: this,
        fillStyle: '#000',
        strokeStyle: '#000',
        lineWidth: 1,
        font: '10px sans-serif',
        fillRect: () => {},
        clearRect: () => {},
        strokeRect: () => {},
        beginPath: () => {},
        closePath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        arc: () => {},
        fill: () => {},
        stroke: () => {},
        fillText: () => {},
        strokeText: () => {},
        measureText: (text) => ({ width: (text || '').length * 8 }),
        drawImage: () => {},
        getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
        putImageData: () => {},
        createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
        save: () => {},
        restore: () => {},
        scale: () => {},
        rotate: () => {},
        translate: () => {},
        transform: () => {},
        setTransform: () => {},
        resetTransform: () => {},
      };
    }
    if (type === 'webgl' || type === 'webgl2') {
      return createMockWebGLContext(this);
    }
    return null;
  }

  toDataURL() {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  }

  toBlob(callback, type = 'image/png') {
    callback(new Blob([], { type }));
  }
}

class MockTextNode extends MockNode {
  constructor(text = '') {
    super();
    this.textContent = String(text);
    this.nodeType = 3;
    this.nodeName = '#text';
  }
}

class MockEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.bubbles = Boolean(options.bubbles);
    this.cancelable = Boolean(options.cancelable);
    this.defaultPrevented = false;
    this.target = null;
    this.currentTarget = null;
    this._stopPropagation = false;
    Object.assign(this, options);
  }
  preventDefault() {
    if (this.cancelable) this.defaultPrevented = true;
  }
  stopPropagation() {
    this._stopPropagation = true;
  }
}

class MockCustomEvent extends MockEvent {
  constructor(type, options = {}) {
    super(type, options);
    this.detail = options.detail ?? null;
  }
}

class MockMouseEvent extends MockEvent {
  constructor(type, options = {}) {
    super(type, options);
    this.clientX = options.clientX ?? 0;
    this.clientY = options.clientY ?? 0;
    this.button = options.button ?? 0;
    this.buttons = options.buttons ?? 0;
  }
}

class MockKeyboardEvent extends MockEvent {
  constructor(type, options = {}) {
    super(type, options);
    this.key = options.key ?? '';
    this.code = options.code ?? '';
    this.ctrlKey = Boolean(options.ctrlKey);
    this.metaKey = Boolean(options.metaKey);
    this.shiftKey = Boolean(options.shiftKey);
    this.altKey = Boolean(options.altKey);
  }
}

class MockDocument extends MockElement {
  constructor() {
    super('#document');
    this.nodeType = 9;
    this.body = new MockElement('body');
    this.head = new MockElement('head');
    this.documentElement = new MockElement('html');
    this.documentElement.appendChild(this.head);
    this.documentElement.appendChild(this.body);
    this.appendChild(this.documentElement);
  }

  createElement(tagName) {
    return new MockElement(tagName);
  }

  createElementNS(ns, tagName) {
    const el = new MockElement(tagName);
    el.namespaceURI = ns;
    return el;
  }

  createTextNode(text) {
    return new MockTextNode(text);
  }

  createDocumentFragment() {
    const frag = new MockNode();
    frag.nodeType = 11;
    return frag;
  }

  getElementById(id) {
    return this.documentElement.querySelector(`#${id}`);
  }

  querySelector(sel) {
    return this.documentElement.querySelector(sel);
  }

  querySelectorAll(sel) {
    return this.documentElement.querySelectorAll(sel);
  }
}

class MockStorage {
  constructor() {
    this._store = new Map();
  }
  getItem(key) {
    return this._store.has(key) ? this._store.get(key) : null;
  }
  setItem(key, value) {
    this._store.set(key, String(value));
  }
  removeItem(key) {
    this._store.delete(key);
  }
  clear() {
    this._store.clear();
  }
  key(index) {
    return Array.from(this._store.keys())[index] || null;
  }
  get length() {
    return this._store.size;
  }
}

class MockAudioContext {
  constructor() {
    this.state = 'running';
    this.currentTime = 0;
    this.destination = {};
    this.sampleRate = 44100;
  }
  createOscillator() {
    return {
      type: 'sine',
      frequency: { value: 440, setValueAtTime: () => {} },
      connect: () => {},
      disconnect: () => {},
      start: () => {},
      stop: () => {},
    };
  }
  createGain() {
    return {
      gain: { value: 1, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
      connect: () => {},
      disconnect: () => {},
    };
  }
  createAnalyser() {
    return {
      fftSize: 2048,
      frequencyBinCount: 1024,
      getByteFrequencyData: () => {},
      getFloatTimeDomainData: (arr) => arr.fill(0),
      connect: () => {},
      disconnect: () => {},
    };
  }
  createMediaStreamSource() {
    return { connect: () => {}, disconnect: () => {} };
  }
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
}

export function setupDOMEnvironment() {
  const doc = new MockDocument();
  const storage = new MockStorage();

  const win = {
    document: doc,
    localStorage: storage,
    sessionStorage: new MockStorage(),
    location: {
      hash: '',
      href: 'http://localhost:3000/',
      pathname: '/',
      search: '',
      replace: function(h) { this.hash = h; },
    },
    navigator: {
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ToolboxTesting/1.0',
      clipboard: {
        writeText: (t) => Promise.resolve(t),
        readText: () => Promise.resolve(''),
      },
      mediaDevices: {
        getUserMedia: () => Promise.resolve({ getTracks: () => [] }),
      },
    },
    history: {
      pushState: () => {},
      replaceState: () => {},
    },
    addEventListener: (type, fn) => doc.addEventListener(type, fn),
    removeEventListener: (type, fn) => doc.removeEventListener(type, fn),
    dispatchEvent: (e) => doc.dispatchEvent(e),
    requestAnimationFrame: (cb) => setTimeout(cb, 16),
    cancelAnimationFrame: (id) => clearTimeout(id),
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    HTMLElement: MockElement,
    Element: MockElement,
    Node: MockNode,
    Event: MockEvent,
    CustomEvent: MockCustomEvent,
    MouseEvent: MockMouseEvent,
    KeyboardEvent: MockKeyboardEvent,
    AudioContext: MockAudioContext,
    webkitAudioContext: MockAudioContext,
    URL: globalThis.URL,
    URLSearchParams: globalThis.URLSearchParams,
    Blob: globalThis.Blob,
    File: globalThis.File || class extends Blob {},
    FileReader: class {
      readAsText(blob) { setTimeout(() => { this.result = ''; this.onload?.({ target: this }); }, 0); }
      readAsDataURL(blob) { setTimeout(() => { this.result = 'data:application/octet-stream;base64,'; this.onload?.({ target: this }); }, 0); }
      readAsArrayBuffer(blob) { setTimeout(() => { this.result = new ArrayBuffer(0); this.onload?.({ target: this }); }, 0); }
    },
    ResizeObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    IntersectionObserver: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
    Image: class extends MockElement {
      constructor() {
        super('img');
        setTimeout(() => this.onload?.(), 0);
      }
    },
  };

  function defineGlobal(name, val) {
    try {
      globalThis[name] = val;
    } catch {
      try {
        Object.defineProperty(globalThis, name, {
          value: val,
          configurable: true,
          writable: true,
        });
      } catch {}
    }
  }

  defineGlobal('window', win);
  defineGlobal('document', doc);
  defineGlobal('localStorage', storage);
  defineGlobal('sessionStorage', win.sessionStorage);
  defineGlobal('location', win.location);
  defineGlobal('navigator', win.navigator);
  defineGlobal('HTMLElement', MockElement);
  defineGlobal('Element', MockElement);
  defineGlobal('Node', MockNode);
  defineGlobal('Event', MockEvent);
  defineGlobal('CustomEvent', MockCustomEvent);
  defineGlobal('MouseEvent', MockMouseEvent);
  defineGlobal('KeyboardEvent', MockKeyboardEvent);
  defineGlobal('AudioContext', MockAudioContext);
  defineGlobal('webkitAudioContext', MockAudioContext);
  defineGlobal('ResizeObserver', win.ResizeObserver);
  defineGlobal('IntersectionObserver', win.IntersectionObserver);
  defineGlobal('requestAnimationFrame', win.requestAnimationFrame);
  defineGlobal('cancelAnimationFrame', win.cancelAnimationFrame);
  defineGlobal('matchMedia', win.matchMedia);

  const mockL = {
    map: () => ({
      setView: function() { return this; },
      on: function() { return this; },
      remove: function() { return this; },
      addLayer: function() { return this; },
    }),
    tileLayer: () => ({
      addTo: function() { return this; },
    }),
    marker: () => ({
      addTo: function() { return this; },
      bindPopup: function() { return { openPopup: () => {} }; },
    }),
    icon: () => ({}),
  };
  defineGlobal('L', mockL);

  const mockMermaid = {
    initialize: () => {},
    render: () => Promise.resolve({ svg: '<svg></svg>' }),
  };
  defineGlobal('mermaid', mockMermaid);

  return { window: win, document: doc, localStorage: storage };
}
