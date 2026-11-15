/* v0.3.3 universal basic maneuvers — deterministic mock, not live Foundry. */
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../scripts/combat-workflow.js'),'utf8');
const ownedBite={id:'custom-bite',name:'Bite',type:'Melee Weapon',system:{
  attack:{attribute:'dexterity',ability:'brawl',accuracy:2,isrollable:true},
  damage:{attribute:'strength',bonus:3,type:'lethal'},difficulty:8}};
const list=[ownedBite];
const actor={id:'a',uuid:'Actor.a',documentName:'Actor',name:'Attacker',type:'PC',
  system:{settings:{splat:'vampire'},attributes:{dexterity:{total:3},strength:{total:4}},
    health:{damage:{woundpenalty:0}}},
  api:{getAbility:(key)=>({system:{value:key==='brawl'?2:0}})},
  items:{filter:fn=>list.filter(fn),get:id=>list.find(x=>x.id===id)||null,find:fn=>list.find(fn)||null},
  testUserPermission:()=>true};
const defender={id:'d',uuid:'Actor.d',documentName:'Actor',name:'Target',type:'PC',
  system:{settings:{splat:'vampire'},attributes:{dexterity:{total:2}},health:{damage:{woundpenalty:0}}},
  items:{filter:()=>[],get:()=>null,find:()=>null},testUserPermission:()=>true};
const targetToken={actor:defender,name:'Target',document:{uuid:'Scene.Token.d'}};
let choice,dialog;const emitted=[],rolls=[],messages=[],warnings=[];
const gm={id:'gm',isGM:true,active:true};const player={id:'player',isGM:false,active:true};
const renderHooks=new Map(),queuedRenders=[];
const ctx=vm.createContext({console,Math,Number,String,Promise,setTimeout,clearTimeout,
  Hooks:{once(name,fn){renderHooks.set(name,fn);},on(name,fn){renderHooks.set(name,fn);}},
  queueMicrotask:fn=>queuedRenders.push(fn),
  canvas:{tokens:{controlled:[]}},
  CONFIG:{worldofdarkness:{successesToDamageRolls:true,defaultAutoAmmo:true}},
  game:{system:{id:'worldofdarkness'},user:{...player,targets:new Set([targetToken])},
    users:{get:id=>id==='gm'?gm:player,filter:fn=>[gm,player].filter(fn)},
    socket:{emit:(_channel,payload)=>emitted.push(payload)},messages:{get:()=>null}},
  foundry:{utils:{randomID:()=> 'basic-action',deepClone:structuredClone},
    applications:{api:{DialogV2:{input:async config=>{dialog=config;return choice;}}}}},
  document:{addEventListener(){},createElement(){const button={listeners:{},addEventListener(k,fn){this.listeners[k]=fn;}};
    return {dataset:{},className:'',querySelector:s=>s==='.stl-basic-maneuver-launch'?button:null,
      get button(){return button;},set innerHTML(s){this.html=s;}};}},
  ui:{notifications:{warn:x=>warnings.push(x),error:x=>warnings.push(x)}},
  ChatMessage:{getSpeaker:({actor})=>({alias:actor.name}),create:async data=>{
    const msg={id:'m'+(messages.length+1),flags:data.flags,content:data.content};
    messages.push(msg);return msg;}},
  fromUuid:async uuid=>({'Actor.a':actor,'Actor.d':defender,'Scene.Token.d':{actor:defender}}[uuid]??null)
});
vm.runInContext(source,ctx);
const evaluate=x=>vm.runInContext(x,ctx);
ctx.a=actor;
const options=Array.from(evaluate('attackOptions(a)'));
assert.deepEqual(options.slice(0,3).map(x=>x.label),['Bite','Kick','Punch']);
assert.equal(options[0].value,ownedBite.id,'custom Bite Item used, no duplicate virtual Bite');
assert.equal(options[1].value,'stl-basic:kick');
assert.equal(options[2].value,'stl-basic:punch');
assert.equal(options.filter(x=>x.label==='Bite').length,1);
assert.equal(evaluate('workflowWeapon(a,null,"bite").system.damage.bonus'),1);
assert.equal(evaluate('workflowWeapon(a,null,"kick").system.difficulty'),7);
assert.equal(evaluate('workflowWeapon(a,null,"punch").system.damage.bonus'),0);
assert.equal(evaluate('workflowWeapon(a,"custom-bite",null).system.damage.bonus'),3,
  'existing edited Bite rules must be authoritative');
assert.equal(evaluate('workflowWeapon(a,null,"inject")'),null);
assert.equal(evaluate('attackData(a,workflowWeapon(a,null,"kick")).pool'),5);
assert.equal(evaluate('defaultDamagePool(a,workflowWeapon(a,null,"kick"),2).pool'),6);

// UI: owned Bite is already a native row; missing Kick and Punch appear as
// nonpersistent clickable rows, with no automatic creation/import.
const rows=[];
const naturalList={prepend:r=>rows.unshift(r),querySelector:selector=>{
  const key=selector.match(/"([^"]+)"/)?.[1];return rows.find(r=>r.dataset.stlBasicManeuver===key)||null;
}};
const root={querySelector:s=>s==='.headlineRow.combat-natural-itemlist'?{nextElementSibling:naturalList}:null};
ctx.sheet={actor};ctx.root=root;
assert.equal(evaluate('addSheetBasicManeuvers(sheet,root)'),2);
assert.deepEqual(rows.map(r=>r.dataset.stlBasicManeuver),['kick','punch']);
assert.equal(evaluate('addSheetBasicManeuvers(sheet,root)'),0,'rerender does not duplicate rows');
assert.equal(rows.every(r=>typeof r.button.listeners.click==='function'),true);
assert.equal(list.length,1,'no embedded Item created');
// Creature/Spirit sheets have no PC-type requirement: all three defaults appear.
const creature={...actor,type:'Creature',system:{...actor.system,settings:{variant:'spirit',splat:'creature'}},
  items:{filter:()=>[],get:()=>null,find:()=>null}};
