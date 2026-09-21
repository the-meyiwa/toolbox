import { WebGLRenderer, WebGLRenderTarget, DepthTexture, NearestFilter, NoColorSpace, NoToneMapping,
  MeshNormalMaterial, MeshBasicMaterial, Color, DoubleSide, Scene, Mesh, PlaneGeometry,
  OrthographicCamera, CustomBlending, MaxEquation, OneFactor, SRGBColorSpace } from 'three';
import { createEdgeMaterial, TECHNICAL_SETTINGS } from './technical-edge-pass.js';

function target(depth = true) {
  const buffer = new WebGLRenderTarget(1,1, { minFilter: NearestFilter, magFilter: NearestFilter, depthBuffer: depth });
  buffer.texture.colorSpace = NoColorSpace;
  if (depth) buffer.depthTexture = new DepthTexture(1,1);
  return buffer;
}

export class TechnicalRenderer {
  constructor(canvas, { mobile = false, ...settings } = {}) {
    this.settings = { ...TECHNICAL_SETTINGS, ...settings };
    this.mobile = mobile;
    // Retain the last demand-rendered frame across browser/theme repaints. Pixel caps bound this buffer.
    this.renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NoToneMapping;
    this.renderer.autoClear = false;
    this.normal = target(); this.ids = target(); this.isolated = target(); this.hidden = target(false);
    this.normalMaterial = new MeshNormalMaterial({ side: DoubleSide });
    this.finalPass = createEdgeMaterial(this.settings);
    this.hiddenPass = createEdgeMaterial(this.settings, true);
    // Max blending bounds hidden line opacity even with many overlapping parts.
    Object.assign(this.hiddenPass, { blending: CustomBlending, blendEquation: MaxEquation, blendSrc: OneFactor, blendDst: OneFactor });
    this.quad = new Mesh(new PlaneGeometry(2,2), this.finalPass);
    this.screen = new Scene(); this.screen.add(this.quad); this.screenCamera = new OrthographicCamera(-1,1,1,-1,0,1);
    this.partMaterials = new Map();
  }
  resize(width, height, dpr = 1) {
    const limit = this.mobile ? this.settings.mobileMaxPixels : this.settings.maxPixels;
    const ratio = Math.min(dpr, this.mobile ? 1 : this.settings.maxPixelRatio, Math.sqrt(limit / Math.max(1,width*height)));
    const w = Math.max(1,Math.floor(width*ratio)), h = Math.max(1,Math.floor(height*ratio));
    this.renderer.setPixelRatio(1); this.renderer.setSize(w,h,false);
    for (const buffer of [this.normal,this.ids,this.isolated,this.hidden]) buffer.setSize(w,h);
    for (const pass of [this.finalPass,this.hiddenPass]) {
      pass.uniforms.texel.value.set(1/w,1/h);
      pass.uniforms.thickness.value = this.settings.lineThickness*ratio;
    }
  }
  resetParts() { for (const mat of this.partMaterials.values()) mat.dispose(); this.partMaterials.clear(); }
  render(scene, camera, registry, { mode = 'technical', selectedId = null, hoverId = null } = {}) {
    const renderer = this.renderer;
    const entries = registry.list();
    const meshes = entries.flatMap(entry => entry.meshes);
    const original = meshes.map(mesh => ({ mesh, material: mesh.material, visible: mesh.visible }));
    const selected = registry.get(selectedId)?.numericId || 0, hovered = registry.get(hoverId)?.numericId || 0;
    const originalBackground = scene.background;
    scene.background = null;
    renderer.setClearColor(0x000000,1);
    for (const pass of [this.finalPass,this.hiddenPass]) {
      pass.uniforms.nearPlane.value = camera.near; pass.uniforms.farPlane.value = camera.far;
      pass.uniforms.selectedId.value = selected; pass.uniforms.hoverId.value = hovered;
    }
    const renderGeometry = buffer => { renderer.setRenderTarget(buffer); renderer.clear(); renderer.render(scene,camera); };
    try {
      // Respect parts hidden by the viewer (layers, "hide part"); isolate narrows further.
      const shown = new Map(original.map(({ mesh, visible }) => [mesh, visible && (mode !== 'isolate' || !selected || registry.byMesh.get(mesh).numericId === selected)]));
      for (const mesh of meshes) mesh.visible = shown.get(mesh);
      for (const mesh of meshes) mesh.material = this.normalMaterial;
      renderGeometry(this.normal);
      for (const entry of entries) {
        let material = this.partMaterials.get(entry.numericId);
        if (!material) {
          const n = entry.numericId;
          material = new MeshBasicMaterial({ color: new Color().setRGB((n&255)/255,((n>>8)&255)/255,((n>>16)&255)/255), side: DoubleSide, toneMapped: false });
          this.partMaterials.set(n,material);
        }
        entry.meshes.forEach(mesh => { mesh.material = material; });
      }
      // No output transfer function in the ID target: exact 24-bit identities.
      renderGeometry(this.ids);
      renderer.setRenderTarget(this.hidden); renderer.clear();
      this.hiddenComponentLimit = this.mobile ? this.settings.mobileHiddenComponents : this.settings.maxHiddenComponents;
      if (mode === 'xray') {
        const selectedEntry = entries.find(entry => entry.numericId === selected);
        const rank = entry => (entry.numericId === selected ? 0 : entry.numericId === hovered ? 1 : selectedEntry && entry.layer && entry.layer === selectedEntry.layer ? 2 : 3);
        const candidates = entries.filter(entry => entry.meshes.some(mesh => shown.get(mesh)))
          .sort((a, b) => rank(a) - rank(b) || a.numericId - b.numericId).slice(0, this.hiddenComponentLimit);
        for (const mesh of meshes) { mesh.material = this.normalMaterial; mesh.visible = false; }
        for (const entry of candidates) {
          entry.meshes.forEach(mesh => { mesh.visible = shown.get(mesh); });
          renderGeometry(this.isolated);
          entry.meshes.forEach(mesh => { mesh.visible=false; });
          Object.assign(this.hiddenPass.uniforms.normals,{ value:this.isolated.texture });
          this.hiddenPass.uniforms.depths.value = this.isolated.depthTexture;
          this.hiddenPass.uniforms.fullDepth.value = this.normal.depthTexture;
          this.hiddenPass.uniforms.componentId.value = entry.numericId;
          this.quad.material = this.hiddenPass;
          renderer.setRenderTarget(this.hidden); renderer.render(this.screen,this.screenCamera);
        }
      }
      this.finalPass.uniforms.normals.value = this.normal.texture;
      this.finalPass.uniforms.depths.value = this.normal.depthTexture;
      this.finalPass.uniforms.ids.value = this.ids.texture;
      this.finalPass.uniforms.hiddenLines.value = this.hidden.texture;
      this.quad.material = this.finalPass;
      renderer.setRenderTarget(null); renderer.render(this.screen,this.screenCamera);
    } finally {
      original.forEach(({mesh,material,visible}) => { mesh.material=material;mesh.visible=visible; });
      scene.background=originalBackground;
      renderer.setRenderTarget(null);
    }
  }
  dispose() {
    this.resetParts();
    for (const buffer of [this.normal,this.ids,this.isolated,this.hidden]) { buffer.depthTexture?.dispose();buffer.dispose(); }
    this.normalMaterial.dispose();this.finalPass.dispose();this.hiddenPass.dispose();this.quad.geometry.dispose();
    this.renderer.dispose();this.renderer.forceContextLoss();
  }
}
