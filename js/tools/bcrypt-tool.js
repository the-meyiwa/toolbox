/* ============================================================
   Bcrypt — hash a password with a chosen cost, or check a
   password against an existing hash. Runs on this device only.
   ============================================================ */

import { makeTextTool } from '../lib/kit/text-tool.js';
import { bcryptHash, bcryptVerify, bcryptInfo } from '../lib/transforms/dev-ops.js';
import { kv, badge, code } from '../lib/kit/render.js';

export default makeTextTool({
  id: 'bcrypt-tool',
  inputLabel: 'Password',
  outputLabel: 'Result',
  produces: ['text'],
  rows: 3,
  delay: 400,
  placeholder: 'Type a password…',
  modes: [
    { id: 'hash', label: 'Hash',
      fields: [{ key: 'rounds', label: 'Cost (work factor)', type: 'range', min: 4, max: 14, value: 10, hint: 'Each step doubles the work. 10–12 is typical for logins.' }],
      async run(input, v) {
        const t = performance.now();
        const hash = await bcryptHash(input, v.rounds);
        return { text: hash, stats: [['took', `${Math.round(performance.now() - t)} ms`], ['cost', v.rounds]] };
      } },
    { id: 'verify', label: 'Verify',
      fields: [{ key: 'hash', label: 'Bcrypt hash', type: 'text', value: '', wide: true, placeholder: '$2b$10$…' }],
      async run(input, v) {
        if (!v.hash.trim()) return { html: '<p class="kit-empty">Paste the hash to check against.</p>', text: '' };
        const info = bcryptInfo(v.hash);
        if (!info) throw new Error('That is not a bcrypt hash ($2a$, $2b$ or $2y$ followed by a cost and 53 characters)');
        const ok = await bcryptVerify(input, v.hash);
        return { text: ok ? 'Match' : 'No match', html: kv([['Result', badge(ok ? 'Password matches' : 'Does not match', ok ? 'ok' : 'bad')], ['Version', info.version], ['Cost', info.cost], ['Salt', code(info.salt)]]) };
      } },
  ],
});
