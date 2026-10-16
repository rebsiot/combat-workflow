// STL Combat Workflow 0.1.0. This module delegates all dice rolling to WoD20.
const MODULE = "stl-combat-workflow";
const CHANNEL = `module.${MODULE}`;
const BUTTON = "[data-stl-combat-action]";
const VALID_DAMAGE = ["bashing", "lethal", "aggravated"];
const STAGES = ["defense", "damage", "soak", "resolved", "applying", "done", "miss"];
const inFlight = new Set();
let DiceRollContainer;
let DiceRoller;
let CombatHelper;

const number = (n, d = 0) => { const v = Number(n); return Number.isFinite(v) ? v : d; };
const safeInt = (n, d = 0) => Math.trunc(number(n, d));
const clamp = (n, a, b) => Math.min(b, Math.max(a, safeInt(n)));
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const activeGM = () => game.users.filter(u => u.active && u.isGM).sort((a, b) => a.id.localeCompare(b.id))[0];
const isLeader = () => !!game.user?.isGM && activeGM()?.id === game.user.id;
const mayUse = (userId, actor) => {
  const user = game.users.get(userId);
  return !!user && (user.isGM || actor?.testUserPermission?.(user, "OWNER"));
};
const tokenActor = async uuid => (await fromUuid(uuid))?.actor ?? null;
const getActor = async uuid => {
  const document = await fromUuid(uuid);
  return document?.actor ?? (document?.documentName === "Actor" ? document : null);
};
const speaker = actor => ChatMessage.getSpeaker({actor});
const notify = (message, type = "warn") => ui.notifications?.[type]?.(message);
const gameType = actor => String(actor?.system?.settings?.splat ?? actor?.type ?? "").toLowerCase();

