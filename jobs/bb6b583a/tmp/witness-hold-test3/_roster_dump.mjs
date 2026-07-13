// Resolves the roster straight from the registry file — ground truth, not memory.
import { selectSeat, selectSeatByChannel, registry } from './model_rijal.mjs';

const chosen = (role) =>
  Object.values(registry)
    .filter((s) => s.chosen && Array.isArray(s.role) && s.role.includes(role))
    .map((s) => s.id);

const ch = (r) => { const s = selectSeatByChannel(r, 'cloud'); return s ? s.id : '(none)'; };

console.log('Phase 1 — Plan (architects):  ', chosen('architect').join('  ·  '));
console.log('Phase 2 — Implement:          ', `Executor ${ch('executor')}  ·  Witness ${ch('witness')}  ·  Validator ${ch('validator')}  ·  Auditor ${chosen('auditor')[0]}`);
console.log('Phase 3 — Verify (auditors):  ', chosen('auditor').join('  ·  '));
const scan = selectSeat('governance-scanner');
console.log('Scanner:                      ', scan ? scan.id : '(none)', scan && !scan.chosen ? '   <-- placeholder (old local); table said "big cloud model" — we never named one' : '');
console.log('Integrator (all phases):       Opus');
