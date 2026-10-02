/* ============================================================
   KoreLearn — a link out to korelearn.com, Toolbox's learning partner.

   Clicking its card (or a shortcut to it) opens KoreLearn in a new tab
   straight from the click (js/app.js), so pop-up blockers allow it.
   Reaching this page another way (a typed address, Spotlight's Enter)
   shows one clear button instead of a blocked pop-up.
   ============================================================ */

export const KORELEARN_URL = 'https://korelearn.com/?ref=toolbox';

export default {
  render(container) {
    container.innerHTML = `
      <div class="kl-out">
        <span class="kl-out-mark" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8.5 12 4l10 4.5-10 4.5z"/><path d="M6 10.5v5c0 1.4 2.7 3 6 3s6-1.6 6-3v-5"/><path d="M22 8.5v6"/></svg></span>
        <h2 class="kl-out-title">KoreLearn</h2>
        <p class="kl-out-text">Courses, practice questions and study plans for learning anything, from exams to new skills. It opens in a new tab.</p>
        <a class="btn btn-primary kl-out-btn" href="${KORELEARN_URL}" target="_blank" rel="noopener">Open KoreLearn</a>
      </div>`;
  },
};
