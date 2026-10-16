/* Foundry user colors for the acting character's single-name turn banner. Mock test. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../scripts/combat-workflow.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../styles/combat-workflow.css'),'utf8');
const defender={id:'def',uuid:'Actor.def',documentName:'Actor',name:'Defender',ownership:{blue:3},testUserPermission:(u)=>u.id==='blue'};
const attacker={id:'atk',uuid:'Actor.atk',documentName:'Actor',name:'Attacker',ownership:{red:3},testUserPermission:(u)=>u.id==='red'};
const users=[
  {id:'gm',isGM:true,active:true,color:'#888888'},
  {id:'red',isGM:false,active:true,color:{css:'#b02030'},character:{id:'atk'}},
  {id:'blue',isGM:false,active:true,color:'#93c',character:{id:'def'}}
];
const ctx=vm.createContext({console,Math,Number,String,Promise,Hooks:{on(){},once(){}},
 game:{user:users[0],users:{filter:fn=>users.filter(fn),get:id=>users.find(x=>x.id===id)}},
 ChatMessage:{getSpeaker:({actor})=>({alias:actor.name}),create:async data=>data},
 fromUuid:async id=>({'Actor.def':defender,'Actor.atk':attacker})[id]});
vm.runInContext(src,ctx);
const run=script=>vm.runInContext(script,ctx);
const base={attackerUuid:'Actor.atk',targetUuid:'Actor.def',attackerName:'Attacker',targetName:'Defender',weaponName:'Knife',damageType:'lethal',attackSuccesses:2,stage:'defense',finalDamage:null};
assert.equal(run("normalizedPlayerColor('#abc')"),'#aabbcc');
assert.equal(run("normalizedPlayerColor('#112233aa')"),'#112233');
assert.equal(run("normalizedPlayerColor('red; background:url(x)')"),null);
assert.match(run("playerTurnStyle({color:'#010203'})"),/--stl-turn-text:#ffffff/);
assert.match(run("playerTurnStyle({color:'#f0f0f0'})"),/--stl-turn-text:#141414/);
assert.match(run("playerTurnStyle({color:'not-a-color'})"),/--stl-turn-color:#444c55/);
ctx.actor=attacker;assert.equal(run("actingUser(actor).id"),'red');
ctx.actor=defender;assert.equal(run("actingUser(actor).id"),'blue');
ctx.actor={id:'npc',ownership:{},testUserPermission:()=>false};assert.equal(run("actingUser(actor).id"),'gm');
ctx.state=base;
(async()=>{
  const defense=await run("makeMessage(state)");
  assert.equal(defense.speaker.alias,'Defender');
  assert.match(defense.content,/--stl-turn-color:#9933cc/);
  assert.match(defense.content,/>Defender Roll<\/strong>/);
  assert.doesNotMatch(defense.content,/DEFENDER.S TURN|Choose Dodge/);
  ctx.state={...base,stage:'damage'};
  const damage=await run("makeMessage(state)");
  assert.equal(damage.speaker.alias,'Attacker');
  assert.match(damage.content,/--stl-turn-color:#b02030/);
  assert.match(damage.content,/>Attacker Roll<\/strong>/);
  assert.doesNotMatch(damage.content,/ATTACKER.S TURN|Roll damage for/);
  ctx.state={...base,stage:'soak'};
  const soak=await run("makeMessage(state)");
  assert.match(soak.content,/--stl-turn-color:#9933cc/);
  assert.match(soak.content,/>Defender Roll<\/strong>/);
  ctx.state={...base,stage:'resolved',finalDamage:2};
  const gm=await run("makeMessage(state)");
  assert.match(gm.content,/--stl-turn-color:#888888/);
  assert.match(gm.content,/>Storyteller<\/strong>/);
  ctx.state={...base,stage:'done',finalDamage:0};
  const done=await run("makeMessage(state)");
  assert.doesNotMatch(done.content,/stl-combat-turn-name/);
  assert.match(css,/var\(--stl-turn-color/);
  assert.doesNotMatch(css,/stl-combat-turn-role|stl-combat-turn-action/);
  console.log('PASS: compact actor-name banner, assigned player colors, GM fallback and readable text');
})().catch(error=>{console.error(error);process.exitCode=1;});
