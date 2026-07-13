import { validateMicroQueue } from "./deconstructor.mjs";
let fails = 0; const ck = (c,m) => { console.log((c?"PASS":"FAIL")+"  "+m); if(!c) fails++; };
// THE DISPUTED CASE: a '..' traversal in a context_dependency, research class.
// laguna REJECT claims this is ALLOWED (logic inversion). Settle it.
const r = validateMicroQueue({ mission_id:"M", steps:[
  { step_index:1, description:"x", action_type:"edit", target_files:["out.md"],
    context_dependencies:["../../etc/passwd"], validation_command:"node -e 1" }
]}, { research:true });
ck(r.ok === false, "research-class context dep with '..' traversal is REJECTED (laguna's concern)");
console.log("errors:", JSON.stringify(r.errors));
process.exit(fails===0?0:1);
