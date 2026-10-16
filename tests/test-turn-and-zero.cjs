/* Mock-only regression for turn cues and the no-damage auto-finish path. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../scripts/combat-workflow.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../styles/combat-workflow.css'),'utf8');
const attacker={id:'a',name:'Marlowe',documentName:'Actor',testUserPermission:()=>true};
const target={id:'b',name:'ThugMelee (1)',documentName:'Actor',testUserPermission:()=>true};
const docs={a:attacker,b:target},messages=new Map();let count=0;
const ctx=vm.createContext({
 console,Math,Number,String,Promise,Hooks:{on(){},once(){}},
 game:{user:{id:'gm',isGM:true},users:{get:()=>({isGM:true}),filter:()=>[{id:'gm',isGM:true,active:true}]},messages:{get:id=>messages.get(id)}},
 CONFIG:{worldofdarkness:{woundLevels:{bruised:true}}},
 foundry:{utils:{deepClone:o=>structuredClone(o)}},
 fromUuid:async id=>docs[id],
 ChatMessage:{getSpeaker:({actor})=>({alias:actor.name}),create:async d=>{
   const m={id:'m'+(++count),content:d.content,speaker:d.speaker,flags:d.flags,
     getFlag(ns,key){return this.flags[ns][key];},
     async update(v){this.content=v.content;this.flags['stl-combat-workflow'].combat=v['flags.stl-combat-workflow.combat'];},
     async delete(){messages.delete(this.id);}};
   messages.set(m.id,m);return m;}}
});
vm.runInContext(src,ctx);
function call(code,fields={}){Object.assign(ctx,fields);return vm.runInContext(code,ctx);}
const base={schema:1,attackerUuid:'a',targetUuid:'b',attackerName:'Marlowe',targetName:'ThugMelee (1)',weaponName:'Knife',
 damageType:'lethal',attackSuccesses:4,netSuccesses:2,stage:'defense',defense:null,damage:null,soak:null,finalDamage:null,note:''};
assert.match(call('turnPrompt(st)',{st:base}),/ThugMelee \(1\) Roll/);
assert.match(call('turnPrompt(st)',{st:{...base,stage:'damage'}}),/Marlowe Roll/);
assert.match(call('turnPrompt(st)',{st:{...base,stage:'resolved',finalDamage:2}}),/Storyteller/);
assert.doesNotMatch(call('turnPrompt(st)',{st:{...base,stage:'resolved',finalDamage:2}}),/Storyteller Roll/);
assert.equal(call('turnPrompt(st)',{st:{...base,stage:'done'}}),'');
assert.match(css,/stl-combat-turn-name/);
async function create(s){return call('makeMessage(st)',{st:s});}
async function advance(m,step,successes,choice){
 return call('acceptAdvance({messageId:id,step,userId:"gm",successes,choice})',{id:m.id,step,successes,choice});
}
(async()=>{
 let m=await create(base);
 assert.equal(m.speaker.alias,'ThugMelee (1)');
 m=await create({...base,stage:'damage'});
 assert.equal(m.speaker.alias,'Marlowe');
 m=await create({...base,stage:'resolved',finalDamage:3});
 assert.equal(m.speaker.alias,'Combat Workflow');
 const d=await create({...base,stage:'damage'});
 await advance(d,'damage',0);
 let last=[...messages.values()].at(-1);
 assert.equal(last.getFlag('stl-combat-workflow','combat').stage,'done');
 assert.match(last.content,/NO DAMAGE/);
 assert.doesNotMatch(last.content,/data-stl-combat-action="apply"/);
 const soak=await create({...base,stage:'soak',damage:{successes:1}});
 await advance(soak,'soak',2,'roll');
 last=[...messages.values()].at(-1);
 assert.equal(last.getFlag('stl-combat-workflow','combat').stage,'done');
 assert.doesNotMatch(last.content,/data-stl-combat-action="apply"/);
 const hit=await create({...base,stage:'soak',damage:{successes:4}});
 await advance(hit,'soak',1,'roll');
 last=[...messages.values()].at(-1);
 assert.equal(last.getFlag('stl-combat-workflow','combat').stage,'resolved');
 assert.match(last.content,/Storyteller/);
 assert.match(last.content,/data-stl-combat-action="apply"/);
 const old=await create({...base,stage:'resolved',finalDamage:0});
 assert.doesNotMatch(old.content,/data-stl-combat-action="apply"/);
 await advance(old,'apply',0);
 last=[...messages.values()].at(-1);
 assert.equal(last.getFlag('stl-combat-workflow','combat').stage,'done');
 console.log('PASS: speaker/turn prompts, no-damage auto-completion and legacy guard');
})().catch(e=>{console.error(e);process.exitCode=1;});
