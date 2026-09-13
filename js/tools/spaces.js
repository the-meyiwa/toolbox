/* ============================================================
   TOOLBOX — Work Spaces Tool
   Organize active projects, tools, notes, files, and live sessions
   in dedicated work spaces.
   ============================================================ */

import { renderSpaces } from '../views/spaces.js';

export default {
  _unmount: null,

  render(container) {
    this.destroy();
    this._unmount = renderSpaces(container, null);
  },

  destroy() {
    if (typeof this._unmount === 'function') {
      this._unmount();
      this._unmount = null;
    }
  }
};
