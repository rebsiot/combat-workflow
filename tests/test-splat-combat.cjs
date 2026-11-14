/* WoD20 splat-aware combat mocks: not a live Foundry or rulebook certification. */
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../scripts/combat-workflow.js"),"utf8");
const damageTypes=["bashing","lethal","aggravated"];
const levels={bruised:0,hurt:-1,injured:-1,wounded:-2,mauled:-2,crippled:-5,incapacitated:-99};
function physical(type,splat,name,extra={}){
  const stats=Object.fromEntries(Object.entries(levels).map(([key,penalty])=>[key,{total:1,label:key,penalty}]));
  return {id:name,uuid:name,documentName:"Actor",name,type,updateCount:0,
    system:{settings:{splat,variant:"general",hasrage:false,hasgnosis:false},attributes:{dexterity:{total:3},strength:{total:3},stamina:{total:3}},
      health:{damage:{bashing:0,lethal:0,aggravated:0,woundpenalty:0,woundlevel:""},...stats},
      traits:{health:{totalhealthlevels:{max:7,value:7}}},soak:{bashing:3,lethal:3,aggravated:0}},
    api:{getAbility:key=>({system:{value:key==="brawl"?2:2}})},
    items:{get:()=>null,find:()=>null,filter:()=>[]},
    testUserPermission:()=>true,
    async update(changes){this.updateCount++;for(const [key,value] of Object.entries(changes)){
      const parts=key.split(".");let cur=this;while(parts.length>1)cur=cur[parts.shift()];cur[parts[0]]=value;
    }}};
}
function spirit(name,wp=6,rage=4,essence=14){
  return {id:name,uuid:name,documentName:"Actor",name,type:"Creature",updateCount:0,
    system:{settings:{splat:"creature",variant:"spirit",hasrage:true,hasgnosis:true},
      advantages:{willpower:{roll:wp,permanent:wp},rage:{roll:rage,permanent:rage},
        gnosis:{roll:5,permanent:5},essence:essence==null?{}:{temporary:essence,permanent:15,max:15}}},
    items:{get:()=>null,find:()=>null,filter:()=>[]},testUserPermission:()=>true,
    async update(changes){this.updateCount++;for(const [key,value] of Object.entries(changes)){
      const parts=key.split(".");let cur=this;while(parts.length>1)cur=cur[parts.shift()];cur[parts[0]]=value;
    }}};
}
const a=spirit("Umbrood"),b=physical("PC","mage","Mage");
const vamp=physical("Vampire","vampire","Kindred");
const wolf=physical("Werewolf","werewolf","Garou");
wolf.system.settings.hasrage=true;wolf.system.settings.hasgnosis=true;
wolf.system.advantages={rage:{roll:7},gnosis:{roll:5},willpower:{roll:6}};
wolf.system.settings.variant="crinos";
wolf.system.attributes.dexterity.total=6;
wolf.system.attributes.strength.total=8;
wolf.system.attributes.stamina.total=7;
wolf.system.soak.aggravated=5;
const other=physical("Creature","creature","Fomor");
const wraith=physical("Wraith","wraith","Ghost");
const missing=spirit("BadEssence",6,4,null);
const docs=Object.fromEntries([a,b,vamp,wolf,other,wraith,missing].map(actor=>[actor.uuid,actor]));
const messages=new Map();let seq=0;
const gm={id:"gm",isGM:true,active:true},player={id:"p1",isGM:false,active:true};
const ctx=vm.createContext({console,Math,Number,String,Promise,structuredClone,
  Hooks:{once(){},on(){}},document:{addEventListener(){}},
  CONFIG:{worldofdarkness:{successesToDamageRolls:true,woundLevels:Object.fromEntries(Object.keys(levels).map(k=>[k,true]))}},
  game:{system:{id:"worldofdarkness"},user:gm,
    users:{get:id=>[gm,player].find(u=>u.id===id),filter:fn=>[gm,player].filter(fn)},
    messages:{get:id=>messages.get(id)}},
  fromUuid:async id=>docs[id]||null,
  ChatMessage:{getSpeaker:({actor})=>({alias:actor.name}),create:async data=>{
    const msg={id:"m"+(++seq),content:data.content,flags:data.flags,
      getFlag(ns,key){return this.flags[ns][key];},
      async update(changes){this.content=changes.content;this.flags["stl-combat-workflow"].combat=changes["flags.stl-combat-workflow.combat"];},
      async delete(){messages.delete(this.id);}};
    messages.set(msg.id,msg);return msg;
  }},
  foundry:{utils:{deepClone:v=>structuredClone(v)}},ui:{notifications:{warn(){},error(){}}}
});
vm.runInContext(source,ctx);
const run=(code,vars={})=>vm.runInContext(code,Object.assign(ctx,vars));
const last=()=>[...messages.values()].at(-1);
const state=()=>last().getFlag("stl-combat-workflow","combat");
async function start(attacker,target,successes=4,override="") {
  await run('acceptStart(p)',{p:{attackerUuid:attacker.uuid,targetUuid:target.uuid,
    weaponId:null,userId:"gm",successes,damageOverride:override,maneuver:"strike"}});
  return state();
}
async function step(step,extras={}){
  const messageId=last().id;
  await run('acceptAdvance(p)',{p:{messageId,step,userId:"gm",...extras}});
  return state();
}
(async()=>{
  for (const sp of [a,missing]) {
    assert.equal(run('isSpirit(actor)',{actor:sp}),true);
    assert.equal(run('healthMode(actor)',{actor:sp}),sp===a?"essence":"manual");
  }
  for(const actor of [wolf,vamp,other,b]){
    assert.equal(run('isSpirit(actor)',{actor}),false,actor.name+" should use physical rules");
    assert.equal(run('healthMode(actor)',{actor}),"wounds");
  }
  assert.equal(run('healthMode(actor)',{actor:wraith}),"manual","Wraith Corpus must not receive normal wound writes");
  assert.equal(run('spiritTrait(actor,"gnosis")',{actor:a}),5);
  assert.equal(run('attackData(actor,null).pool',{actor:a}),6,"Spirit attacks with Willpower, not Dex+Brawl");
  assert.equal(run('attackData(actor,null).attribute',{actor:a}),"noselected");
  assert.equal(run('defaultDamagePool(actor,null,3).pool',{actor:a}),6,"Rage 4 plus two net-hit dice");
  assert.equal(run('defaultDamagePool(actor,null,3).attribute',{actor:a}),"noselected");
  assert.equal(run('defenseDice(actor,"dodge").pool',{actor:a}),6);
  assert.equal(run('defenseDice(actor,"block").pool',{actor:a}),6);
  assert.equal(run('soakDice(actor,"aggravated").pool',{actor:a}),6);
  assert.equal(run('grappleDice(actor,"start").pool',{actor:a}),6);
  assert.equal(run('grappleDice(actor,"contest").pool',{actor:a}),4);
  assert.equal(run('effectiveDamageType(null,defender,"",attacker)',{attacker:a,defender:b}),"lethal");
  assert.equal(run('effectiveDamageType(null,defender,"aggravated",attacker)',{attacker:a,defender:b}),"aggravated");
  const punch={name:"Punch",type:"Melee Weapon",system:{damage:{type:"bashing",attribute:"strength",bonus:0},attack:{accuracy:0}}};
  assert.equal(run('effectiveDamageType(punch,defender,"",attacker)',{punch,defender:b,attacker:a}),"lethal");
  assert.equal(run('attackData(actor,weapon).pool',{actor:a,weapon:punch}),6);
  assert.equal(run('defaultDamagePool(actor,weapon,2).pool',{actor:a,weapon:punch}),5);
  assert.equal(run('attackData(actor,null).pool',{actor:wolf}),8,"Garou Crinos Dex 6+Brawl 2");
  assert.equal(run('defaultDamagePool(actor,null,2).pool',{actor:wolf}),9,"Garou Crinos Str 8+extra 1");
  assert.equal(run('soakDice(actor,"aggravated").pool',{actor:wolf}),5);
  assert.equal(run('attackData(actor,null).pool',{actor:other}),5,"Other physical creature uses native Dex+Brawl");
  assert.equal(run('soakDice(actor,"bashing").pool',{actor:vamp}),3);
  const firearm={type:"Ranged Weapon",system:{attack:{ability:"firearms"},damage:{type:"lethal"}}};
  assert.equal(run('effectiveDamageType(weapon,defender,"",attacker)',{weapon:firearm,defender:vamp,attacker:b}),"bashing");
  assert.equal(run('effectiveDamageType(weapon,defender,"lethal",attacker)',{weapon:firearm,defender:vamp,attacker:b}),"lethal");
  assert.equal(run('isSpirit(actor)',{actor:{...wolf,system:{...wolf.system,settings:{...wolf.system.settings,variant:"spirit"}}}}),false,
    "A Werewolf with a spirit-related variant is still not automatically a Creature spirit");
  assert.equal(run('attackData(actor,null).pool',{actor:spirit("NoWill",null,4,10)}),null);
  assert.equal(run('defaultDamagePool(actor,null,1).pool',{actor:spirit("NoRage",6,null,10)}),null);
  assert.equal(run('woundPenalty(actor,"attack")',{actor:a}),0);
  run('CombatHelper={GetMaxHealthLevels:()=>7,ApplyDamageWithOverflow:(record,type,n)=>{record[type]+=n;return n;}}');
  // Spirit attacker -> Mage physical defender: native wound track, not attacker Essence.
  await start(a,b,4);
  assert.equal(state().damageType,"lethal");
  assert.equal(state().targetHealthMode,"wounds");
  await step("defense",{choice:"dodge",successes:1});
  await step("damage",{successes:3});
  await step("soak",{choice:"roll",successes:1});
  assert.equal(state().finalDamage,2);
  await step("apply");
  assert.equal(b.system.health.damage.lethal,2,"physical target health updated");
  assert.equal(a.system.advantages.essence.temporary,14,"attacking spirit Essence unchanged");
  await step("undo");
  assert.equal(b.system.health.damage.lethal,0);
  // Mage attacker -> Spirit target: native Essence and guarded undo.
  await start(b,a,4);
  assert.equal(state().targetHealthMode,"essence");
  assert.match(last().content,/Spirit target: GM can apply post-soak damage to Essence/);
  await step("defense",{choice:"dodge",successes:1});
  await step("damage",{successes:4});
  await step("soak",{choice:"roll",successes:2});
  assert.equal(state().finalDamage,2);
  assert.match(last().content,/Apply to Essence/);
  await step("apply");
  assert.equal(a.system.advantages.essence.temporary,12);
  assert.deepEqual(JSON.parse(JSON.stringify(state().undo)),{kind:"essence",before:14,after:12});
  assert.match(state().note,/Spirit Essence/);
  await step("undo");
  assert.equal(a.system.advantages.essence.temporary,14);
  assert.equal(state().undo,null);
  // Later Charm/external update invalidates the automatic undo.
  await start(b,a,3);
  await step("defense",{choice:"none",successes:0});
  await step("damage",{successes:2});
  await step("soak",{choice:"none",successes:0});
  await step("apply");
  assert.equal(a.system.advantages.essence.temporary,12);
  a.system.advantages.essence.temporary=11;
  await assert.rejects(()=>step("undo"),/Essence changed/);
  assert.equal(a.system.advantages.essence.temporary,11);
  // Missing Essence must never fall back to seven-level physical wounds.
  await start(b,missing,3);
  await step("defense",{choice:"none",successes:0});
  await step("damage",{successes:2});
  await step("soak",{choice:"none",successes:0});
  assert.equal(state().targetHealthMode,"manual");
  assert.doesNotMatch(last().content,/Apply to (Health|Essence)/);
  const beforeMissing=missing.updateCount;
  await assert.rejects(()=>step("apply"),/Essence|Health model/i);
  assert.equal(missing.updateCount,beforeMissing);
  await step("skip");
  assert.match(state().note,/Not applied/);
  // An older pre-v0.3.0 chat card must not silently start writing Spirit Essence.
  await start(b,a,3);
  await step("defense",{choice:"none",successes:0});
  await step("damage",{successes:2});
  await step("soak",{choice:"none",successes:0});
  delete state().targetHealthMode;
  await assert.rejects(()=>step("apply"),/Older combat card/);
  assert.equal(a.system.advantages.essence.temporary,11);
  console.log("PASS: Spirit Willpower/Rage/Essence, spirit-vs-Mage both ways, GM Apply/Undo safeguards, W20 form stats, V20 vampire and other native creatures");
})().catch(err=>{console.error(err);process.exitCode=1;});
