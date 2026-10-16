/* Node mock: one Token HUD Actions flyout, independent Combat/Magick launchers. */
const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict"),path=require("node:path");
const src=fs.readFileSync(path.join(__dirname,"../scripts/combat-workflow.js"),"utf8");
const css=fs.readFileSync(path.join(__dirname,"../styles/combat-workflow.css"),"utf8");
const hooks=new Map(), alerts=[];
const actor={id:"attacker",uuid:"Actor.attacker",name:"Mage",documentName:"Actor",
  testUserPermission:user=>user.id==="player"||user.isGM};
const doc={id:"t1",uuid:"Scene.one.Token.attacker",actor};
const magickCalls=[];
const mod={active:true,api:{openPanel:async a=>{magickCalls.push(a);}}};
const users=[{id:"player",active:true,isGM:false},{id:"gm",active:true,isGM:true}];
function el(tag) {
  return {tag,children:[],listeners:{},attributes:{},hidden:false,className:"",innerHTML:"",
    appendChild(node){this.children.push(node);return node;},
    setAttribute(k,v){this.attributes[k]=v;},
    addEventListener(k,fn){this.listeners[k]=fn;},
    focus(){this.focused=true;}
  };
}
const game={
  system:{id:"worldofdarkness"},
  user:{id:"player",isGM:false},
  users:{get:id=>users.find(u=>u.id===id),filter:fn=>users.filter(fn)},
  modules:{get:id=>id==="wod20-player-actions"?mod:null}
};
const ctx=vm.createContext({console,Math,Number,String,Promise,Hooks:{
  on:(n,cb)=>hooks.set(n,cb),once:(n,cb)=>hooks.set(n,cb)
},game,document:{createElement:el,addEventListener:()=>{}},ui:{notifications:{warn:m=>alerts.push(m),error:m=>alerts.push(m)}},});
vm.runInContext(src,ctx);
const evaluate=(s,values={})=>vm.runInContext(s,Object.assign(ctx,values));
assert.equal(hooks.has("getSceneControlButtons"),false,"old sidebar shield removed");
assert.equal(typeof hooks.get("renderTokenHUD"),"function");
assert.match(css,/.stl-token-actions-menu\[hidden\]/);
assert.match(css,/position: absolute/,"flyout must not create six-column HUD");
function fixture(actorDoc=doc) {
  const container=el("div");
  const native=el("button");
  native.insertAdjacentElement=(pos,node)=>{assert.equal(pos,"afterend");container.anchor=node;};
  container.querySelector=q=>q==='button[data-action="combat"]'?native:null;
  const root={querySelector(q) {
    if(q===".stl-token-actions-anchor")return container.anchor||null;
    if(q===".col.right")return container;
    return null;
  }};
  return {hud:{document:actorDoc},root,container};
}
function event(key) {return {key,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;}};}
(async()=>{
  const f=fixture();
  assert.equal(evaluate("addTokenHudActionsButton(hud,root)",f),true);
  const anchor=f.container.anchor;
  const button=anchor.children[0];
  const menu=anchor.children[1];
  assert.equal(anchor.className,"control-icon stl-token-actions-anchor");
  assert.equal(button.className,"stl-token-actions-button");
  assert.match(button.innerHTML,/fa-bolt/);
  assert.equal(button.attributes["aria-expanded"],"false");
  assert.equal(menu.hidden,true);
  assert.equal(menu.children.length,2);
  assert.match(menu.children[0].innerHTML,/Combat/);
  assert.match(menu.children[1].innerHTML,/Magick/);
  assert.equal(evaluate("addTokenHudActionsButton(hud,root)",f),false,"dedupe rerender");
  anchor.getBoundingClientRect=()=>({left:200,top:500,width:30,height:30});
  menu.getBoundingClientRect=()=>({width:172,height:92});
  menu.style={};menu.classList={toggle(k,v){this.flip=v;}};
  ctx.window={innerWidth:900,innerHeight:800};
  const openMenu=event();
  button.listeners.click(openMenu);
  assert.equal(menu.hidden,false);
  assert.equal(button.attributes["aria-expanded"],"true");
  assert.equal(menu.style.top,"-31px","flyout centered on clicked button rather than HUD top");
  assert.equal(menu.classList.flip,false);
  assert.ok(openMenu.stopped&&openMenu.prevented);
  ctx.captured=null;
  evaluate('open=async args=>{captured=args;}');
  menu.children[0].listeners.click(event());
  await new Promise(setImmediate);
  assert.equal(ctx.captured.attackerToken,doc,"Combat receives right-clicked token");
  assert.equal(menu.hidden,true);
  button.listeners.click(event());
  menu.children[1].listeners.click(event());
  await new Promise(setImmediate);
  assert.equal(magickCalls.length,1,"Magick calls existing Player Actions");
  assert.equal(magickCalls[0],actor,"Magick receives right-clicked Actor");
  assert.equal(menu.hidden,true);
  button.listeners.click(event());
  menu.listeners.keydown(event("Escape"));
  assert.equal(menu.hidden,true);
  assert.equal(button.focused,true);
  const unowned=fixture({...doc,actor:{...actor,testUserPermission:()=>false}});
  assert.equal(evaluate("addTokenHudActionsButton(hud,root)",unowned),false,"unowned actor hidden");
  mod.active=false;
  const noMagick=fixture();
  assert.equal(evaluate("addTokenHudActionsButton(hud,root)",noMagick),true);
  assert.equal(noMagick.container.anchor.children[1].children.length,1,"no dead Magick option");
  mod.active=true;
  mod.api=null;
  const noApi=fixture();
  assert.equal(evaluate("addTokenHudActionsButton(hud,root)",noApi),true);
  assert.equal(noApi.container.anchor.children[1].children.length,1,"requires published openPanel API");
  game.user={id:"gm",isGM:true};
  const gmNpc=fixture({...doc,actor:{...actor,testUserPermission:()=>false}});
  assert.equal(evaluate("addTokenHudActionsButton(hud,root)",gmNpc),true,"GM can open NPC menu");
  assert.equal(alerts.length,0);
  console.log("PASS: single Token HUD Actions flyout, Combat token binding, Magick Actor binding, availability, accessibility, owners/GM");
})().catch(error=>{console.error(error);process.exitCode=1;});
