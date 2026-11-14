/* GM-only combat stat review. Mock / static checks, not a live Foundry test. */
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path"),assert=require("node:assert/strict");
const src=fs.readFileSync(path.join(__dirname,"../scripts/combat-workflow.js"),"utf8");
const prompts=[],rolls=[],sent=[],notifications=[];
const gm={id:"gm",isGM:true,active:true},player={id:"p",isGM:false,active:true};
const punch={id:"punch",name:"Punch",type:"Melee Weapon",system:{
  attack:{isrollable:true,attribute:"dexterity",ability:"brawl",accuracy:0},
  damage:{attribute:"strength",bonus:0,type:"bashing"},difficulty:6}};
const cat={documentName:"Actor",id:"cat",uuid:"Actor.cat",name:"Catfiend",type:"Creature",
  system:{settings:{variant:"general",splat:"creature"},
    attributes:{dexterity:{total:1,value:1},strength:{total:4},stamina:{total:3}},
    abilities:{brawl:{value:0},athletics:{value:0},melee:{value:0}},
    health:{damage:{woundpenalty:0}},soak:{bashing:3,lethal:3,aggravated:0}},
  items:{get:id=>id==="punch"?punch:null,find:()=>null,filter:fn=>[punch].filter(fn)},
  testUserPermission:()=>true};
const target={id:"t",name:"Target",actor:{id:"target"},document:{uuid:"Token.target"}};
const targets=new Set([target]);
const game={system:{id:"worldofdarkness"},user:gm,
  users:{get:id=>[gm,player].find(x=>x.id===id),filter:fn=>[gm,player].filter(fn)},
  settings:{get:()=>true},messages:{get:()=>null}};
let promptAnswer=async()=>({});
const ctx=vm.createContext({console,Math,Number,String,Promise,game,
  CONFIG:{worldofdarkness:{successesToDamageRolls:true,defaultAutoAmmo:false}},
  foundry:{utils:{randomID:()=>"nonce"}},
  Hooks:{on(){},once(){}},document:{addEventListener(){}},
  canvas:{tokens:{controlled:[]}},
  ui:{notifications:{warn:m=>notifications.push(m),error:m=>notifications.push(m)}},
  fromUuid:async id=>id==="Actor.cat"?cat:null,
  ChatMessage:{getSpeaker:()=>({})}});
vm.runInContext(src,ctx);
Object.assign(ctx,{cat,punch,gm,player,prompts,rolls,sent});
ctx.promptHook=async (title,fields,label)=>{
  prompts.push({title,fields,label});return promptAnswer(title,fields,label);
};
vm.runInContext(
  'DiceRoller=async()=>1;'+
  'promptFields=async(title,fields,label)=>promptHook(title,fields,label);'+
  'nativeRoll=async(actor,options)=>{rolls.push({actor,options});return 2;};'+
  'send=payload=>sent.push(payload);',ctx);
