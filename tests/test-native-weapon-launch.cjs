/* Foundry v14 WoD20 weapon launcher regression: no duplicate native rolls. */
const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict"),path=require("node:path");
const source=fs.readFileSync(path.join(__dirname,"../scripts/combat-workflow.js"),"utf8");
const calls=[],started=[],errors=[];
const gm={id:"gm",isGM:true,active:true};
const player={id:"p1",isGM:false,active:true};
const targets=new Set([{id:"enemy",actor:{id:"target"}}]);
const items=[
  {id:"sword",name:"Sword",type:"Melee Weapon",system:{attack:{isrollable:true}}},
  {id:"gun",name:"Gun",type:"Ranged Weapon",system:{attack:{isrollable:true}}},
  {id:"hold",name:"Grapple",type:"Melee Weapon",system:{attack:{isrollable:true}}},
  {id:"damage",name:"Damage Only",type:"Melee Weapon",system:{attack:{isrollable:false}}},
  {id:"armor",name:"Armor",type:"Armor",system:{}}
];
const actor={uuid:"Actor.abc",id:"abc",items:{get:id=>items.find(i=>i.id===id)},testUserPermission:()=>true};
const game={
  system:{id:"worldofdarkness"},user:{id:player.id,isGM:false,targets},
  users:{get:id=>[player,gm].find(u=>u.id===id),filter:fn=>[player,gm].filter(fn)},
  settings:{get:()=>true}
};
const ctx=vm.createContext({console,Math,Number,String,Promise,game,
  Hooks:{on(){},once(){}},
  ui:{notifications:{warn:m=>errors.push(m),error:m=>errors.push(m)}},
  document:{addEventListener(){}},
  foundry:{applications:{api:{DialogV2:{input:async opts=>opts}}}}
});
vm.runInContext(source,ctx);
vm.runInContext("DiceRoller=async()=>2; open=async (opts)=>{ started.push(opts); };",Object.assign(ctx,{started}));
const original=async (...args)=>{calls.push(args);return "native-dialog";};
const Helper={RollDialog:original};
ctx.Helper=Helper;ctx.actor=actor;
const launch=(dataset,which=actor)=>Helper.RollDialog(dataset,which);
const weapon=(object,itemid)=>({rollitem:"true",object,itemid});
(async()=>{
  assert.equal(vm.runInContext("installNativeWeaponLauncher(Helper)",ctx),true);
  assert.equal(vm.runInContext("installNativeWeaponLauncher(Helper)",ctx),true);
  assert.notEqual(Helper.RollDialog,original);
  assert.equal(Helper.RollDialog.__stlCombatWorkflowWrapped,true);
  await launch(weapon("Melee","sword"));
  assert.equal(started.length,1);
  assert.equal(started.at(-1).weaponId,"sword");
  assert.equal(started.at(-1).attackerActor,actor);
  assert.equal(calls.length,0,"No extra WoD20 native dialog or roll when workflow handles attack");
  await launch(weapon("Ranged","gun"));
  assert.equal(started.at(-1).weaponId,"gun");
  assert.equal(started.length,2);
  for (const data of [
    weapon("Damage","sword"),weapon("Item","sword"),weapon("Melee","hold"),
    weapon("Melee","damage"),weapon("Melee","armor"),weapon("Ranged","sword"),
    weapon("Melee","missing"),{rollitem:"false",object:"Melee",itemid:"sword"}
  ]) assert.equal(await launch(data),"native-dialog");
  assert.equal(calls.length,8);
  assert.equal(started.length,2);
  targets.clear();
  assert.equal(await launch(weapon("Melee","sword")),"native-dialog","No target: preserve native roll");
  targets.add({id:"target"});targets.add({id:"second"});
  assert.equal(await launch(weapon("Melee","sword")),"native-dialog","Multiple targets: preserve native roll");
  targets.clear();targets.add({id:"target"});
  game.settings.get=()=>false;
  assert.equal(await launch(weapon("Melee","sword")),"native-dialog","Client can disable automatic launch");
  game.settings.get=()=>true;
  gm.active=false;
  assert.equal(await launch(weapon("Melee","sword")),"native-dialog","No GM: preserve native attack");
  gm.active=true;
  actor.testUserPermission=()=>false;
  assert.equal(await launch(weapon("Melee","sword")),"native-dialog","No owner: preserve native attack");
  actor.testUserPermission=()=>true;
  const selected=await vm.runInContext('promptFields("Attack",[{name:"weapon",label:"Weapon",type:"select",selectedValue:"gun",options:[{value:"",label:"Unarmed Strike"},{value:"gun",label:"Gun"}]}])',ctx);
  assert.match(selected.content,/<option value="gun" selected>Gun<\/option>/);
  assert.doesNotMatch(selected.content,/<option value="" selected>/);
  // If a new workflow fails, do not fire the native attack after it.
  vm.runInContext('open=async()=>{throw new Error("simulated workflow error");};',ctx);
  const before=calls.length;
  await launch(weapon("Melee","sword"));
  assert.equal(calls.length,before,"Never retry as native after possible attack roll");
  assert.match(errors.at(-1),/could not start/);
  console.log("PASS: native WoD20 weapon attack opens preselected Combat Workflow once; damage/other roll passthrough; user opt-out and safe fallbacks");
})().catch(e=>{console.error(e);process.exitCode=1;});
