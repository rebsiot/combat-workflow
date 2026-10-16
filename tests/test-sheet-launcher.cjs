/* Node mock only: validates toolbar DOM contract and sheet Actor launch without Foundry. */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../scripts/combat-workflow.js'), 'utf8');
const hookFns = new Map();
const warns = [];
const emits = [];
const actor = {
  uuid: 'Actor.attacker', type: 'PC', name:'Attacker', documentName:'Actor',
  system: {settings:{splat:'mage'},attributes:{dexterity:{total:3}, strength:{total:2}},health:{damage:{woundpenalty:0}}},
  api:{getAbility:k=>k === 'brawl' ? {system:{value:2}} : null},
  items:{get:()=>null, filter:()=>[], find:()=>null}, testUserPermission:()=>true
};
const defender = {documentName:'Actor',name:'Defender'};
const target = {actor:defender,name:'Defender',document:{uuid:'Scene.test.Token.defender'}};
const ctx = vm.createContext({
  console, Math, Number, String, Promise,
  Hooks:{once:(name,cb)=>hookFns.set(name,cb),on:(name,cb)=>hookFns.set(name,cb)},
  queueMicrotask:cb=>cb(),
  game:{system:{id:'worldofdarkness'},user:{id:'player',isGM:false,targets:new Set([target])},
    users:{get:(id)=>({id,isGM:id==='gm',active:true}),filter:()=>[{id:'gm',isGM:true,active:true}]},
    socket:{emit:(channel,payload)=>emits.push({channel,payload})}},
  canvas:{tokens:{controlled:[]}},
  CONFIG:{worldofdarkness:{successesToDamageRolls:true}},
  foundry:{utils:{randomID:()=> 'test-id'},applications:{api:{DialogV2:{input:async()=>({weapon:'',difficulty:'0',modifier:'0',damageOverride:''})}}}},
  ui:{notifications:{warn:message=>warns.push(message)}},
  fromUuid:async uuid=>({'Actor.attacker':actor,'Scene.test.Token.defender':{actor:defender}}[uuid] ?? null),
  document:{addEventListener:()=>{},createElement: tag => ({
    tag,className:'',attributes:{},listeners:{},innerHTML:'',title:'',
    setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,v){this.listeners[k]=v;}
  })},
});
vm.runInContext(source,ctx);
const evaluate = s=>vm.runInContext(s,ctx);
assert.equal(typeof hookFns.get('renderActorSheetV2'), 'function', 'sheet hook registered');

function sheetFixture(withDodge) {
  const toolbar={inserted:null,button:null,
    querySelector(selector) {
      if(selector === '.macroBtn.wod20-dodge-button') return withDodge ? dodge : null;
      if(selector === '.macroBtn.stl-combat-sheet-button') return this.button;
      return null;
    }
  };
  const dice={parentElement:toolbar,
    querySelector(selector){return selector === 'svg path[fill]'?{getAttribute:()=> '#1177aa'}:null;},
    insertAdjacentElement(position,element){assert.equal(position,'afterend');toolbar.inserted='dice';toolbar.button=element;}
  };
  const dodge={parentElement:toolbar,
    querySelector(selector){return selector === 'svg rect[fill]'?{getAttribute:()=> '#9b49a5'}:null;},
    insertAdjacentElement(position,element){assert.equal(position,'afterend');toolbar.inserted='dodge';toolbar.button=element;}
  };
  return {toolbar,root:{querySelectorAll: s => s === '.macroBtn[data-rolldices="true"]'?[dice]:[]}};
}
for (const withDodge of [true, false]) {
  const {root,toolbar}=sheetFixture(withDodge);
  ctx.sheetRoot = root;
  ctx.sheetApp={actor};
  assert.equal(evaluate('addSheetCombatButtons(sheetApp,sheetRoot)'),1);
  assert.equal(toolbar.inserted,withDodge?'dodge':'dice');
  assert.match(toolbar.button.title,/Attack, Defense, Damage, Soak/);
  assert.equal(toolbar.button.attributes['aria-label'],'Combat Workflow');
  assert.equal(toolbar.button.attributes.tabindex,'0');
  assert.match(toolbar.button.innerHTML,withDodge?/fill="#9b49a5"/:/fill="#1177aa"/);
  assert.equal(evaluate('addSheetCombatButtons(sheetApp,sheetRoot)'),0,'does not duplicate on rerender');
  assert.equal(typeof toolbar.button.listeners.click,'function');
  assert.equal(typeof toolbar.button.listeners.keydown,'function');
}
{
  const {root,toolbar}=sheetFixture(true);
  ctx.sheetRoot=root;ctx.sheetApp={actor:{type:'NPC'}};
  assert.equal(evaluate('addSheetCombatButtons(sheetApp,sheetRoot)'),0);
  assert.equal(toolbar.button,null);
}
(async()=>{
  // The sheet Actor is enough; NO attacking canvas token is controlled.
  evaluate('DiceRollContainer=class {constructor(actor){this.actor=actor;}};DiceRoller=async ()=>3;');
  ctx.actorTest = actor;
  const result = await evaluate('open({attackerActor:actorTest})');
  assert.equal(result,undefined);
  assert.equal(emits.length,1);
  assert.equal(emits[0].channel,'module.stl-combat-workflow');
  assert.equal(emits[0].payload.attackerUuid,'Actor.attacker');
  assert.equal(emits[0].payload.targetUuid,'Scene.test.Token.defender');
  assert.equal(emits[0].payload.successes,3);
  assert.equal(warns.length,0);
  emits.length=0;
  await evaluate('open()');
  assert.equal(emits.length,0);
  assert.match(warns.at(-1),/Select exactly one attacking token/);
  console.log('PASS: sheet button directly under Dodge, native fallback, dedupe, accessibility, no-token Actor launch');
})().catch(error=>{console.error(error);process.exitCode=1;});