const run=code=>vm.runInContext(code,ctx);
(async()=>{
  assert.equal(run("attackData(cat,punch).pool"),1,"Initial Catfiend pool is Dexterity 1 + Brawl 0");
  promptAnswer=async()=>({attr:"3",ability:"2"});
  const reviewed=await run('reviewGMCombatPool(cat,{pool:1,attribute:"dexterity",ability:"brawl",label:"Punch attack"})');
  assert.equal(reviewed.pool,5);
  assert.match(reviewed.note,/Dexterity 3/);
  assert.match(reviewed.note,/Brawl 2/);
  assert.match(prompts.at(-1).fields[0].value,/Actor unchanged/);
  assert.equal(cat.system.attributes.dexterity.total,1);
  assert.equal(cat.system.abilities.brawl.value,0);
  promptAnswer=async()=>({attr:"1",ability:"0"});
  assert.equal((await run('reviewGMCombatPool(cat,{pool:1,attribute:"dexterity",ability:"brawl"})')).pool,1,
    "The GM may accept a legitimate zero");
  cat.system.abilities.brawl.value=3;
  let before=prompts.length;
  assert.equal((await run('reviewGMCombatPool(cat,{pool:4,attribute:"dexterity",ability:"brawl"})')).pool,4);
  assert.equal(prompts.length,before,"No prompt for rated Abilities");
  cat.system.abilities.brawl.value=0;
  const spirit={type:"Creature",name:"Unfinished Spirit",system:{settings:{variant:"spirit"},
    advantages:{willpower:{},rage:{permanent:3}}}};
  ctx.spirit=spirit;
  promptAnswer=async()=>({rating:"6"});
  assert.equal((await run('reviewGMCombatPool(spirit,{pool:null,spiritKey:"willpower"})')).pool,6);
  assert.equal(spirit.system.advantages.willpower.permanent,undefined,"Spirit Actor must remain unchanged");
  const missingSoak={type:"Creature",name:"NPC",system:{settings:{},soak:{}}};
  ctx.missingSoak=missingSoak;
  promptAnswer=async()=>({pool:"4"});
  assert.equal((await run('reviewGMCombatPool(missingSoak,{pool:0,totalMissing:true,label:"lethal soak"})')).pool,4);
  assert.equal(missingSoak.system.soak.lethal,undefined);
  promptAnswer=async()=>({attr:"-2",ability:"4"});
  assert.equal(await run('reviewGMCombatPool(cat,{pool:1,attribute:"dexterity",ability:"brawl"})'),null);
  assert.match(notifications.at(-1),/whole numbers/);
  game.settings.get=(_module,key)=>key!=="reviewNpcCombatStats";
  before=prompts.length;
  assert.equal((await run('reviewGMCombatPool(cat,{pool:1,attribute:"dexterity",ability:"brawl"})')).pool,1);
  assert.equal(prompts.length,before,"Client opt-out suppresses review");
  game.settings.get=()=>true;
  game.user=player;
  assert.equal((await run('reviewGMCombatPool(cat,{pool:1,attribute:"dexterity",ability:"brawl"})')).pool,1);
  assert.equal(prompts.length,before,"Player cannot get GM review");
  game.user=gm;
  promptAnswer=async(_title,fields)=>fields.some(f=>f.name==="weapon")
    ? {weapon:"punch",difficulty:"0",modifier:"0",damageOverride:"",attacks:"1",fireMode:"single"}
    : {attr:"3",ability:"2"};
  game.user.targets=targets;
  await run('open({attackerActor:cat,weaponId:"punch"})');
  assert.equal(rolls.length,1);
  assert.equal(rolls[0].options.pool,5,"Native roll must use reviewed Dexterity+Brawl");
  assert.equal(rolls[0].options.attribute,"dexterity");
  assert.equal(rolls[0].options.ability,"brawl");
  assert.ok(rolls[0].options.extraInfo.some(x=>x.includes("GM confirmed temporary")));
  assert.equal(sent.length,1);
  assert.equal(sent[0].type,"start");
  assert.equal(cat.system.attributes.dexterity.total,1,"No attribute changes saved");
  assert.equal(cat.system.abilities.brawl.value,0,"No skill changes saved");
  cat.system.abilities.brawl.value=3;
  delete cat.system.attributes.dexterity;
  promptAnswer=async()=>({attr:"4",ability:"3"});
  assert.equal((await run('reviewGMCombatPool(cat,{pool:3,attribute:"dexterity",ability:"brawl"})')).pool,7);
  assert.equal(cat.system.attributes.dexterity,undefined);
  const pc={...cat,type:"PC"};ctx.pc=pc;
  before=prompts.length;
  assert.equal((await run('reviewGMCombatPool(pc,{pool:1,attribute:"dexterity",ability:"brawl"})')).pool,1);
  assert.equal(prompts.length,before,"PC needs no extra GM dialog");
  for(const snippet of ['label:action+" defense"','label:"grapple contest"',
    'label:"initial grapple"','label:"damage"','label:state.damageType+" soak"'])
    assert.ok(src.includes(snippet),"GM review entry point missing: "+snippet);
  console.log("PASS: GM temporary Dex/Brawl, legal zero, missing Spirit/soak, client isolation, and a real 5-die native Punch without Actor changes");
})().catch(e=>{console.error(e);process.exitCode=1;});
