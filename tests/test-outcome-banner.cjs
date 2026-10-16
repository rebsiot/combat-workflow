/* Static output contract for colored combat results and native WoD20 sword icon.
   This is a Node mock, not live Foundry/browser verification. */
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'../scripts/combat-workflow.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../styles/combat-workflow.css'),'utf8');
const ctx=vm.createContext({console,Math,Number,String,Promise,Hooks:{on(){},once(){}},game:{},document:{}});
vm.runInContext(src,ctx);
const banner=state=>vm.runInContext('resultBanner(state)',Object.assign(ctx,{state}));
const base={stage:'defense',attackerName:'A',targetName:'B',weaponName:'Knife',damageType:'lethal',attackSuccesses:2,netSuccesses:2,defense:null,damage:null,soak:null};
for(const stage of ['defense','damage','soak'])assert.equal(banner({...base,stage}),'');
assert.match(banner({...base,stage:'miss',attackSuccesses:0}),/MISSED!/);
for(const [choice,label] of Object.entries({dodge:'DODGED!',block:'BLOCKED!',parry:'PARRIED!'})){
 const html=banner({...base,stage:'miss',defense:{choice,successes:2},netSuccesses:0});
 assert.match(html,new RegExp(label.replace('!','\\!')));
 assert.match(html,/stl-combat-result--miss/);
}
for(const stage of ['resolved','applying','done']){
 const html=banner({...base,stage,finalDamage:4,note:stage==='done'?'Applied to native Actor health.':''});
 assert.match(html,/4 LETHAL DAMAGE/);
 assert.match(html,/stl-combat-result--hit/);
}
assert.match(banner({...base,stage:'resolved',finalDamage:0}),/NO DAMAGE/);
assert.match(banner({...base,stage:'resolved',finalDamage:0}),/stl-combat-result--none/);
assert.match(banner({...base,stage:'done',finalDamage:3,note:'Damage undone by GM; prior health counts restored.'}),/DAMAGE UNDONE/);
assert.match(banner({...base,stage:'done',finalDamage:3,note:'Damage undone by GM; prior health counts restored.'}),/health restored/);
assert.match(banner({...base,stage:'done',finalDamage:3,note:'Damage undone by GM; prior health counts restored.'}),/stl-combat-result--undone/);
assert.match(banner({...base,stage:'done',finalDamage:3,note:'Not applied to Actor health (GM choice).'}),/not applied to health/);
assert.match(banner({...base,stage:'resolved',finalDamage:2,damageType:'<script>'}),/&lt;SCRIPT&gt;/);
const icon=vm.runInContext('combatSheetIcon("#9b49a5")',ctx);
assert.match(icon,/<rect width="30" height="30" fill="#9b49a5"/);
assert.match(icon,/viewBox="0 0 512 512"/);
assert.match(icon,/M19\.75 14\.438c59\.538/);
assert.doesNotMatch(icon,/M15 4\.5 23\.5/);
for(const type of ['miss','hit','none','undone'])assert.match(css,new RegExp('\\.stl-combat-result--'+type));
console.log('PASS: colored combat outcomes, undo status and native swords icon (mock)');
