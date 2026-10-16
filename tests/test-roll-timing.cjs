/* Mock contract for WoD20 chat creation and Dice So Nice completion. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../scripts/combat-workflow.js'),'utf8');
const listeners=new Map();
const Hooks={
 on(name,fn){if(!listeners.has(name))listeners.set(name,new Set());listeners.get(name).add(fn);},
 off(name,fn){listeners.get(name)?.delete(fn);},
 once(){},
 fire(name,...args){for(const fn of listeners.get(name)??[])fn(...args);}
};
let animationEnd;
const animation=new Promise(resolve=>animationEnd=resolve);
const ctx=vm.createContext({console,Math,Number,String,Promise,setTimeout,clearTimeout,Hooks,
 game:{user:{id:'player'},modules:new Map([['dice-so-nice',{active:true}]]),dice3d:{
  waitFor3DAnimationByMessageID:id=>{assert.equal(id,'native-roll');return animation;}
 }}});
vm.runInContext(source,ctx);
ctx.actor={id:'actor-1'};
(async()=>{
 let finished=false;
 const wait=vm.runInContext('awaitNativeRollDisplay(actor,async()=>7)',ctx).then(result=>{finished=true;return result;});
 await new Promise(setImmediate);
 assert.equal(finished,false,'must wait for native chat');
 Hooks.fire('createChatMessage',{id:'unrelated',speaker:{actor:'actor-2'},rolls:[{}]}, {},'player');
 await new Promise(setImmediate);
 assert.equal(finished,false,'must match actor');
 Hooks.fire('createChatMessage',{id:'native-roll',speaker:{actor:'actor-1'},rolls:[{}]}, {},'player');
 await new Promise(setImmediate);
 assert.equal(finished,false,'must wait for Dice So Nice animation');
 animationEnd();
 assert.equal(await wait,7);
 assert.equal(listeners.get('createChatMessage').size,0);
 ctx.game.modules=new Map();
 const plain=vm.runInContext('awaitNativeRollDisplay(actor,async()=>2)',ctx);
 Hooks.fire('createChatMessage',{id:'native-2',speaker:{actor:'actor-1'},rolls:[{}]}, {},'player');
 assert.equal(await plain,2);
 console.log('PASS: native chat and Dice So Nice timing (mock)');
})().catch(e=>{console.error(e);process.exitCode=1;});
