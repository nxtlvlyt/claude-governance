import { browserConsoleCheck } from 'file:///C:/Users/marka/code/mt-audit/qc-harness-v2.mjs';

const url = 'https://0be38993.muddytires.pages.dev/map.html';
const result = await browserConsoleCheck(url, { settleMs: 5000 });
console.log(JSON.stringify(result, null, 2));
