/* Foundry v14 Token HUD mock checks. No browser/session verification. */
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../scripts/combat-workflow.js"), "utf8");
const hooks = new Map(), warnings = [], emitted = [];
const actor = {
  id:"melee", type:"Mortal", documentName:"Actor", name:"Melee Attacker",
  system:{settings:{splat:"mortal"},attributes:{dexterity:{total:3}},health:{damage:{woundpenalty:0}}},
  items:{get:()=>null,find:()=>null,filter:()=>[]},api:{getAbility:()=>({system:{value:2}})},
  testUserPermission:user=>user.id==="player" || user.isGM
};
const tokenDoc = {uuid:"Scene.one.Token.melee",actor};
const target = {name:"Target",actor:{id:"defender"},document:{uuid:"Scene.one.Token.defender"}};
const users = [
  {id:"player",isGM:false,active:true},
  {id:"gm",isGM:true,active:true}
];
const ctx=vm.createContext({
  console, Math, Number, String, Promise,
  Hooks:{on:(name,cb)=>hooks.set(name,cb),once:(name,cb)=>hooks.set(name,cb)},
  game:{
    system:{id:"worldofdarkness"},
    user:{id:"player",isGM:false,targets:new Set([target])},
    users:{get:id=>users.find(user=>user.id===id),filter:()=>users},
    socket:{emit:(channel,payload)=>emitted.push({channel,payload})}
  },
  canvas:{tokens:{controlled:[]}},
  CONFIG:{worldofdarkness:{successesToDamageRolls:true}},
  foundry:{utils:{randomID:()=>"nonce"},applications:{api:{DialogV2:{input:async()=>({weapon:"",difficulty:"0",modifier:"0",damageOverride:""})}}}},
  ui:{notifications:{warn:message=>warnings.push(message)}},
  document:{addEventListener:()=>{},createElement:tag=>({
    tag,attributes:{},listeners:{},className:"",innerHTML:"",
    setAttribute(key,value){this.attributes[key]=value;},
    addEventListener(name,fn){this.listeners[name]=fn;}
  })}
});
vm.runInContext(source,ctx);
function hudFixture({doc=tokenDoc,owned=true}={}){
  const nativeCombat={insertAdjacentElement(where,btn){
    assert.equal(where,"afterend"); container.button=btn; container.position="after-combat";
  }};
  const container={button:null,position:null,
    querySelector:selector=>selector==='button[data-action="combat"]'?nativeCombat:null,
    appendChild(btn){this.button=btn;this.position="append";}
  };
  const root={querySelector:selector=>{
    if(selector===".stl-combat-hud-button")return container.button;
    if(selector===".col.right")return container;
    return null;
  }};
  return {hud:{document:doc},root,container};
}
assert.equal(typeof hooks.get("renderTokenHUD"),"function");
assert.equal(hooks.has("getSceneControlButtons"),false);
{
  const {hud,root,container}=hudFixture();
  assert.equal(vm.runInContext("addTokenHudCombatButton(hud,root)",Object.assign(ctx,{hud,root})),true);
  assert.equal(container.position,"after-combat");
  assert.match(container.button.className,/control-icon stl-combat-hud-button/);
  assert.match(container.button.innerHTML,/meleeweapons\.svg/);
  assert.match(container.button.title,/Attack/);
  assert.match(container.button.attributes["aria-label"],/Attack/);
  assert.equal(typeof container.button.listeners.click,"function");
  assert.equal(vm.runInContext("addTokenHudCombatButton(hud,root)",ctx),false,"No duplicate controls");
}
{
  const denied={...tokenDoc,actor:{...actor,testUserPermission:()=>false}};
  const f=hudFixture({doc:denied});
  ctx.hud=f.hud;ctx.root=f.root;
  assert.equal(vm.runInContext("addTokenHudCombatButton(hud,root)",ctx),false,"Unowned tokens get no player HUD button");
}
(async()=>{
  vm.runInContext("DiceRollContainer=class {constructor(actor){this.actor=actor;}}; DiceRoller=async()=>3;",ctx);
  await vm.runInContext("open({attackerToken:tokenDoc})",Object.assign(ctx,{tokenDoc}));
  assert.equal(emitted.length,1,"Attack launched without selecting a token");
  assert.equal(emitted[0].payload.attackerUuid,"Scene.one.Token.melee","Attack bound to HUD token UUID");
  assert.equal(emitted[0].payload.targetUuid,"Scene.one.Token.defender");
  assert.equal(warnings.length,0);
  const f=hudFixture();
  hooks.get("renderTokenHUD")(f.hud,f.root);
  assert.ok(f.container.button);
  ctx.calledWithToken=null;
  vm.runInContext("open = async ({attackerToken}) => { calledWithToken = attackerToken; };",ctx);
  let prevented=false,stopped=false;
  f.container.button.listeners.click({preventDefault(){prevented=true;},stopPropagation(){stopped=true;}});
  await Promise.resolve();
  assert.equal(ctx.calledWithToken,tokenDoc,"HUD click uses its own token");
  assert.ok(prevented && stopped);
  console.log("PASS: Foundry v14 HUD injection, dedupe, permissions, native attack icon, token-context launch, no left toolbar");
})().catch(e=>{console.error(e);process.exitCode=1;});
