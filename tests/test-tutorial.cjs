/* Mock regression for the per-player, non-blocking first-login quick tutorial. */
const fs=require("node:fs"),vm=require("node:vm"),assert=require("node:assert/strict"),path=require("node:path");
const js=fs.readFileSync(path.join(__dirname,"../scripts/tutorial.js"),"utf8");
const css=fs.readFileSync(path.join(__dirname,"../styles/tutorial.css"),"utf8");
const hooks=new Map(),flags=new Map(),timers=[],alerts=[],instances=[];
const createEl=tag=>({
  tag,children:[],listeners:{},attributes:{},textContent:"",innerHTML:"",hidden:false,disabled:false,dataset:{},
  addEventListener(type,fn){this.listeners[type]=fn;},
  appendChild(child){this.children.push(child);child.parentElement=this;return child;},
  setAttribute(key,value){this.attributes[key]=value;}
});
let active=null;
function makeTutorialRoot(){
  const elements=new Map([
    [".stl-combat-tutorial-progress",createEl("div")],
    [".stl-combat-tutorial-title",createEl("h3")],
    [".stl-combat-tutorial-body",createEl("div")],
    ['[data-stl-tutorial-action="back"]',createEl("button")],
    ['[data-stl-tutorial-action="next"]',createEl("button")],
    ['[data-stl-tutorial-action="dismiss"]',createEl("button")]
  ]);
  return {listeners:{},elements,addEventListener(n,fn){this.listeners[n]=fn;},querySelector:q=>elements.get(q)};
}
class DialogMock {
  constructor(spec){this.spec=spec;this.root=makeTutorialRoot();instances.push(this);}
  async render(){active=this;this.element={querySelector:q=>q===".stl-combat-tutorial"?this.root:null};}
  async close(){this.closed=true;active=null;}
}
const game={system:{id:"worldofdarkness"},user:{
  getFlag:(mod,key)=>flags.get(mod+"."+key),
  async setFlag(mod,key,value){flags.set(mod+"."+key,value);}
}};
const ctx=vm.createContext({
  console,Promise,game,
  Hooks:{on:(n,fn)=>hooks.set(n,fn),once:(n,fn)=>hooks.set(n,fn)},
  foundry:{applications:{api:{DialogV2:DialogMock}}},
  ui:{notifications:{warn:m=>alerts.push(m)}},
  document:{querySelector:q=>q===".stl-combat-tutorial"?active?.root:null,createElement:createEl},
  queueMicrotask:fn=>fn(),setTimeout:fn=>timers.push(fn)
});
vm.runInContext(js,ctx);
assert.equal(typeof hooks.get("ready"),"function");
assert.equal(typeof hooks.get("renderTokenHUD"),"function");
assert.match(css,/\.stl-combat-tutorial-controls/);
assert.match(css,/\.stl-token-actions-help/);
const click=(root,action)=>root.listeners.click({
  target:{closest:()=>({dataset:{stlTutorialAction:action}})},
  preventDefault(){}
});
(async()=>{
  hooks.get("ready")();
  assert.equal(timers.length,1,"first-login delayed until Foundry ready");
  timers.shift()();
  await new Promise(setImmediate);
  assert.equal(instances.length,1);
  let dlg=instances.at(-1),root=dlg.root,query=q=>root.querySelector(q);
  assert.equal(query(".stl-combat-tutorial-title").textContent,"Start from your token");
  assert.equal(query('[data-stl-tutorial-action="back"]').disabled,true);
  assert.equal(query('[data-stl-tutorial-action="dismiss"]').hidden,true);
  assert.equal(dlg.spec.buttons[0].label,"Close for now");
  await click(root,"next");
  assert.equal(query(".stl-combat-tutorial-title").textContent,"Attack");
  await click(root,"next");
  assert.equal(query(".stl-combat-tutorial-title").textContent,"Grapple");
  await click(root,"next");
  assert.equal(query(".stl-combat-tutorial-title").textContent,"Follow the chat");
  assert.equal(query('[data-stl-tutorial-action="next"]').hidden,true);
  assert.equal(query('[data-stl-tutorial-action="dismiss"]').hidden,false);
  await click(root,"dismiss");
  assert.equal(flags.get("stl-combat-workflow.tutorialDismissed"),true);
  assert.equal(dlg.closed,true);
  hooks.get("ready")();timers.shift()();
  await new Promise(setImmediate);
  assert.equal(instances.length,1,"dismissed users do not see tour on a later login");
  // The small replay link is part of the expanded flyout, not a new HUD column.
  const menu=createEl("div");
  menu.hidden=false;
  const actionButton=createEl("button");
  const hudParent={querySelector:q=>q===".stl-token-actions-button"?actionButton:null};
  menu.parentElement=hudParent;
  menu.querySelector=q=>q===".stl-token-actions-help"?menu.children.find(x=>x.className==="stl-token-actions-help"):null;
  const hudRoot={querySelector:q=>q===".stl-token-actions-menu"?menu:null};
  hooks.get("renderTokenHUD")({document:{}},hudRoot);
  assert.equal(menu.children.length,1);
  assert.match(menu.children[0].textContent,/Quick tutorial/);
  hooks.get("renderTokenHUD")({},hudRoot);
  assert.equal(menu.children.length,1,"rerender must not duplicate help");
  let stopped=false;
  menu.children[0].listeners.click({preventDefault(){},stopPropagation(){stopped=true;}});
  await new Promise(setImmediate);
  assert.equal(stopped,true);
  assert.equal(menu.hidden,true);
  assert.equal(actionButton.attributes["aria-expanded"],"false");
  assert.equal(instances.length,2,"tutorial reopens even after Don't show again");
  assert.equal(alerts.length,0);
  // Closing the replay does not clear the dismissed flag.
  await instances[1].close();
  assert.equal(flags.get("stl-combat-workflow.tutorialDismissed"),true);
  console.log("PASS: first-login tutorial, four screens, final per-user Don't show again, HUD help replay, no duplicate controls");
})().catch(err=>{console.error(err);process.exitCode=1;});