function abilityValue(actor, key, customId = "") {
  if (!key || key === "noselected") return 0;
  if (key === "custom" && customId) {
    return safeInt(actor.items.get(customId)?.system?.value);
  }
  try {
    const item = actor.api?.getAbility?.(key);
    if (item) return safeInt(item.system?.value);
  } catch (_) { /* Use generic system fallback below. */ }
  const entry = actor.system?.abilities?.[key];
  if (entry?.value != null) return safeInt(entry.value);
  const owned = actor.items.find(i => i.type === "Ability" && (i.system?.id === key || i.system?.key === key));
  return safeInt(owned?.system?.value);
}
function attributeValue(actor, key) {
  if (!key || key === "noselected") return 0;
  return safeInt(actor.system?.attributes?.[key]?.total ?? actor.system?.attributes?.[key]?.value ?? actor.system?.[key]?.roll);
}
function weaponList(actor) {
  return actor.items.filter(i => i.type === "Melee Weapon" || i.type === "Ranged Weapon");
}
function woundPenalty(actor, origin) {
  if (actor.system?.conditions?.isignoringpain || actor.system?.conditions?.isfrenzy) return 0;
  if (origin === "damage" && !CONFIG.worldofdarkness?.usePenaltyDamage) return 0;
  if (origin === "soak") return 0;
  return safeInt(actor.system?.health?.damage?.woundpenalty);
}
function damageType(item) {
  const value = String(item?.system?.damage?.type ?? "bashing").toLowerCase();
  return VALID_DAMAGE.includes(value) ? value : "bashing";
}
function effectiveDamageType(item, target, override) {
  if (VALID_DAMAGE.includes(override)) return override;
  const base = damageType(item);
  // By default, ordinary firearms do bashing to Kindred in V20 except targeted headshots.
  // Different ammunition, supernatural weapons and targeted attacks can use the override.
  if (base === "lethal" && item?.type === "Ranged Weapon" &&
      item?.system?.attack?.ability === "firearms" && gameType(target).includes("vampire")) {
    return "bashing";
  }
  return base;
}
function attackData(actor, item) {
  const a = item?.system?.attack ?? {};
  const key = item ? String(a.attribute || "dexterity") : "dexterity";
  const ability = item ? String(a.ability || (item.type === "Ranged Weapon" ? "firearms" : "melee")) : "brawl";
  const custom = a.secondaryabilityid || "";
  const base = attributeValue(actor, key) + abilityValue(actor, ability, custom) + (item ? safeInt(a.accuracy) : 0);
  return {attribute:key, ability, pool:Math.max(0, base), difficulty:clamp(item?.system?.difficulty ?? 6, 2, 10)};
}
function defaultDamagePool(actor, item, netHits) {
  const extra = CONFIG.worldofdarkness?.successesToDamageRolls === false ? 0 : Math.max(0, netHits - 1);
  const damage = item?.system?.damage ?? {};
  const attr = item ? String(damage.attribute || "noselected") : "strength";
  const base = attributeValue(actor, attr) + (item ? safeInt(damage.bonus) : 0);
  return {pool:Math.max(0, base + extra), extra, attribute:attr};
}
function resolveContext(state) {
  return `${esc(state.attackerName)} vs. ${esc(state.targetName)} | ${esc(state.weaponName)} | ${esc(state.damageType)}`;
}
function button(label, action, extra = "") {
  return `<button type="button" data-stl-combat-action="${esc(action)}" ${extra}>${esc(label)}</button>`;
}
function line(label, value) { return `<div class="stl-combat-line"><span>${esc(label)}</span><b>${esc(value)}</b></div>`; }
function card(state) {
  const header = `<div class="stl-combat-header"><strong>Combat Workflow</strong><small> ${esc(state.stage.toUpperCase())} </small></div>`;
  let body = `<div class="stl-combat-subtitle">${resolveContext(state)}</div>`;
  body += line("Attack successes", state.attackSuccesses);
  if (state.defense) {
    body += line(`Defense (${state.defense.choice})`, state.defense.successes);
    body += line("Net attack successes", state.netSuccesses);
  }
  if (state.damage) body += line("Damage successes", state.damage.successes);
  if (state.soak) body += line(`Soak (${state.soak.choice})`, state.soak.successes);
  if (state.note && state.stage === "resolved") body += `<p class="stl-combat-help">${esc(state.note)}</p>`;
  if (state.stage === "defense") {
    body += `<p class="stl-combat-help">Defender: choose your response.</p><div class="stl-combat-actions">`;
    body += button("Dodge", "dodge") + button("Block", "block") + button("Parry", "parry") + button("No Defense", "none");
    body += `</div>`;
  }
  if (state.stage === "damage") {
    body += `<p class="stl-combat-help">Attacker: roll damage for ${esc(state.netSuccesses)} net attack success(es).</p><div class="stl-combat-actions">`;
    body += button("Roll Damage", "damage") + `</div>`;
  }
  if (state.stage === "soak") {
    body += `<p class="stl-combat-help">Defender: roll applicable soak, or accept the damage without soaking.</p><div class="stl-combat-actions">`;
    body += button("Roll Soak", "soak") + button("Cannot / Won't Soak", "no-soak") + `</div>`;
  }
  if (state.stage === "miss") body += `<p class="stl-combat-outcome">Attack missed; no damage roll needed.</p>`;
  if (state.stage === "resolved" || state.stage === "applying" || state.stage === "done") {
    body += `<div class="stl-combat-outcome">${esc(state.finalDamage)} ${esc(state.damageType)} health level(s) after soak</div>`;
    if (state.stage === "resolved") {
      body += `<p class="stl-combat-help">GM: review the target's current health before applying damage.</p><div class="stl-combat-actions">`;
      body += button("Apply to Health", "apply") + button("Leave Unapplied", "skip") + `</div>`;
    } else if (state.stage === "applying") body += `<p>Application started. If interrupted, verify the Actor before retrying manually.</p>`;
    else {
      body += `<p>${esc(state.note || "Resolution recorded.")}</p>`;
      if (state.undo) body += `<div class="stl-combat-actions">${button("Undo Damage", "undo")}</div>`;
    }
  }
  return `<section class="stl-combat-card" data-stl-combat="true">${header}${body}</section>`;
}
async function makeMessage(state) {
  const actor = await getActor(state.attackerUuid);
  return ChatMessage.create({speaker:speaker(actor), content:card(state), flags:{[MODULE]:{combat:state}}});
}
async function updateMessage(msg, state) {
  if (!STAGES.includes(state.stage)) throw new Error("Invalid combat stage");
  await msg.update({content:card(state), [`flags.${MODULE}.combat`]:state});
}
async function authoritative(payload) {
  if (!isLeader() || !payload || !["start", "advance"].includes(payload.type)) return;
  const key = payload.type === "start" ? `start:${payload.userId}:${payload.nonce}` : payload.messageId;
  if (inFlight.has(key)) return;
  inFlight.add(key);
  try {
    if (payload.type === "start") return await acceptStart(payload);
    return await acceptAdvance(payload);
  } catch (e) {
    console.error(`${MODULE} | Combat step rejected`, e);
    // Errors are visible to the GM console; don't leak private actor details to other users.
    notify(`Combat workflow: ${e.message}`);
  } finally { inFlight.delete(key); }
}
async function acceptStart(payload) {
  const attacker = await getActor(payload.attackerUuid);
  const target = await getActor(payload.targetUuid);
  if (!attacker || !target || !mayUse(payload.userId, attacker)) throw new Error("Missing attacker/target or no attacker ownership");
  if (payload.weaponId && !weaponList(attacker).some(i => i.id === payload.weaponId)) throw new Error("Weapon not owned by attacker");
  const item = payload.weaponId ? attacker.items.get(payload.weaponId) : null;
  const successes = clamp(payload.successes, 0, 100);
  const state = {
    schema:1,
    nonce:String(payload.nonce || ""),
    attackerUuid:payload.attackerUuid,
    targetUuid:payload.targetUuid,
    attackerName:attacker.name,
    targetName:target.name,
    weaponId:item?.id || null,
    weaponName:item?.name || "Unarmed Strike",
    damageType:effectiveDamageType(item, target, payload.damageOverride),
    attackSuccesses:successes,
    netSuccesses:successes,
    defense:null, damage:null, soak:null,
    finalDamage:null, note:"",
    stage:successes > 0 ? "defense" : "miss"
  };
  await makeMessage(state);
}
async function acceptAdvance(payload) {
  const msg = game.messages.get(payload.messageId);
  if (!msg) throw new Error("Missing workflow chat message");
  const old = msg.getFlag(MODULE, "combat");
  if (!old || old.schema !== 1 || !STAGES.includes(old.stage)) throw new Error("Invalid workflow data");
  const s = foundry.utils.deepClone(old);
  const attacker = await getActor(s.attackerUuid);
  const target = await getActor(s.targetUuid);
  if (!attacker || !target) throw new Error("A combat Actor is missing");
  const step = String(payload.step || "");
  const isAttacker = mayUse(payload.userId, attacker);
  const isDefender = mayUse(payload.userId, target);
  const user = game.users.get(payload.userId);
  const isGM = !!user?.isGM;
  if (step === "defense" && s.stage === "defense" && isDefender) {
    if (!["dodge", "block", "parry", "none"].includes(payload.choice)) throw new Error("Unknown defense");
    const successes = payload.choice === "none" ? 0 : clamp(payload.successes, 0, 100);
    s.defense = {choice:payload.choice, successes};
    s.netSuccesses = Math.max(0, s.attackSuccesses - successes);
    s.stage = s.netSuccesses > 0 ? "damage" : "miss";
  } else if (step === "damage" && s.stage === "damage" && isAttacker) {
    const successes = clamp(payload.successes, 0, 100);
    s.damage = {successes};
    s.stage = successes > 0 ? "soak" : "resolved";
    if (!successes) { s.soak = {choice:"not needed",successes:0}; s.finalDamage = 0; }
  } else if (step === "soak" && s.stage === "soak" && isDefender) {
    if (!["roll", "none"].includes(payload.choice)) throw new Error("Unknown soak choice");
    const successes = payload.choice === "none" ? 0 : clamp(payload.successes, 0, 100);
    s.soak = {choice:payload.choice, successes};
    const afterSoak = Math.max(0, s.damage.successes - successes);
    s.finalDamage = s.damageType === "bashing" && gameType(target).includes("vampire")
      ? Math.floor(afterSoak / 2) : afterSoak;
    s.note = s.damageType === "bashing" && gameType(target).includes("vampire")
      ? "V20: bashing damage halved after soak (round down)." : "";
    s.stage = "resolved";
  } else if (step === "undo" && s.stage === "done" && isGM && s.undo) {
    const current = target.system.health.damage;
    for (const key of VALID_DAMAGE) {
      if (safeInt(current[key]) !== safeInt(s.undo.after[key])) {
        throw new Error("Health has changed since the attack; use the Actor sheet to review instead of overwriting later changes");
      }
    }
    s.stage = "applying";
    await updateMessage(msg, s);
    const changes = {};
    for (const key of VALID_DAMAGE) changes[`system.health.damage.${key}`] = safeInt(s.undo.before[key]);
    await target.update(changes);
    s.stage = "done";
    s.note = "Damage undone by GM; prior health counts restored.";
    s.undo = null;
  } else if (step === "skip" && s.stage === "resolved" && isGM) {
    s.stage = "done";
    s.note = "Not applied to Actor health (GM choice).";
  } else if (step === "apply" && s.stage === "resolved" && isGM) {
    // Mark as applying BEFORE mutating health to prevent an accidental double application.
    s.stage = "applying";
    await updateMessage(msg, s);
    if (s.finalDamage <= 0) {
      s.stage = "done";
      s.note = "No damage to apply.";
      return await updateMessage(msg, s);
    }
    if (!target.system?.health?.damage || typeof CombatHelper?.ApplyDamageWithOverflow !== "function") {
      throw new Error("Health model unsupported: left at APPLYING for manual review");
    }
    const before = Object.fromEntries(VALID_DAMAGE.map(k => [k, safeInt(target.system.health.damage[k])]));
    const updated = foundry.utils.deepClone(target.system.health.damage);
    const max = CombatHelper.GetMaxHealthLevels(target.system);
    if (max < 1) throw new Error("Target has no native health track; inspect before resolving");
    const applied = CombatHelper.ApplyDamageWithOverflow(updated, s.damageType, s.finalDamage, max);
    await target.update({"system.health.damage":updated});
    s.undo = {before,after:Object.fromEntries(VALID_DAMAGE.map(k => [k,safeInt(updated[k])]))};
    s.stage = "done";
    s.note = applied === s.finalDamage ? "Applied to native Actor health." : `Applied ${applied}; remainder requires GM adjudication (overflow).`;
  } else {
    throw new Error("Step out of sequence or user does not control the required Actor");
  }
  await updateMessage(msg, s);
}
function send(payload) {
  const leader = activeGM();
  if (!leader) return notify("A GM must be online to coordinate cross-player combat.");
  payload.userId = game.user.id;
  if (isLeader()) return authoritative(payload);
  game.socket.emit(CHANNEL, payload);
}
async function nativeRoll(actor, {origin, action, attribute, ability, pool, difficulty, bonus = 0, extraInfo = [], useWillpower = false}) {
  const roll = new DiceRollContainer(actor);
  roll.origin = origin;
  roll.action = action;
  roll.attribute = attribute || "noselected";
  roll.ability = ability || "noselected";
  roll.numDices = Math.max(0, safeInt(pool));
  roll.difficulty = clamp(difficulty, 2, 10);
  roll.bonus = safeInt(bonus);
  roll.woundpenalty = woundPenalty(actor, origin);
  roll.dicetext = [`${action} (${roll.numDices} dice)`];
  roll.extraInfo = extraInfo;
  roll.usewillpower = !!useWillpower;
  return clamp(await DiceRoller(roll), 0, 100);
}
async function promptFields(title, fields, confirmText = "Roll") {
  const content = `<div class="stl-combat-prompt">${fields.map(f => {
    if (f.type === "select") return `<label>${esc(f.label)}<select name="${esc(f.name)}">${f.options.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join("")}</select></label>`;
    return `<label>${esc(f.label)}<input name="${esc(f.name)}" type="number" step="1" min="${esc(f.min ?? -100)}" max="${esc(f.max ?? 100)}" value="${esc(f.value ?? 0)}"></label>`;
  }).join("")}</div>`;
  return await foundry.applications.api.DialogV2.input({
    window:{title}, content, ok:{label:confirmText}, rejectClose:false, modal:true
  });
}
async function open() {
  if (!DiceRoller) return notify("WoD20 dice functions unavailable.");
  const selected = canvas.tokens.controlled;
  if (selected.length !== 1) return notify("Select exactly one attacking token.");
  const attacker = selected[0].actor;
  if (!attacker || !mayUse(game.user.id, attacker)) return notify("You do not control this Actor.");
  const targets = [...game.user.targets];
  if (targets.length !== 1) return notify("Target exactly one defending token.");
  const target = targets[0];
  if (!target?.actor) return notify("Target has no Actor.");
  if (!activeGM()) return notify("A GM must be online to coordinate combat.");
  const weapons = weaponList(attacker);
  const choice = await promptFields(`${attacker.name}: Attack ${target.name}`, [
    {name:"weapon", label:"Weapon or maneuver", type:"select", options:[{value:"",label:"Unarmed Strike (Dexterity + Brawl)"},...weapons.map(i => ({value:i.id,label:i.name}))]},
    {name:"difficulty", label:"Attack difficulty (0 = weapon default)", value:0, min:0, max:10},
    {name:"modifier", label:"Additional attack dice (+/-)", value:0, min:-50, max:50},
    {name:"damageOverride", label:"Damage type", type:"select", options:[
      {value:"",label:"Weapon default (V20 firearm-vampire rule applied)"},
      {value:"bashing",label:"Bashing"}, {value:"lethal",label:"Lethal"},
      {value:"aggravated",label:"Aggravated"}
    ]}
  ], "Roll Attack");
  if (!choice) return;
  const item = choice.weapon ? attacker.items.get(choice.weapon) : null;
  if (choice.weapon && !item) return notify("Weapon no longer exists.");
  const stats = attackData(attacker, item);
  const difficulty = choice.difficulty === "0" || choice.difficulty === 0
    ? stats.difficulty : clamp(choice.difficulty, 2, 10);
  const modifier = clamp(choice.modifier, -50, 50);
  if (item?.type === "Ranged Weapon" && CONFIG.worldofdarkness?.defaultAutoAmmo && item.system?.clip) {
    const available = safeInt(item.system.clip.value);
    if (available < 1) return notify(`${item.name}: no ammunition in clip.`);
  }
  const success = await nativeRoll(attacker, {
    origin:"attack", action:`${item?.name || "Unarmed Strike"} attack`,
    attribute:stats.attribute, ability:stats.ability,
    pool:Math.max(0, stats.pool + modifier), difficulty,
    bonus:modifier, extraInfo:[`Target: ${target.name}`]
  });
  if (item?.type === "Ranged Weapon" && CONFIG.worldofdarkness?.defaultAutoAmmo && item.system?.clip) {
    await item.update({"system.clip.value":Math.max(0, safeInt(item.system.clip.value) - 1)});
  }
  send({type:"start", nonce:foundry.utils.randomID(), attackerUuid:selected[0].document.uuid,
    targetUuid:target.document.uuid, weaponId:item?.id || null, successes:success, damageOverride:choice.damageOverride});
}
async function clickAction(event) {
  const element = event.target.closest?.(BUTTON);
  if (!element) return;
  event.preventDefault();
  const cardElement = element.closest("[data-message-id]");
  const msg = game.messages.get(cardElement?.dataset?.messageId);
  const state = msg?.getFlag(MODULE, "combat");
  if (!state) return;
  const actor = await getActor(state.attackerUuid);
  const defender = await getActor(state.targetUuid);
  if (!actor || !defender) return notify("Combat Actor missing.");
  const action = element.dataset.stlCombatAction;
  if (["dodge", "block", "parry", "none"].includes(action) && state.stage === "defense") {
    if (!mayUse(game.user.id, defender)) return notify("Only the defender (or GM) can defend.");
    if (action === "none") return send({type:"advance", messageId:msg.id, step:"defense", choice:action, successes:0});
    const abilities = {dodge:"athletics",block:"brawl",parry:"melee"};
    const ability = abilities[action];
    const splat = gameType(defender);
    const defaultDifficulty = splat.includes("mage") ? ({dodge:6, block:8, parry:7}[action]) : 6;
    const base = attributeValue(defender, "dexterity") + abilityValue(defender, ability);
    const opts = await promptFields(`${defender.name}: ${action}`, [
      {name:"pool",label:`Dexterity + ${ability} dice`,value:base,min:0,max:100},
      {name:"difficulty",label:"Difficulty",value:defaultDifficulty,min:2,max:10}
    ]);
    if (!opts) return;
    const successes = await nativeRoll(defender, {origin:"attack",action:`${action} defense vs ${actor.name}`,
      attribute:"dexterity",ability,pool:clamp(opts.pool,0,100),difficulty:clamp(opts.difficulty,2,10)});
    return send({type:"advance", messageId:msg.id, step:"defense", choice:action, successes});
  }
  if (action === "damage" && state.stage === "damage") {
    if (!mayUse(game.user.id, actor)) return notify("Only the attacker (or GM) rolls damage.");
    const item = state.weaponId ? actor.items.get(state.weaponId) : null;
    if (state.weaponId && !item) return notify("Weapon was removed from attacker; GM must resolve manually.");
    const damage = defaultDamagePool(actor, item, state.netSuccesses);
    const opts = await promptFields(`${actor.name}: Roll Damage`, [
      {name:"pool",label:`Damage dice (includes ${damage.extra} attack bonus)`,value:damage.pool,min:0,max:100},
      {name:"difficulty",label:"Difficulty",value:6,min:2,max:10}
    ]);
    if (!opts) return;
    const successes = await nativeRoll(actor,{origin:"damage",action:`${state.weaponName} damage`,
      attribute:damage.attribute,pool:clamp(opts.pool,0,100),difficulty:clamp(opts.difficulty,2,10),
      extraInfo:[`Damage type: ${state.damageType}`,`Net attack successes: ${state.netSuccesses}`]});
    return send({type:"advance", messageId:msg.id, step:"damage", successes});
  }
  if ((action === "soak" || action === "no-soak") && state.stage === "soak") {
    if (!mayUse(game.user.id, defender)) return notify("Only the defender (or GM) handles soak.");
    if (action === "no-soak") return send({type:"advance", messageId:msg.id, step:"soak", choice:"none", successes:0});
    const pool = Math.max(0, safeInt(defender.system?.soak?.[state.damageType]));
    const bonus = safeInt(defender.system?.settings?.soak?.[state.damageType]?.bonus);
    const opts = await promptFields(`${defender.name}: Soak ${state.damageType}`, [
      {name:"pool",label:"Soak dice (native soak + native bonus)",value:pool + bonus,min:0,max:100},
      {name:"difficulty",label:"Difficulty",value:6,min:2,max:10}
    ]);
    if (!opts) return;
    const successes = await nativeRoll(defender,{origin:"soak",action:`Soak ${state.damageType} from ${actor.name}`,
      attribute:"stamina",pool:clamp(opts.pool,0,100),difficulty:clamp(opts.difficulty,2,10),
      extraInfo:[`Incoming damage successes: ${state.damage.successes}`]});
    return send({type:"advance",messageId:msg.id,step:"soak",choice:"roll",successes});
  }
  if ((action === "apply" || action === "skip") && state.stage === "resolved") {
    if (!game.user.isGM) return notify("Only a GM can finalize Actor health.");
    if (action === "apply") {
      const confirmed = await promptFields(`Apply ${state.finalDamage} ${state.damageType} to ${defender.name}?`, [], "Confirm Apply");
      if (!confirmed) return;
    }
    return send({type:"advance",messageId:msg.id,step:action});
  }
  if (action === "undo" && state.stage === "done" && state.undo) {
    if (!game.user.isGM) return notify("Only a GM can undo applied damage.");
    const confirmed = await promptFields(`Undo damage to ${defender.name}?`, [], "Confirm Undo");
    if (!confirmed) return;
    return send({type:"advance",messageId:msg.id,step:"undo"});
  }
}
Hooks.once("ready", async () => {
  if (game.system.id !== "worldofdarkness") return;
  try {
    const rollAPI = await import("/systems/worldofdarkness/module/scripts/roll-dice.js");
    DiceRollContainer = rollAPI.DiceRollContainer;
    DiceRoller = rollAPI.DiceRoller;
    const combatAPI = await import("/systems/worldofdarkness/module/scripts/combat-helpers.js");
    CombatHelper = combatAPI.default;
    if (typeof DiceRoller !== "function") throw new Error("DiceRoller export not found");
  } catch (error) {
    console.error(`${MODULE} | WoD20 native API missing`, error);
    return notify("STL Combat Workflow cannot load WoD20 native APIs.", "error");
  }
  const api = Object.freeze({open});
  game.modules.get(MODULE).api = api;
  game.stlCombatWorkflow = api;
  game.socket.on(CHANNEL, payload => void authoritative(payload));
  document.addEventListener("click", event => {
    if (event.target.closest?.(BUTTON)) void clickAction(event).catch(error => {
      console.error(`${MODULE} | Step failed`, error);
      notify(`Combat action failed: ${error.message}`);
    });
  });
  console.info(`${MODULE} | Native WoD20 attack -> defense -> damage -> soak workflow available via game.stlCombatWorkflow.open()`);
});

// Foundry v14's native Token scene-control toolbar is available to all users.
Hooks.on("getSceneControlButtons", controls => {
  const tokenTools = controls?.tokens?.tools;
  if (!tokenTools || game.system?.id !== "worldofdarkness") return;
  tokenTools.stlCombatWorkflow = {
    name:"stlCombatWorkflow",
    title:"Combat Workflow",
    icon:"fa-solid fa-shield-halved",
    order:Object.keys(tokenTools).length,
    button:true,
    visible:true,
    onChange:() => void open().catch(e => {
      console.error(`${MODULE} | Unable to open`,e);
      notify(`Combat workflow: ${e.message}`);
    })
  };
});
