/* Motion explains the settings hierarchy: section, surface, then control.
 * Every transition is cancellable; rapid navigation never queues old entrances.
 */
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const RECIPES = {
  appearance: { selector: '.stg-section-head, .theme-option', kind: 'swatch', step: 42 },
  profile: { selector: '.stg-identity, .stg-hero, .stg-section', kind: 'surface', step: 38 },
  avatars: { selector: '.stg-avatar-intro, .avatar-story-card', kind: 'portrait', step: 22 },
  tools: { selector: '.stg-lede, .tp-card', kind: 'surface', step: 32 },
  assistant: { selector: '.stg-section, .stg-persona-card, .stg-memory', kind: 'surface', step: 34 },
  notifications: { selector: '.stg-section-head, .stg-card', kind: 'control', step: 30 },
  general: { selector: '.stg-section-head, .stg-card', kind: 'control', step: 30 },
  mail: { selector: '.stg-section, .mail-account-card', kind: 'surface', step: 34 },
  support: { selector: '.stg-support > *', kind: 'surface', step: 36 },
};

export function settingsMotionPlan(page, direction = 0, { narrow = false, reduced = false } = {}) {
  const recipe = RECIPES[page] || RECIPES.general;
  // Mobile already has a spatial page push; its content only settles in place.
  const y = narrow ? 0 : direction < 0 ? -8 : 8;
  const scale = !narrow && ['swatch', 'portrait'].includes(recipe.kind) ? .975 : 1;
  return {
    ...recipe, enabled: !reduced, duration: narrow ? 180 : 340, maxDelay: narrow ? 0 : 126,
    keyframes: [{ opacity: .25, transform: `translateY(${y}px) scale(${scale})` }, { opacity: 1, transform: 'none' }],
    easing: EASE,
  };
}

export function animateSettingsPanel(panel, direction, { narrow = false, reduced = false } = {}) {
  const plan = settingsMotionPlan(panel?.dataset?.settingsPanel, direction, { narrow, reduced });
  if (!panel || !plan.enabled) return () => {};
  const scroll = panel.closest('.stg-scroll');
  const bounds = scroll?.getBoundingClientRect();
  const candidates = [...panel.querySelectorAll(plan.selector)];
  // Animate each visual unit once; nested surfaces do not multiply the movement.
  const nodes = candidates.filter(node => !candidates.some(parent => parent !== node && parent.contains(node)))
    .filter(node => {
      if (!bounds) return true;
      const rect = node.getBoundingClientRect();
      return rect.bottom >= bounds.top && rect.top <= bounds.bottom;
    }).slice(0, 14);
  if (!nodes.length) nodes.push(panel);
  const animations = nodes.flatMap((node, i) => {
    if (typeof node.animate !== 'function') return [];
    const animation = node.animate(plan.keyframes, {
      duration: plan.duration, delay: Math.min(i * plan.step, plan.maxDelay), easing: plan.easing, fill: 'backwards',
    });
    return [animation];
  });
  const preference = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const cancel = () => {
    animations.forEach(animation => animation.cancel());
    preference?.removeEventListener?.('change', onPreference);
  };
  const onPreference = event => { if (event.matches) cancel(); };
  preference?.addEventListener?.('change', onPreference);
  Promise.allSettled(animations.map(animation => animation.finished)).then(() => preference?.removeEventListener?.('change', onPreference));
  return cancel;
}