const creatureRows=[];
const creatureList={prepend:r=>creatureRows.unshift(r),querySelector:selector=>{
  const key=selector.match(/"([^"]+)"/)?.[1];
  return creatureRows.find(r=>r.dataset.stlBasicManeuver===key)||null;}};
const creatureRoot={querySelector:s=>s==='.headlineRow.combat-natural-itemlist'
  ? {nextElementSibling:creatureList}:null};
ctx.creatureSheet={actor:creature};ctx.creatureRoot=creatureRoot;
assert.equal(evaluate('addSheetBasicManeuvers(creatureSheet,creatureRoot)'),3);
assert.deepEqual(creatureRows.map(r=>r.dataset.stlBasicManeuver),['bite','kick','punch']);
assert.equal(evaluate('addSheetBasicManeuvers(creatureSheet,creatureRoot)'),0);
assert.equal(warnings.length,0);

// Critical Foundry v14 regression: the root handed to renderActorSheetV2 is
// *pending HTML*. Rows must be present before that hook returns; a microtask
// modifies an element which may never be inserted into the live sheet.
function mockList() {
  const rows=[];
  const list={prepend:row=>rows.unshift(row),querySelector:selector=>{
    const key=selector.match(/"([^"]+)"/)?.[1];
    return rows.find(row=>row.dataset.stlBasicManeuver===key)||null;}};
  return {rows,root:{querySelector:selector=>selector==='.headlineRow.combat-natural-itemlist'
    ?{nextElementSibling:list}:null,querySelectorAll:()=>[],addEventListener(){}}};
}
assert.equal(typeof renderHooks.get('renderActorSheetV2'),'function',
  'native ActorSheetV2 render hook registered');
assert.equal(typeof renderHooks.get('renderApplicationV2'),'function',
  'generic ApplicationV2 fallback registered');
const pending=mockList();
renderHooks.get('renderActorSheetV2')({actor:creature},pending.root);
assert.deepEqual(pending.rows.map(row=>row.dataset.stlBasicManeuver),['bite','kick','punch'],
  'must modify pending native Creature HTML synchronously, before render hook returns');
renderHooks.get('renderApplicationV2')({actor:creature},pending.root);
assert.equal(pending.rows.length,3,'render hook inheritance must not duplicate defaults');

// If WoD20 does not dispatch the ActorSheetV2-specific hook, the generic
// ApplicationV2 hook still covers Creature/Spirit sheets.
const onlyGeneral=mockList();
renderHooks.get('renderApplicationV2')({actor:creature},onlyGeneral.root);
assert.deepEqual(onlyGeneral.rows.map(row=>row.dataset.stlBasicManeuver),
  ['bite','kick','punch']);
assert.equal(list.length,1,'no Actor embedded Item writes during either hook');
assert.equal(warnings.length,0);

(async()=>{
  evaluate('DiceRollContainer=class {constructor(a){this.actor=a;}};');
  ctx.rolls=rolls;
  evaluate('DiceRoller=async roll=>{rolls.push({pool:roll.numDices,difficulty:roll.difficulty,action:roll.action});return 3;};');
  // Virtual Kick remains virtual across wire serialization and authoritative chat.
  choice={weapon:'stl-basic:kick',difficulty:'0',modifier:'0',damageOverride:'',attacks:'1'};
  await evaluate('open({attackerActor:a,defaultManeuver:"kick"})');
  assert.equal(dialog.content.includes('value="stl-basic:kick" selected'),true);
  assert.equal(rolls.length,1);
  assert.equal(rolls[0].pool,5);
  assert.equal(rolls[0].difficulty,7);
  assert.equal(emitted.length,1);
  assert.equal(emitted[0].basicManeuver,'kick');
  assert.equal(emitted[0].weaponId,null);
  ctx.payload=emitted[0];
  await evaluate('acceptStart(payload)');
  const state=messages.at(-1).flags['stl-combat-workflow'].combat;
  assert.equal(state.weaponName,'Kick');
  assert.equal(state.basicManeuver,'kick');
  assert.equal(state.weaponId,null);
  assert.equal(state.damageType,'bashing');
  ctx.state=state;
  assert.equal(evaluate('defaultDamagePool(a,workflowWeapon(a,state.weaponId,state.basicManeuver),2).pool'),6);
  await assert.rejects(evaluate('acceptStart({...payload,basicManeuver:"../../bad"})'),/Invalid basic maneuver/);
  // Edited custom Item always wins over the built-in Bite template.
  choice={weapon:'custom-bite',difficulty:'0',modifier:'0',damageOverride:'',attacks:'1'};
  await evaluate('open({attackerActor:a,defaultManeuver:"bite"})');
  assert.equal(rolls.at(-1).difficulty,8);
  assert.equal(rolls.at(-1).pool,7,'custom Bite accuracy bonus is used');
  assert.equal(emitted.at(-1).weaponId,'custom-bite');
  assert.equal(emitted.at(-1).basicManeuver,null);
  assert.equal(list.length,1,'all tests preserve original Actor Items');
  console.log('PASS: universal virtual Bite/Kick/Punch, native customization, sheet dedupe, attack/chat/damage, no Actor writes');
})().catch(e=>{console.error(e);process.exitCode=1;});
