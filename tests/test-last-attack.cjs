/* Targeted Attack remembers the last successfully rolled action per Actor.
 * Mock-only: no Foundry installation, world edits, or native dice side effects. */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'../scripts/combat-workflow.js'),'utf8');
const mod='stl-combat-workflow';
const gm={id:'gm',active:true,isGM:true},player={id:'player',active:true,isGM:false};
function weapon(id,name,damage=0){return {id,name,type:'Melee Weapon',system:{
  attack:{attribute:'dexterity',ability:'brawl',accuracy:0,isrollable:true},
  damage:{attribute:'strength',bonus:damage,type:'bashing'},
  difficulty:6
}};}
const actorItems=[weapon('sword','Sword',1),weapon('bite','Bite',3)];
const makeActor=(id,items=[])=>({
  id,uuid:'Actor.'+id,documentName:'Actor',type:'PC',name:'Actor '+id,
  system:{attributes:{dexterity:{total:3},strength:{total:2}},settings:{splat:'vampire'},
    health:{damage:{woundpenalty:0}}},api:{getAbility:()=>({system:{value:2}})},
  items:{filter:fn=>items.filter(fn),find:fn=>items.find(fn)||null,
    get:key=>items.find(i=>i.id===key)||null},testUserPermission:()=>true
});
const actorA=makeActor('A',actorItems),actorB=makeActor('B');
const target={name:'Defender',actor:makeActor('T'),document:{uuid:'Scene.A.Token.T'}};
const settings={lastAttackByActor:{}},saved=[];
const dialogs=[],emitted=[],rolls=[],errors=[];
let nextChoice=null,shouldFailRoll=false;
const game={world:{id:'stl-test'},system:{id:'worldofdarkness'},combat:{round:1},
  user:{...player,targets:new Set([target])},
  users:{get:id=>id==='gm'?gm:player,filter:fn=>[gm,player].filter(fn)},
  settings:{register:()=>{},get:(_id,key)=>structuredClone(settings[key]),
    async set(_id,key,val){settings[key]=structuredClone(val);saved.push(structuredClone(val));return val;}},
  socket:{emit:(_channel,payload)=>emitted.push(payload)},messages:{get:()=>null}
};
const ctx=vm.createContext({
  console,Math,Number,String,Promise,setTimeout,clearTimeout,
  game,canvas:{tokens:{controlled:[]}},
  CONFIG:{worldofdarkness:{successesToDamageRolls:true,defaultAutoAmmo:true}},
  Hooks:{once(){},on(){}},queueMicrotask:f=>f(),
  foundry:{utils:{randomID:()=>'nonce',deepClone:structuredClone},
    applications:{api:{DialogV2:{input:async request=>{dialogs.push(request);return nextChoice;}}}}},
  ui:{notifications:{warn:m=>errors.push(m),error:m=>errors.push(m)}},
  document:{addEventListener(){}},
  fromUuid:async()=>null
});
vm.runInContext(src,ctx);
const evalCode=s=>vm.runInContext(s,ctx);
ctx.a=actorA;ctx.b=actorB;
evalCode('DiceRollContainer=class {constructor(actor){this.actor=actor;}};');
ctx.rolls=rolls;
ctx.getShouldFail=()=>shouldFailRoll;
evalCode('DiceRoller=async roll=>{if(getShouldFail())throw Error("mock native dice failed"); rolls.push({dice:roll.numDices,difficulty:roll.difficulty,action:roll.action});return 0;}');
const chosen=()=>{const html=dialogs.at(-1)?.content??'';
  const option=html.match(/<option value="([^"]*)" selected>/);
  return option?.[1]??null;};
const form=(weapon,extra={})=>({weapon,difficulty:'0',modifier:'0',
  attacks:'1',damageOverride:'',...extra});
