/* Static mock checks only. Not a Foundry runtime or browser test. */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const src = fs.readFileSync(require('path').join(__dirname, '../scripts/combat-workflow.js'), 'utf8');
const actorA = {documentName:'Actor',name:'Attacker', system:{settings:{splat:'mage'}, attributes:{dexterity:{total:3},strength:{total:2}}, health:{damage:{woundpenalty:0}}}, items:{get:()=>null,find:()=>null,filter:()=>[]}, testUserPermission:()=>true};
const nativeLevels = {bruised:0,hurt:-1,injured:-1,wounded:-2,mauled:-2,crippled:-5,incapacitated:-99};
const track = Object.fromEntries(Object.entries(nativeLevels).map(([key,penalty]) => [key,{total:1,label:`wod.health.${key}`,penalty}]));
const actorB = {documentName:'Actor',name:'Defender',system:{health:{damage:{bashing:0,lethal:0,aggravated:0,woundlevel:'',woundpenalty:0},...track}, traits:{health:{totalhealthlevels:{max:7,value:7}}}},items:{get:()=>null},testUserPermission:()=>true,
  update:async function(changes){for(const [key,value] of Object.entries(changes)){const segments=key.split('.');let object=this;while(segments.length>1)object=object[segments.shift()];object[segments[0]]=value;}}
};
const docs = {'a':actorA,'b':actorB};
const saved = new Map();
let created=1;
let mockMessage = {
  id:'m1', flags:{'stl-combat-workflow':{combat:{
    schema:1, attackerUuid:'a', targetUuid:'b', attackerName:'Attacker', targetName:'Defender',
    weaponName:'Unarmed Strike', weaponId:null, damageType:'bashing',
    attackSuccesses:4, netSuccesses:4, stage:'defense', defense:null, damage:null, soak:null, finalDamage:null
  }}},
  getFlag(ns,key) {return this.flags[ns][key];},
  async update(values) {this.content=values.content;this.flags['stl-combat-workflow'].combat=values['flags.stl-combat-workflow.combat'];},
  async delete() {saved.delete(this.id);}
};
saved.set('m1',mockMessage);
const context = vm.createContext({
  console, Math, Number, String, Promise,
  Hooks:{once:()=>{},on:()=>{}},
  CONFIG:{worldofdarkness:{successesToDamageRolls:true,woundLevels:Object.fromEntries(Object.keys(nativeLevels).map(x=>[x,true]))}},
  game:{system:{id:'worldofdarkness'},user:{id:'gm',isGM:true},users:{get:(id)=>({id,isGM:id==='gm',active:true}),filter:()=>[{id:'gm',isGM:true,active:true}]},messages:{get:id=>saved.get(id)}},
  fromUuid:async id=>docs[id] || null,
  foundry:{utils:{deepClone:obj=>structuredClone(obj)}},
  ui:{notifications:{warn:()=>{}}},
  ChatMessage:{getSpeaker:()=>({}),create:async(data)=>{
    const next=Object.assign(Object.create(mockMessage),{id:`m${++created}`,content:data.content,flags:data.flags});
    saved.set(next.id,next); mockMessage=next; return next;
  }},
  document:{addEventListener:()=>{}}
});
vm.runInContext(src,context);
const evaluate = code=>{context.__msgId=mockMessage.id;return vm.runInContext(code.replace(/messageId:"m1"/g,'messageId:__msgId'),context);};
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
  assert.strictEqual(actorB.system.health.damage.woundlevel,'wod.health.hurt');
  assert.strictEqual(actorB.system.health.damage.woundpenalty,-1);
  assert.strictEqual(actorB.system.traits.health.totalhealthlevels.value,5);
  assert.strictEqual(saved.size,1,'old workflow cards removed on advancement');
  let rejected = false;
  try {await evaluate('acceptAdvance({messageId:"m1",step:"apply",userId:"gm"})');} catch(e) {rejected=true;}
  assert.ok(rejected,'second application must be rejected');
  assert.strictEqual(actorB.system.health.damage.bashing,2);
  await evaluate('acceptAdvance({messageId:"m1",step:"undo",userId:"gm"})');
  assert.strictEqual(actorB.system.health.damage.bashing,0);
  assert.strictEqual(actorB.system.health.damage.woundlevel,'');
  assert.strictEqual(actorB.system.health.damage.woundpenalty,0);
  assert.strictEqual(actorB.system.traits.health.totalhealthlevels.value,7);
  assert.strictEqual(mockMessage.getFlag('stl-combat-workflow','combat').undo,null);
  // Reproduce reported defect: three wounds take Wounded (four) to Incapacitated (seven).
  Object.assign(actorB.system.health.damage,{bashing:4,lethal:0,aggravated:0,woundlevel:'wod.health.wounded',woundpenalty:-2});
  actorB.system.traits.health.totalhealthlevels.value=3;
  mockMessage.flags['stl-combat-workflow'].combat={...mockMessage.getFlag('stl-combat-workflow','combat'),stage:'resolved',finalDamage:3,damageType:'lethal',note:'',undo:null};
  await evaluate('acceptAdvance({messageId:"m1",step:"apply",userId:"gm"})');
  assert.strictEqual(actorB.system.health.damage.lethal,3);
  assert.strictEqual(actorB.system.health.damage.woundlevel,'wod.health.incapacitated');
  assert.strictEqual(actorB.system.health.damage.woundpenalty,-99);
  assert.strictEqual(actorB.system.traits.health.totalhealthlevels.value,0);
  await evaluate('acceptAdvance({messageId:"m1",step:"undo",userId:"gm"})');
  assert.strictEqual(actorB.system.health.damage.bashing,4);
  assert.strictEqual(actorB.system.health.damage.lethal,0);
  assert.strictEqual(actorB.system.health.damage.woundlevel,'wod.health.wounded');
  assert.strictEqual(actorB.system.health.damage.woundpenalty,-2);
  assert.strictEqual(actorB.system.traits.health.totalhealthlevels.value,3);
  // Chimerical wound count remains independent and affects the display when worse.
  actorB.system.health.damage.chimerical={bashing:6,lethal:0,aggravated:0};
  context.__actor=actorB;
  assert.strictEqual(evaluate('nativeHealthFields(__actor,{bashing:0,lethal:0,aggravated:0,chimerical:__actor.system.health.damage.chimerical})["system.health.damage.woundlevel"]'),'wod.health.crippled');
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
