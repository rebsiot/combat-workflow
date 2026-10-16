/* WoD20 attack mode, split pool, and grapple hold regression mocks. No live Foundry tests. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../scripts/combat-workflow.js'),'utf8');
const messages=new Map();let counter=0;
const users=[{id:'gm',isGM:true,active:true},{id:'player',isGM:false,active:true}];
const gun={id:'gun',type:'Ranged Weapon',name:'SMG',system:{
 attack:{attribute:'dexterity',ability:'firearms',accuracy:0},
 damage:{attribute:'noselected',bonus:5,type:'lethal'},
 difficulty:6,mode:{hasburst:true,hasfullauto:true},clip:{value:12,max:12}
},async update(change){this.system.clip.value=change['system.clip.value'];}};
const meleeManeuvers=["Bite","Disarm","Grapple","Kick","Punch","Sweep"].map((name,i)=>({
  id:"melee"+i,type:"Melee Weapon",name,system:{attack:{attribute:"dexterity",ability:"brawl"},damage:{attribute:"strength",type:"bashing"}}
}));
const actor={id:'a',uuid:'Actor.a',documentName:'Actor',name:'Attacker',type:'PC',
 system:{attributes:{strength:{total:4},dexterity:{total:3}},health:{damage:{woundpenalty:0}},settings:{splat:'mortal'}},
 api:{getAbility:key=>({system:{value:key==='firearms'?3:2}})},
 items:{get:id=>[gun,...meleeManeuvers].find(item=>item.id===id)||null,find:()=>null,filter:fn=>[gun,...meleeManeuvers].filter(fn)},testUserPermission:()=>true};
const target={id:'t',uuid:'Actor.t',documentName:'Actor',name:'Defender',type:'PC',
 system:{attributes:{strength:{total:3},dexterity:{total:3}},health:{damage:{woundpenalty:0}},settings:{splat:'mortal'}},
 api:{getAbility:()=>({system:{value:2}})},items:{get:()=>null,find:()=>null,filter:()=>[]},testUserPermission:()=>true};
const tokens={attacker:{actor,name:'Attacker',document:{uuid:'Scene.Token.a'}},
 defender:{actor:target,name:'Defender',document:{uuid:'Scene.Token.t'}}};
const warning=[],emitted=[],rolls=[],prompts=[];let choice={};
const ctx=vm.createContext({console,Math,Number,String,Promise,setTimeout,clearTimeout,
 Hooks:{on(){},once(){}},queueMicrotask:f=>f(),
 document:{addEventListener(){}},canvas:{tokens:{controlled:[]}},
 CONFIG:{worldofdarkness:{defaultAutoAmmo:true,successesToDamageRolls:true,woundLevels:{}}},
 ui:{notifications:{warn:m=>warning.push(m),error:m=>warning.push(m)}},
 game:{system:{id:'worldofdarkness'},user:{id:'player',isGM:false,targets:new Set([tokens.defender])},
   users:{get:id=>users.find(u=>u.id===id),filter:fn=>users.filter(fn)},
   socket:{emit:(channel,payload)=>emitted.push(payload)},messages:{get:id=>messages.get(id)}},
 fromUuid:async uuid=>({
   'Actor.a':actor,'Actor.t':target,
   'Scene.Token.a':{actor},'Scene.Token.t':{actor:target}
 })[uuid]||null,
 ChatMessage:{getSpeaker:({actor})=>({alias:actor.name}),create:async data=>{
   const msg={id:'m'+(++counter),content:data.content,flags:data.flags,
     getFlag(ns,key){return this.flags[ns][key];},
     async update(d){this.content=d.content;this.flags['stl-combat-workflow'].combat=d['flags.stl-combat-workflow.combat'];},
     async delete(){messages.delete(this.id);}};
   messages.set(msg.id,msg);return msg;
 }},
 foundry:{utils:{deepClone:x=>structuredClone(x),randomID:()=> 'nonce'},
   applications:{api:{DialogV2:{input:async input=>{prompts.push(input);return choice;}}}}}
});
vm.runInContext(code,ctx);
const run=(source,fields={})=>vm.runInContext(source,Object.assign(ctx,fields));
const state=m=>m.getFlag('stl-combat-workflow','combat');
const last=()=>[...messages.values()].at(-1);
(async()=>{
  assert.deepEqual(Array.from(run('splitAttackPool(8,3)')),[3,3,2]);
  assert.deepEqual(Array.from(run('splitAttackPool(5,2)')),[3,2]);
  assert.equal(run('splitAttackPool(1,2)'),null);
  assert.equal(run('supportsFireMode(gun,"burst")',{gun}),true);
  assert.equal(run('supportsFireMode(gun,"fullauto")',{gun}),true);
  assert.equal(run('supportsFireMode(null,"fullauto")'),false);
  assert.equal(run('ammunitionUse(gun,"burst").spend',{gun}),3);
  assert.equal(run('ammunitionUse(gun,"fullauto").spend',{gun}),12);
  assert.equal(run('ammunitionUse(gun,"fullauto").required',{gun}),6);
  assert.equal(run('validCombo({count:3,index:1,pools:[3,3,2]}).count'),3);
  assert.throws(()=>run('validCombo({count:3,index:1,pools:[3,0,2]})'),/Invalid/);
  run('DiceRollContainer=class {constructor(actor){this.actor=actor;}}');
  run('DiceRoller=async roll=>{rolls.push({pool:roll.numDices,difficulty:roll.difficulty,action:roll.action});return 3;}',{rolls});
  const soakCard=run('card(st)',{st:{stage:'soak',attackerName:'Attacker',targetName:'Defender',
    weaponName:'SMG',damageType:'lethal',attackSuccesses:3,netSuccesses:2,
    damage:{successes:2},soak:null}});
  assert.match(soakCard,/>No Soak<\/button>/);
  assert.match(soakCard,/title="Cannot or choose not to soak"/);
  assert.doesNotMatch(soakCard,/Cannot \/ Won/);

  const baseGrapple={attackerName:"Marlowe",targetName:"ThugMelee (1)",weaponName:"Grapple / Hold",
    damageType:"bashing",maneuver:"hold",attackSuccesses:2,netSuccesses:2,defense:null,damage:null,soak:null};
  const grappling=run('card(st)',{st:{...baseGrapple,stage:"grapple-defend"}});
  assert.match(grappling,/>Resist<\/button>/);
  assert.match(grappling,/>No Resist<\/button>/);
  assert.match(grappling,/title="Roll Strength \+ Brawl to resist the grapple"/);
  assert.match(grappling,/stl-combat-actions--paired/);
  assert.doesNotMatch(grappling,/>Resist \(Str \+ Brawl\)|>Do Not Resist/);
  const holding=run('card(st)',{st:{...baseGrapple,stage:"holding"}});
  assert.match(holding,/>Escape<\/button>/);
  assert.match(holding,/>Release Hold<\/button>/);
  assert.doesNotMatch(holding,/>Attempt Escape<\/button>/);
  const counter=run('card(st)',{st:{...baseGrapple,stage:"grapple-counter"}});
  assert.match(counter,/>Resist Escape<\/button>/);
  assert.doesNotMatch(counter,/Contest Escape \(Str \+ Brawl\)/);
  const combatCss=fs.readFileSync(path.join(__dirname,"../styles/combat-workflow.css"),"utf8");
  assert.match(combatCss,/\.stl-combat-card \.stl-combat-actions--paired/);
  assert.match(combatCss,/grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(combatCss,/white-space: nowrap/);

  const weaponNames=Array.from(run('attackWeaponList(actor)',{actor})).map(item=>item.name);
  assert.ok(weaponNames.includes("SMG"));
  assert.ok(!weaponNames.includes("Grapple"),"Grapple is a standalone maneuver, not a weapon option");
  for (const name of ["Bite","Disarm","Kick","Punch","Sweep"]) {
    assert.ok(weaponNames.includes(name),name+" must remain available in normal attacks");
  }
  assert.ok(Array.from(run('weaponList(actor)',{actor})).some(item=>item.name==="Grapple"),
    "Keep the native Grapple Item intact for WoD20 and existing chat cards");
  assert.equal(run('isGrappleManeuver({type:"Melee Weapon",name:"  GRAPPLE  "})'),true);
  assert.equal(run('isGrappleManeuver({type:"Ranged Weapon",name:"Grapple"})'),false);
  const openChoice={weapon:'gun',difficulty:'0',modifier:'0',damageOverride:'',attacks:'1',fireMode:'burst'};
  choice=openChoice;
  await run('open({attackerActor:actor})',{actor});
  assert.equal(rolls.at(-1).pool,9);
  assert.doesNotMatch(prompts.at(-1).content,/name="maneuver"|Grapple/,'Standard attack must not expose grapple at all');
  for(const name of ["Bite","Disarm","Kick","Punch","Sweep"]) assert.match(prompts.at(-1).content,new RegExp(">"+name+"<"));
  assert.match(prompts.at(-1).content,/>Unarmed Strike<\/option>/);
  const rollsBeforeGrappleWeapon=rolls.length;
  choice={...openChoice,weapon:meleeManeuvers.find(i=>i.name==="Grapple").id};
  await run('open({attackerActor:actor})',{actor});
  assert.equal(rolls.length,rollsBeforeGrappleWeapon,"hidden native Grapple item cannot be forced into Attack");
  assert.match(warning.at(-1),/Actions.*Grapple/);
  choice=openChoice;
  assert.equal(rolls.at(-1).difficulty,7);
  assert.equal(gun.system.clip.value,9);
  assert.equal(emitted.at(-1).firingMode,'burst');
  choice={...openChoice,fireMode:'fullauto'};
  await run('open({attackerActor:actor})',{actor});
  assert.equal(rolls.at(-1).pool,16);
  assert.equal(rolls.at(-1).difficulty,8);
  assert.equal(gun.system.clip.value,0);
  const rolled=rolls.length;
  await run('open({attackerActor:actor})',{actor});
  assert.equal(rolls.length,rolled,'insufficient ammo never rolls');
  assert.match(warning.at(-1),/needs 6 rounds/);
  gun.system.clip.value=12;
  choice={...openChoice,fireMode:'single',attacks:'2'};
  await run('open({attackerActor:actor})',{actor});
  assert.equal(rolls.at(-1).pool,3);
  assert.deepEqual(Array.from(emitted.at(-1).combo.pools),[3,3]);
  choice={...openChoice,fireMode:'burst',attacks:'2'};
  await run('open({attackerActor:actor})',{actor});
  assert.match(warning.at(-1),/cannot be combined/);
  choice={pool:'6',difficulty:'6'};
  await run('openGrapple({attackerActor:actor})',{actor});
  assert.equal(rolls.at(-1).pool,6,'Strength 4 + Brawl 2');
  assert.equal(emitted.at(-1).maneuver,'hold');
  assert.match(prompts.at(-1).window.title,/Grapple/);
  assert.match(prompts.at(-1).content,/Strength \+ Brawl/);
  assert.doesNotMatch(prompts.at(-1).content,/name="weapon"|name="fireMode"|name="attacks"|name="damageOverride"|name="maneuver"/,
    'Grapple dialog must only show the contested Strength + Brawl roll');
  assert.equal(prompts.at(-1).ok.label,'Roll Grapple');
  assert.equal(run('game.stlCombatWorkflow?.openGrapple ?? undefined') == null,true,'mock ready hook has not executed');
  // Exercise authoritative stage machine with a GM mock, no Actor mutation.
  ctx.game.user={id:'gm',isGM:true,targets:new Set([tokens.defender])};
  await run('acceptStart(p)',{p:{attackerUuid:'Actor.a',targetUuid:'Actor.t',userId:'gm',successes:4,maneuver:'hold'}});
  let msg=last();
  assert.equal(state(msg).stage,'grapple-defend');
  await run('acceptAdvance(p)',{p:{messageId:msg.id,userId:'gm',step:'grapple-resist',choice:'roll',successes:1}});
  msg=last();
  assert.equal(state(msg).stage,'holding');
  assert.match(msg.content,/HOLD ESTABLISHED/);
  await run('acceptAdvance(p)',{p:{messageId:msg.id,userId:'gm',step:'grapple-escape',successes:3}});
  msg=last();
  assert.equal(state(msg).stage,'grapple-counter');
  await run('acceptAdvance(p)',{p:{messageId:msg.id,userId:'gm',step:'grapple-hold',successes:1}});
  msg=last();
  assert.equal(state(msg).stage,'grapple-free');
  assert.match(msg.content,/HOLD ESCAPED/);
  await run('acceptStart(p)',{p:{attackerUuid:'Actor.a',targetUuid:'Actor.t',userId:'gm',successes:2,maneuver:'hold'}});
  msg=last();
  await run('acceptAdvance(p)',{p:{messageId:msg.id,userId:'gm',step:'grapple-resist',choice:'none',successes:0}});
  msg=last();assert.equal(state(msg).stage,'holding');
  await run('acceptAdvance(p)',{p:{messageId:msg.id,userId:'gm',step:'grapple-release'}});
  msg=last();assert.equal(state(msg).stage,'grapple-free');
  assert.match(msg.content,/HOLD RELEASED/);
  await run('acceptStart(p)',{p:{attackerUuid:'Actor.a',targetUuid:'Actor.t',userId:'gm',successes:0,maneuver:'strike',combo:{count:2,index:1,pools:[3,3]}}});
  msg=last();const first=msg;
  assert.equal(state(msg).stage,'miss');
  assert.match(msg.content,/Next Attack/);
  await run('acceptContinue(p)',{p:{messageId:msg.id,userId:'gm',index:2,targetUuid:'Actor.t',successes:2}});
  assert.equal(state(first).combo.continued,true);
  assert.doesNotMatch(first.content,/Next Attack/);
  msg=last();
  assert.equal(state(msg).combo.index,2);
  assert.equal(state(msg).stage,'defense');
  await assert.rejects(run('acceptContinue(p)',{p:{messageId:first.id,userId:'gm',index:2,targetUuid:'Actor.t',successes:2}}),/cannot be continued/);
  console.log('PASS: distinct Grapple dialog, native ranged modes/ammo, split attack, hold/resist/escape/release, chat state');
})().catch(e=>{console.error(e);process.exitCode=1;});
