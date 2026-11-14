/* Regression: pressing Punch on a WoD20 Creature (Spirit) must not roll native Dex+Brawl. */
const assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const src=fs.readFileSync(path.join(__dirname,"../scripts/combat-workflow.js"),"utf8");
const errors=[],native=[],started=[];
const punch={id:"punch",name:"Punch",type:"Melee Weapon",system:{attack:{isrollable:true,accuracy:0}}};
const damageOnly={id:"damage",name:"Damage",type:"Melee Weapon",system:{attack:{isrollable:false}}};
const spirit={id:"captain",uuid:"Actor.captain",type:"Creature",name:"Captain Marsh",
  system:{settings:{variant:"spirit"},advantages:{
    willpower:{permanent:7,roll:1,temporary:7},
    rage:{permanent:5,roll:1,temporary:5},
    gnosis:{permanent:7,roll:1},essence:{temporary:5}}},
  testUserPermission:()=>true,
  items:{get:id=>[punch,damageOnly].find(x=>x.id===id)||null,filter:fn=>[punch,damageOnly].filter(fn),find:()=>null}};
const gm={id:"gm",active:true,isGM:true};
const player={id:"player",active:true,isGM:false};
const targets=new Set([{id:"defender",actor:{id:"target"},document:{uuid:"Token.target"}}]);
const game={user:{id:"player",isGM:false,targets},
  users:{get:id=>[player,gm].find(x=>x.id===id),filter:fn=>[player,gm].filter(fn)},
  settings:{get:()=>true},system:{id:"worldofdarkness"}};
const ctx=vm.createContext({console,game,Math,Number,String,Promise,
  CONFIG:{worldofdarkness:{successesToDamageRolls:true}},
  Hooks:{on(){},once(){}},foundry:{applications:{api:{DialogV2:{input:async o=>o}}}},
  ui:{notifications:{warn:m=>errors.push(m),error:m=>errors.push(m)}},
  document:{addEventListener(){}}});
vm.runInContext(src,ctx);
ctx.started=started;
vm.runInContext("DiceRoller=async()=>3;open=async opts=>{started.push(opts);};",ctx);
const Helper={RollDialog:async (...args)=>{native.push(args);return "native-roll-dialog";}};
ctx.Helper=Helper;
const launch=(d)=>Helper.RollDialog(d,spirit);
const weapon=(object,itemid)=>({rollitem:"true",object,itemid});
(async()=>{
  assert.equal(vm.runInContext('spiritTrait(spirit,"willpower")',Object.assign(ctx,{spirit})),7,
    "Use seven visible dots, not stale derived roll of one");
  assert.equal(vm.runInContext('spiritTrait(spirit,"rage")',ctx),5);
  assert.equal(vm.runInContext('attackData(spirit,punch).pool',Object.assign(ctx,{punch})),7);
  assert.equal(vm.runInContext('defaultDamagePool(spirit,punch,1).pool',ctx),5);
  assert.equal(vm.runInContext("installNativeWeaponLauncher(Helper)",ctx),true);
  await launch(weapon("Melee","punch"));
  assert.equal(started.length,1);
  assert.equal(started[0].weaponId,"punch");
  assert.equal(native.length,0);
  targets.clear();
  await launch(weapon("Melee","punch"));
  assert.equal(started.length,1,"No-target spirit must not enter a bogus roll");
  assert.equal(native.length,0,"No-target spirit must not fall back to Dex+Brawl");
  assert.match(errors.at(-1),/Target exactly one defender/);
  targets.add({id:"a"});targets.add({id:"b"});
  await launch(weapon("Melee","punch"));
  assert.equal(native.length,0,"Multiple targets must not roll wrong spirit pool");
  targets.clear();targets.add({id:"a"});
  gm.active=false;
  await launch(weapon("Melee","punch"));
  assert.equal(native.length,0,"Offline GM must not make spirit attack native");
  assert.match(errors.at(-1),/GM must be online/);
  gm.active=true;
  assert.equal(await launch(weapon("Damage","punch")),"native-roll-dialog");
  assert.equal(await launch(weapon("Melee","damage")),"native-roll-dialog");
  game.settings.get=()=>false;
  assert.equal(await launch(weapon("Melee","punch")),"native-roll-dialog",
    "Explicitly disabled client integration preserves original native action");
  game.settings.get=()=>true;
  // Real creature sheet uses an Element carrying data-rollitem and data-object.
  const handlers=[];
  const root={addEventListener:(kind,cb,capture)=>handlers.push({kind,cb,capture}),
    contains:node=>node===row};
  const row={dataset:weapon("Melee","punch")};
  const simulated={target:{closest:selector=>selector.includes(".vrollable")?row:null},
    prevented:0,stopped:0,
    preventDefault(){this.prevented++;},stopImmediatePropagation(){this.stopped++;},
    stopPropagation(){this.stopped++;}};
  ctx.root=root;
  assert.equal(vm.runInContext('captureSpiritWeaponSheet({actor:spirit},root)',ctx),true);
  assert.equal(vm.runInContext('captureSpiritWeaponSheet({actor:spirit},root)',ctx),false,"No duplicate event handlers");
  assert.equal(handlers.length,1);
  assert.equal(handlers[0].kind,"click");
  assert.equal(handlers[0].capture,true,"Must run before upstream native click handlers");
  handlers[0].cb(simulated);
  assert.equal(started.length,2);
  assert.equal(started.at(-1).weaponId,"punch");
  assert.equal(simulated.prevented,1);
  assert.ok(simulated.stopped>=1);
  targets.clear();
  const blocked={...simulated,prevented:0,stopped:0};
  handlers[0].cb(blocked);
  assert.equal(started.length,2);
  assert.equal(blocked.prevented,1);
  assert.match(errors.at(-1),/Target exactly one defender/);
  assert.equal(native.length,3,"Sheet safeguard must not invoke the native roller");
  console.log("PASS: Spirit Punch uses visible Willpower 7/Rage 5; targeted sheet interception; no-target/GM guard; explicit native opt-out");
})().catch(e=>{console.error(e);process.exitCode=1;});
