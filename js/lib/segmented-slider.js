/* ============================================================
   TOOLBOX — Segmented Switcher Slider Animation Engine
   Provides smooth, hardware-accelerated gliding highlight pill
   animations across segmented tab switchers and mode selectors.
   ============================================================ */

/**
 * Attaches a smooth sliding indicator pill to a segmented switcher container.
 * @param {HTMLElement} container - The wrapper element containing switcher buttons
 * @param {string} buttonSelector - CSS selector for the switcher option buttons
 * @param {string} activeClass - Class name indicating the active item (default: 'active')
 * @returns {() => void} update - Function to manually trigger repositioning
 */
export function attachSegmentedSlider(container, buttonSelector = 'button', activeClass = 'active') {
  if (!container || !container.querySelector) return () => {};

  container.style.position = 'relative';

  // Ensure an indicator element exists inside container
  let slider = container.querySelector('.segmented-slider-pill');
  if (!slider) {
    slider = document.createElement('div');
    slider.className = 'segmented-slider-pill';
    slider.setAttribute('aria-hidden', 'true');
    slider.style.cssText = `
      position: absolute;
      top: 2px;
      left: 0;
      border-radius: inherit;
      background: var(--bg-card, #ffffff);
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
      pointer-events: none;
      z-index: 0;
      transition: transform 0.22s cubic-bezier(0.2, 0.85, 0.2, 1), width 0.22s cubic-bezier(0.2, 0.85, 0.2, 1), opacity 0.15s ease;
      opacity: 0;
    `;
    if (typeof container.insertBefore === 'function') {
      container.insertBefore(slider, container.firstChild);
    } else if (typeof container.prepend === 'function') {
      container.prepend(slider);
    } else if (typeof container.appendChild === 'function') {
      container.appendChild(slider);
    }
  }

  const buttons = container.querySelectorAll(buttonSelector);
  buttons.forEach(btn => {
    btn.style.position = 'relative';
    btn.style.zIndex = '1';
    btn.style.transition = 'color 0.15s ease';
  });

  const update = () => {
    const activeBtn = container.querySelector(`${buttonSelector}.${activeClass}`) || buttons[0];
    if (!activeBtn || activeBtn.offsetParent === null) {
      slider.style.opacity = '0';
      return;
    }

    const w = activeBtn.offsetWidth || 0;
    const h = activeBtn.offsetHeight || 0;
    const x = activeBtn.offsetLeft || 0;
    const y = activeBtn.offsetTop || 0;

    slider.style.opacity = '1';
    slider.style.transform = `translate3d(${x}px, 0, 0)`;
    if (w > 0) slider.style.width = `${w}px`;
    if (h > 0) slider.style.height = `${h}px`;
    slider.style.top = `${y}px`;

    const btnRadius = activeBtn.style?.borderRadius || window.getComputedStyle?.(activeBtn)?.borderRadius;
    if (btnRadius) slider.style.borderRadius = btnRadius;
  };

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      setTimeout(update, 10);
    });
  });

  if (typeof ResizeObserver !== 'undefined') {
    try {
      const ro = new ResizeObserver(update);
      ro.observe(container);
    } catch {}
  }

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(update);
  }
  setTimeout(update, 50);

  return update;
}