const open=async actor=>{ctx.who=actor;return evalCode('open({attackerActor:who})');};
const explicit=async(opts)=>{ctx.options=opts;return evalCode('open(options)');};
const settled=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
  assert.equal(evalCode('lastAttackChoice(a)'),null);
  nextChoice=null;
  await open(actorA);
  assert.equal(chosen(),'','fresh macro defaults Unarmed');
  assert.equal(saved.length,0,'cancel does not save attack');

  nextChoice=form('stl-basic:kick',{modifier:'2'});
  await open(actorA);await settled();
  assert.equal(rolls.length,1);
  assert.equal(rolls[0].dice,7,'Dex 3 + Brawl 2 + bonus 2');
  assert.equal(rolls[0].difficulty,7);
  assert.equal(saved.length,1,'successful roll, even 0 successes, remembers');
  assert.equal(Object.values(settings.lastAttackByActor)[0].selected,'stl-basic:kick');

  game.combat.round=2;
  nextChoice=null;
  await open(actorA);
  assert.equal(chosen(),'stl-basic:kick','previous round selected Kick');
  assert.equal(saved.length,1,'opening/cancelling never updates memory');
  await open(actorB);
  assert.equal(chosen(),'','different Actor does not inherit attack');
  assert.equal(saved.length,1);

  // Native sheet weapon click must override memory and be remembered after roll.
  nextChoice=form('sword');
  await explicit({attackerActor:actorA,weaponId:'sword'});await settled();
  assert.equal(chosen(),'sword','explicit native weapon click takes precedence');
  assert.equal(evalCode('lastAttackChoice(a)'),'sword');
  nextChoice=null;await open(actorA);assert.equal(chosen(),'sword');

  // Standard owned Bite is saved by ID; removing it keeps the same action as
  // virtual Bite, not the unrelated weapon and never recreates the deleted Item.
  nextChoice=form('bite');
  await explicit({attackerActor:actorA,weaponId:'bite'});await settled();
  assert.equal(evalCode('lastAttackChoice(a)'),'bite');
  actorItems.splice(actorItems.findIndex(i=>i.id==='bite'),1);
  assert.equal(evalCode('lastAttackChoice(a)'),'stl-basic:bite');
  nextChoice=null;await open(actorA);
  assert.equal(chosen(),'stl-basic:bite');
  assert.equal(actorItems.length,1,'no Item created on restore');

  // An unavailable nonstandard weapon must not be preselected.
  nextChoice=form('sword');
  await explicit({attackerActor:actorA,weaponId:'sword'});await settled();
  actorItems.length=0;
  assert.equal(evalCode('lastAttackChoice(a)'),null);
  nextChoice=null;await open(actorA);
  assert.equal(chosen(),'');
  const previousWrites=saved.length;

  // Failure or cancellation never erases a previous remembered attack.
  shouldFailRoll=true;nextChoice=form('stl-basic:punch');
  await assert.rejects(open(actorA),/mock native dice failed/);
  await settled();
  assert.equal(saved.length,previousWrites,'failed native roll does not save');
  shouldFailRoll=false;

  // Independent user browser preference per user ID, even if settings are shared.
  game.user.id='gm';game.user.isGM=false;
  assert.equal(evalCode('lastAttackChoice(a)'),null,'selection is scoped to current user');
  game.user.id='player';

  // Explicit virtual default for a sheet row beats the previous stored weapon.
  nextChoice=null;
  await explicit({attackerActor:actorA,defaultManeuver:'punch'});
  assert.equal(chosen(),'stl-basic:punch');

  // Previously saved modifiers and attack counts must never carry forward.
  assert.match(dialogs.at(-1).content,/name="modifier"[^>]*value="0"/);
  assert.match(dialogs.at(-1).content,/name="difficulty"[^>]*value="0"/);
  assert.equal(emitted.length,4,'only completed rolls emitted workflow messages');
  assert.equal(errors.length,0);
  console.log('PASS: per-Actor and cross-round selection, explicit precedence, restore/fallback, cancel/failure, no Actor edits');
})().catch(err=>{console.error(err);process.exitCode=1;});
