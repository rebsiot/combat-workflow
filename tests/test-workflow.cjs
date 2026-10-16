/* Static mock checks only. Not a Foundry runtime or browser test. */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const src = fs.readFileSync(require('path').join(__dirname, '../scripts/combat-workflow.js'), 'utf8');
const actorA = {documentName:'Actor',name:'Attacker', system:{settings:{splat:'mage'}, attributes:{dexterity:{total:3},strength:{total:2}}, health:{damage:{woundpenalty:0}}}, items:{get:()=>null,find:()=>null,filter:()=>[]}, testUserPermission:()=>true};
const actorB = {documentName:'Actor',name:'Defender', system:{health:{damage:{bashing:0,lethal:0,aggravated:0}}}, items:{get:()=>null}, testUserPermission:()=>true, update:async function(changes){if(changes['system.health.damage'])this.system.health.damage=changes['system.health.damage']; for(const [k,v] of Object.entries(changes)){const m=k.match(/^system\.health\.damage\.(bashing|lethal|aggravated)$/); if(m)this.system.health.damage[m[1]]=v;}}};
const docs = {'a':actorA,'b':actorB};
const saved = new Map();
const mockMessage = {
  id:'m1', flags:{'stl-combat-workflow':{combat:{
    schema:1, attackerUuid:'a', targetUuid:'b', attackerName:'Attacker', targetName:'Defender',
    weaponName:'Unarmed Strike', weaponId:null, damageType:'bashing',
    attackSuccesses:4, netSuccesses:4, stage:'defense', defense:null, damage:null, soak:null, finalDamage:null
  }}},
  getFlag(ns,key) {return this.flags[ns][key];},
  async update(values) {this.content=values.content;this.flags['stl-combat-workflow'].combat=values['flags.stl-combat-workflow.combat'];}
};
saved.set('m1',mockMessage);
const context = vm.createContext({
  console, Math, Number, String, Promise,
  Hooks:{once:()=>{},on:()=>{}},
  CONFIG:{worldofdarkness:{successesToDamageRolls:true,woundLevels:{bruised:true}}},
  game:{system:{id:'worldofdarkness'},user:{id:'gm',isGM:true},users:{get:(id)=>({id,isGM:id==='gm',active:true}),filter:()=>[{id:'gm',isGM:true,active:true}]},messages:{get:id=>saved.get(id)}},
  fromUuid:async id=>docs[id] || null,
  foundry:{utils:{deepClone:obj=>structuredClone(obj)}},
  ui:{notifications:{warn:()=>{}}},
  ChatMessage:{getSpeaker:()=>({}),create:async()=>{}},
  document:{addEventListener:()=>{}}
});
vm.runInContext(src,context);
const evaluate = code=>vm.runInContext(code,context);
assert.strictEqual(evaluate('attackData({system:{attributes:{dexterity:{total:3}}},api:{getAbility:()=>({system:{value:2}})}},null).pool'),5);
assert.strictEqual(evaluate('defaultDamagePool({system:{attributes:{strength:{total:2}}}},null,4).pool'),5);
assert.ok(evaluate('card({stage:"defense",attackerName:"A",targetName:"B",weaponName:"C",damageType:"bashing",attackSuccesses:3,defense:null})').includes('data-stl-combat-action="dodge"'));
(async()=>{
  await evaluate('acceptAdvance({messageId:"m1",step:"defense",choice:"dodge",successes:2,userId:"gm"})');
  assert.strictEqual(mockMessage.getFlag('stl-combat-workflow','combat').netSuccesses,2);
  assert.strictEqual(mockMessage.getFlag('stl-combat-workflow','combat').stage,'damage');
  await evaluate('acceptAdvance({messageId:"m1",step:"damage",successes:3,userId:"gm"})');
  assert.strictEqual(mockMessage.getFlag('stl-combat-workflow','combat').stage,'soak');
  await evaluate('acceptAdvance({messageId:"m1",step:"soak",choice:"roll",successes:1,userId:"gm"})');
  assert.strictEqual(mockMessage.getFlag('stl-combat-workflow','combat').finalDamage,2);
  evaluate('CombatHelper={GetMaxHealthLevels:()=>7,ApplyDamageWithOverflow:(damage,type,n)=>{damage[type]+=n;return n;}}');
  await evaluate('acceptAdvance({messageId:"m1",step:"apply",userId:"gm"})');
  assert.strictEqual(mockMessage.getFlag('stl-combat-workflow','combat').stage,'done');
  assert.strictEqual(actorB.system.health.damage.bashing,2);
  let rejected = false;
  try {await evaluate('acceptAdvance({messageId:"m1",step:"apply",userId:"gm"})');} catch(e) {rejected=true;}
  assert.ok(rejected,'second application must be rejected');
  assert.strictEqual(actorB.system.health.damage.bashing,2);
  await evaluate('acceptAdvance({messageId:"m1",step:"undo",userId:"gm"})');
  assert.strictEqual(actorB.system.health.damage.bashing,0);
  assert.strictEqual(mockMessage.getFlag('stl-combat-workflow','combat').undo,null);
  actorB.system.settings={splat:'vampire'};
  const firearm = {type:'Ranged Weapon',system:{attack:{ability:'firearms'},damage:{type:'lethal'}}};
  context.firearm=firearm;
  assert.strictEqual(evaluate('effectiveDamageType(firearm, ({system:{settings:{splat:"vampire"}}}), "")'),'bashing');
  assert.strictEqual(evaluate('effectiveDamageType(firearm, ({system:{settings:{splat:"vampire"}}}), "lethal")'),'lethal');
  mockMessage.flags['stl-combat-workflow'].combat={...mockMessage.getFlag('stl-combat-workflow','combat'),stage:'soak',damage:{successes:5},damageType:'bashing',soak:null,finalDamage:null};
  await evaluate('acceptAdvance({messageId:"m1",step:"soak",choice:"roll",successes:2,userId:"gm"})');
  assert.strictEqual(mockMessage.getFlag('stl-combat-workflow','combat').finalDamage,1);
  console.log('PASS: weapon pool, bonus damage, defense, native-roll result stages, soak, once-only health apply (mock)');
})().catch(err=>{console.error(err);process.exitCode=1;});
