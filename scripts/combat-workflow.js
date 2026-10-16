// STL Combat Workflow 0.2.3. This module delegates all dice rolling to WoD20.
const MODULE = "stl-combat-workflow";
const CHANNEL = `module.${MODULE}`;
const BUTTON = "[data-stl-combat-action]";
const DODGE_BUTTON = ".macroBtn.wod20-dodge-button";
const SHEET_BUTTON = ".macroBtn.stl-combat-sheet-button";
const VALID_DAMAGE = ["bashing", "lethal", "aggravated"];
const STAGES = ["defense", "damage", "soak", "resolved", "applying", "done", "miss", "grapple-defend", "holding", "grapple-counter", "grapple-free"];
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
// WoD20 includes Grapple as a native Melee Weapon Item. Keep the Actor's Item
// intact for native sheets and older workflow cards, but present it only through
// the dedicated Actions -> Grapple workflow, not the Attack weapon selector.
function isGrappleManeuver(item) {
  return item?.type === "Melee Weapon" && String(item.name ?? "").trim().toLowerCase() === "grapple";
}
function attackWeaponList(actor) {
  return weaponList(actor).filter(item => !isGrappleManeuver(item));
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
// Ranged fire modes follow WoD20's native dialog-weaponv2.js settings
// (burst +3 dice / +1 difficulty; full-auto +10 / +2).
const FIRE_MODES = Object.freeze({
  single:{bonus:0,difficulty:0,caption:"Single shot"},
  burst:{bonus:3,difficulty:1,caption:"Three-round burst"},
  fullauto:{bonus:10,difficulty:2,caption:"Full automatic"}
});
function supportsFireMode(item, mode) {
  if (mode === "single") return true;
  return item?.type === "Ranged Weapon" && (
    (mode === "burst" && !!item.system?.mode?.hasburst) ||
    (mode === "fullauto" && !!item.system?.mode?.hasfullauto)
  );
}
function availableFireModes(weapons) {
  const options = [{value:"single",label:"Single shot / normal"}];
  if (weapons.some(i=>supportsFireMode(i,"burst"))) options.push({value:"burst",label:"Three-round burst (+3 dice, +1 difficulty, 3 rounds)"});
  if (weapons.some(i=>supportsFireMode(i,"fullauto"))) options.push({value:"fullauto",label:"Full auto (+10 dice, +2 difficulty, expends available clip)"});
  return options;
}
function ammunitionUse(item, mode = "single") {
  if (item?.type !== "Ranged Weapon" || !item.system?.clip || !CONFIG.worldofdarkness?.defaultAutoAmmo) {
    return {valid:true,spend:0};
  }
  const left = Math.max(0,safeInt(item.system.clip.value));
  const size = Math.max(0,safeInt(item.system.clip.max));
  // Native WoD20 full-auto requires at least half of the configured magazine
  // and expends the remaining loaded rounds. Do not fabricate loaded rounds.
  const required = mode === "burst" ? 3 : mode === "fullauto" ? Math.max(1,Math.ceil(size/2)) : 1;
  return {valid:left>=required,spend:mode==="fullauto"?left:required,required,left};
}
async function spendAmmunition(item,mode) {
  const ammo=ammunitionUse(item,mode);
  if (!ammo.valid) return false;
  if (ammo.spend > 0) await item.update({"system.clip.value":Math.max(0,ammo.left-ammo.spend)});
  return true;
}
// V20/M20 split actions use the LOWEST declared attack pool, divided between
// attacks. Same-weapon repeated attacks have the same base pool. Exclude native
// extra actions (Celerity etc.) because they have a different action economy.
function splitAttackPool(pool,count) {
  const dice=Math.max(0,safeInt(pool));
  const n=clamp(count,1,4);
  if (dice<n) return null;
  return Array.from({length:n},(_,i)=>Math.floor(dice/n)+(i<dice%n?1:0));
}
function defaultDamagePool(actor, item, netHits) {
  const extra = CONFIG.worldofdarkness?.successesToDamageRolls === false ? 0 : Math.max(0, netHits - 1);
  const damage = item?.system?.damage ?? {};
  const attr = item ? String(damage.attribute || "noselected") : "strength";
  const base = attributeValue(actor, attr) + (item ? safeInt(damage.bonus) : 0);
  return {pool:Math.max(0, base + extra), extra, attribute:attr};
}
// WoD20 stores health state, penalty and remaining health separately
// from the bashing/lethal/aggravated totals. Persist all in one update.
function nativeHealthFields(actor, damage) {
  const health = actor.system?.health;
  const levels = Object.keys(CONFIG.worldofdarkness?.woundLevels ?? {});
  if (!health?.damage || !levels.length || levels.some(key => !health[key])) {
    throw new Error("Native WoD20 health levels unavailable; review health on Actor sheet");
  }
  const count = values => VALID_DAMAGE.reduce((sum, key) => sum + Math.max(0, safeInt(values?.[key])), 0);
  const wounded = Math.max(count(damage), count(damage.chimerical));
  let remaining = wounded;
  let maxHealth = 0;
  let active = null;
  for (const key of levels) {
    const entry = health[key];
    const capacity = Math.max(0, safeInt(entry.total));
    maxHealth += capacity;
    if (remaining > 0) {
      remaining -= capacity;
      if (remaining <= 0) active = entry;
    }
  }
  if (wounded > 0 && !active) active = health[levels[levels.length - 1]];
  if (maxHealth < 1) throw new Error("Target has no configured native health levels");
  const fields = {
    "system.health.damage.woundlevel": active ? String(active.label ?? "") : "",
    "system.health.damage.woundpenalty": active ? safeInt(active.penalty) : 0
  };
  if (actor.system?.traits?.health?.totalhealthlevels) {
    fields["system.traits.health.totalhealthlevels.max"] = maxHealth;
    fields["system.traits.health.totalhealthlevels.value"] = maxHealth - wounded;
  }
  return fields;
}
function resolveContext(state) {
  return `${esc(state.attackerName)} vs. ${esc(state.targetName)} | ${esc(state.weaponName)} | ${esc(state.damageType)}`;
}
function button(label, action, extra = "") {
  return `<button type="button" data-stl-combat-action="${esc(action)}" ${extra}>${esc(label)}</button>`;
}
function line(label, value) { return `<div class="stl-combat-line"><span>${esc(label)}</span><b>${esc(value)}</b></div>`; }
function resultBanner(state) {
  if (state.stage === "miss") {
    const defended = {dodge:"DODGED!",block:"BLOCKED!",parry:"PARRIED!"};
    const label = defended[state.defense?.choice] ?? "MISSED!";
    return `<div class="stl-combat-result stl-combat-result--miss" role="status"><strong>${esc(label)}</strong><span>Attack avoided — no damage.</span></div>`;
  }
  if (state.stage === "holding") return '<div class="stl-combat-result stl-combat-result--holding" role="status"><strong>HOLD ESTABLISHED</strong><span>Defender may attempt escape on their next permitted action; holder may release.</span></div>';
  if (state.stage === "grapple-free") return `<div class="stl-combat-result stl-combat-result--none" role="status"><strong>${esc(state.note || "GRAPPLE ENDED")}</strong><span>No damage from this hold maneuver.</span></div>`;
  if (!["resolved", "applying", "done"].includes(state.stage)) return "";
  const damage = Math.max(0, safeInt(state.finalDamage));
  const isUndone = state.stage === "done" && String(state.note ?? "").startsWith("Damage undone by GM");
  const isSkipped = state.stage === "done" && String(state.note ?? "").startsWith("Not applied to Actor health");
  const kind = isUndone ? "undone" : (damage === 0 ? "none" : "hit");
  const label = isUndone ? "DAMAGE UNDONE" : (damage === 0 ? "NO DAMAGE" : `${damage} ${String(state.damageType || "damage").toUpperCase()} DAMAGE`);
  let detail;
  if (isUndone) detail = `${damage} ${String(state.damageType || "damage").toLowerCase()} damage undone — health restored.`;
  else if (isSkipped) detail = "Recorded only — not applied to health.";
  else if (damage === 0) detail = "No health levels lost after soak.";
  else if (state.stage === "resolved") detail = "After soak — awaiting GM decision.";
  else if (state.stage === "applying") detail = "Applying to health…";
  else detail = "Damage applied to health.";
  return `<div class="stl-combat-result stl-combat-result--${kind}" role="status"><strong>${esc(label)}</strong><span>${esc(detail)}</span></div>`;
}
// The acting character's name uses its controlling player's Foundry User color.
// Only sanitized hex colors are accepted for inline CSS.
function normalizedPlayerColor(value) {
  let color = String(value?.css ?? value ?? "").trim();
  if (/^#[0-9a-f]{3}$/i.test(color)) color = "#" + [...color.slice(1)].map(c => c + c).join("");
  if (/^#[0-9a-f]{8}$/i.test(color)) color = color.slice(0, 7);
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : null;
}
function playerTurnStyle(user) {
  const hex = normalizedPlayerColor(user?.color) ?? "#444c55";
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const linear = rgb.map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
  const luminance = .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
  const foreground = (1.05 / (luminance + .05)) >= ((luminance + .05) / .05) ? "#ffffff" : "#141414";
  return `--stl-turn-color:${hex};--stl-turn-text:${foreground}`;
}
function actingUser(actor) {
  const users = game.users?.filter?.(user => !user.isGM) ?? [];
  // An explicitly assigned character is the strongest identity match.
  const assigned = users.filter(user => actor && (
    (user.character?.id && user.character.id === actor.id) ||
    (user.character?.uuid && user.character.uuid === actor.uuid)
  ));
  const explicit = users.filter(user => actor && Number(actor.ownership?.[user.id]) >= 3);
  const permitted = users.filter(user => actor?.testUserPermission?.(user, "OWNER"));
  const candidates = assigned.length ? assigned : (explicit.length ? explicit : permitted);
  return candidates.find(user => user.active) ?? candidates[0] ?? activeGM() ?? game.user;
}
function turnPrompt(state, user = null) {
  const name = ["defense","soak","grapple-defend","holding"].includes(state.stage) ? state.targetName
    : ["damage","grapple-counter"].includes(state.stage) ? state.attackerName
    : state.stage === "resolved" && safeInt(state.finalDamage) > 0 ? "Storyteller"
    : "";
  if (!name) return "";
  const prompt = state.stage === "resolved" ? name : state.stage === "holding" ? `${name} Grappled` : `${name} Roll`;
  return `<div class="stl-combat-turn" role="status" style="${playerTurnStyle(user)}"><strong class="stl-combat-turn-name">${esc(prompt)}</strong></div>`;
}
function card(state, actingUser = null) {
  const header = `<div class="stl-combat-header"><strong>Combat Workflow</strong><small> ${esc(state.stage.toUpperCase())} </small></div>`;
  let body = turnPrompt(state, actingUser) + `<div class="stl-combat-subtitle">${resolveContext(state)}</div>`;
  if (state.maneuver === "hold") body += '<p class="stl-combat-help">Grapple / Hold • Strength + Brawl</p>';
  if (state.firingMode && state.firingMode !== "single") body += `<p class="stl-combat-help">Firing mode: ${esc(FIRE_MODES[state.firingMode]?.caption || state.firingMode)}</p>`;
  if (state.combo) body += `<p class="stl-combat-help">Split attack ${safeInt(state.combo.index)} of ${safeInt(state.combo.count)} • pool ${safeInt(state.combo.pools?.[safeInt(state.combo.index)-1])} dice</p>`;
  body += line("Attack successes", state.attackSuccesses);
  if (state.defense) {
    body += line(`Defense (${state.defense.choice})`, state.defense.successes);
    body += line("Net attack successes", state.netSuccesses);
  }
  if (state.damage) body += line("Damage successes", state.damage.successes);
  if (state.soak) body += line(`Soak (${state.soak.choice})`, state.soak.successes);
  if (state.note && state.stage === "resolved") body += `<p class="stl-combat-help">${esc(state.note)}</p>`;
  if (state.stage === "grapple-defend") {
    body += '<div class="stl-combat-actions">' + button("Resist (Str + Brawl)","grapple-resist") + button("Do Not Resist","grapple-none") + '</div>';
  }
  if (state.stage === "holding") {
    body += '<div class="stl-combat-actions">' + button("Attempt Escape","grapple-escape") + button("Release Hold","grapple-release") + '</div>';
  }
  if (state.stage === "grapple-counter") {
    body += '<div class="stl-combat-actions">' + button("Contest Escape (Str + Brawl)","grapple-hold") + '</div>';
  }
  if (state.stage === "defense") {
    body += `<div class="stl-combat-actions">`;
    body += button("Dodge", "dodge") + button("Block", "block") + button("Parry", "parry") + button("No Defense", "none");
    body += `</div>`;
  }
  if (state.stage === "damage") {
    body += `<div class="stl-combat-actions">`;
    body += button("Roll Damage", "damage") + `</div>`;
  }
  if (state.stage === "soak") {
    body += `<div class="stl-combat-actions">`;
    body += button("Roll Soak", "soak") + button("No Soak", "no-soak", 'title="Cannot or choose not to soak"') + `</div>`;
  }
  body += resultBanner(state);
  if (state.stage === "resolved" || state.stage === "applying" || state.stage === "done") {
    if (state.stage === "resolved" && safeInt(state.finalDamage) > 0) {
      body += `<div class="stl-combat-actions">`;
      body += button("Apply to Health", "apply") + button("Leave Unapplied", "skip") + `</div>`;
    } else if (state.stage === "resolved") {
      body += `<p>No damage to apply. Combat is complete.</p>`;
    } else if (state.stage === "applying") body += `<p>Application started. If interrupted, verify the Actor before retrying manually.</p>`;
    else {
      body += `<p>${esc(state.note || "Resolution recorded.")}</p>`;
      if (state.undo) body += `<div class="stl-combat-actions">${button("Undo Damage", "undo")}</div>`;
    }
  }
  if (state.combo && ["done","miss"].includes(state.stage) && !state.combo.continued && state.combo.index < state.combo.count) {
    body += '<div class="stl-combat-actions stl-combat-next">' + button(`Next Attack (${state.combo.index + 1}/${state.combo.count})`,"next-attack") + '</div>';
    body += '<p class="stl-combat-help">Target a new defender before continuing, or keep the current target.</p>';
  }
  return `<section class="stl-combat-card" data-stl-combat="true">${header}${body}</section>`;
}
async function makeMessage(state) {
  // The message's chat header follows the actor who must act.
  let actor = null;
  if (["defense","soak","grapple-defend","holding"].includes(state.stage)) actor = await getActor(state.targetUuid);
  else if (["damage","grapple-counter"].includes(state.stage)) actor = await getActor(state.attackerUuid);
  const chatSpeaker = actor ? speaker(actor) : {alias:"Combat Workflow"};
  const responsibleUser = actor ? actingUser(actor) : (activeGM() ?? game.user);
  return ChatMessage.create({speaker:chatSpeaker, content:card(state, responsibleUser), flags:{[MODULE]:{combat:state}}});
}
async function updateMessage(msg, state) {
  if (!STAGES.includes(state.stage)) throw new Error("Invalid combat stage");
  await msg.update({content:card(state), [`flags.${MODULE}.combat`]:state});
}
// Move only our workflow card to the bottom after each native roll; never remove
// native WoD20 roll cards. Preserve the old card if replacement creation fails.
async function advanceMessage(msg, state) {
  if (!STAGES.includes(state.stage)) throw new Error("Invalid combat stage");
  const next = await makeMessage(state);
  if (!next?.id) throw new Error("Could not create the next Combat Workflow card");
  try {
    await msg.delete();
  } catch (error) {
    console.warn(`${MODULE} | Could not remove previous workflow card; marking it inactive`, error);
    const stale = {...msg.getFlag(MODULE, "combat"), supersededBy:next.id};
    await msg.update({
      content:'<section class="stl-combat-card"><em>Combat continued in the newest workflow card below.</em></section>',
      [`flags.${MODULE}.combat`]:stale
    });
  }
  return next;
}
async function authoritative(payload) {
  if (!isLeader() || !payload || !["start", "advance", "continue"].includes(payload.type)) return;
  const key = payload.type === "start" ? `start:${payload.userId}:${payload.nonce}` : payload.messageId;
  if (inFlight.has(key)) return;
  inFlight.add(key);
  try {
    if (payload.type === "start") return await acceptStart(payload);
    if (payload.type === "continue") return await acceptContinue(payload);
    return await acceptAdvance(payload);
  } catch (e) {
    console.error(`${MODULE} | Combat step rejected`, e);
    // Errors are visible to the GM console; don't leak private actor details to other users.
    notify(`Combat workflow: ${e.message}`);
  } finally { inFlight.delete(key); }
}
function validCombo(combo) {
  if (!combo) return null;
  const count=safeInt(combo.count);
  const index=safeInt(combo.index);
  if (count<2||count>4||index<1||index>count||!Array.isArray(combo.pools)||combo.pools.length!==count) {
    throw new Error("Invalid multiple-attack allocation");
  }
  const pools=combo.pools.map(v=>safeInt(v));
  if (pools.some(v=>v<1||v>100)) throw new Error("Invalid split dice pool");
  return {count,index,pools,continued:!!combo.continued};
}
async function acceptContinue(payload) {
  const msg=game.messages.get(payload.messageId);
  const state=msg?.getFlag(MODULE,"combat");
  if (!state||!["done","miss"].includes(state.stage)||!state.combo||state.combo.continued||
      safeInt(state.combo.index)>=safeInt(state.combo.count)) {
    throw new Error("Previous attack cannot be continued");
  }
  const attacker=await getActor(state.attackerUuid);
  const target=await getActor(payload.targetUuid||state.targetUuid);
  if (!attacker||!target||!mayUse(payload.userId,attacker)) throw new Error("Cannot continue: attacker, target or permission unavailable");
  const newIndex=state.combo.index+1;
  if (safeInt(payload.index)!==newIndex) throw new Error("Out-of-sequence multiple attack");
  const item=state.weaponId?attacker.items.get(state.weaponId):null;
  if (state.weaponId&&!item) throw new Error("Weapon removed during multiple attacks");
  const prior=foundry.utils.deepClone(state);
  prior.combo.continued=true;
  await updateMessage(msg,prior);
  const next=foundry.utils.deepClone(state);
  next.combo.index=newIndex;
  next.combo.continued=false;
  next.targetUuid=payload.targetUuid||state.targetUuid;
  next.targetName=target.name;
  next.attackSuccesses=clamp(payload.successes,0,100);
  next.netSuccesses=next.attackSuccesses;
  next.defense=null;
  next.damage=null;
  next.soak=null;
  next.finalDamage=null;
  next.undo=null;
  next.note="";
  next.damageType=effectiveDamageType(item,target,next.damageOverride);
  next.stage=next.attackSuccesses>0?"defense":"miss";
  try { await makeMessage(next); }
  catch(error) {
    prior.combo.continued=false;
    await updateMessage(msg,prior);
    throw error;
  }
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
    weaponName:payload.maneuver === "hold" ? "Grapple / Hold" : (item?.name || "Unarmed Strike"),
    damageType:effectiveDamageType(item, target, payload.damageOverride),
    damageOverride:payload.damageOverride||"",
    maneuver:payload.maneuver === "hold" ? "hold" : "strike",
    firingMode:supportsFireMode(item,payload.firingMode) ? payload.firingMode : "single",
    attackDifficulty:clamp(payload.attackDifficulty || 6,2,10),
    combo:payload.maneuver==="hold"?null:validCombo(payload.combo),
    attackSuccesses:successes,
    netSuccesses:successes,
    defense:null, damage:null, soak:null,
    finalDamage:null, note:"",
    stage:successes > 0 ? (payload.maneuver === "hold" ? "grapple-defend" : "defense") : "miss"
  };
  await makeMessage(state);
}
async function acceptAdvance(payload) {
  const msg = game.messages.get(payload.messageId);
  if (!msg) throw new Error("Missing workflow chat message");
  const old = msg.getFlag(MODULE, "combat");
  if (!old || old.schema !== 1 || !STAGES.includes(old.stage) || old.supersededBy) throw new Error("Invalid or superseded workflow data");
  const s = foundry.utils.deepClone(old);
  const attacker = await getActor(s.attackerUuid);
  const target = await getActor(s.targetUuid);
  if (!attacker || !target) throw new Error("A combat Actor is missing");
  const step = String(payload.step || "");
  const isAttacker = mayUse(payload.userId, attacker);
  const isDefender = mayUse(payload.userId, target);
  const user = game.users.get(payload.userId);
  const isGM = !!user?.isGM;
  if (step === "grapple-resist" && s.stage === "grapple-defend" && isDefender) {
    const resisted=payload.choice==="none"?0:clamp(payload.successes,0,100);
    if (!["roll","none"].includes(payload.choice)) throw new Error("Invalid grapple resistance");
    s.defense={choice:payload.choice==="roll"?"resist grapple":"none",successes:resisted};
    s.netSuccesses=Math.max(0,s.attackSuccesses-resisted);
    s.stage=s.netSuccesses>0?"holding":"grapple-free";
    s.note=s.stage==="grapple-free"?"HOLD RESISTED":"Hold established: escape requires opposed Strength + Brawl.";
    s.grapple={escapeSuccesses:null,attempts:0};
  } else if (step === "grapple-escape" && s.stage === "holding" && isDefender) {
    s.grapple ||= {escapeSuccesses:null,attempts:0};
    s.grapple.escapeSuccesses=clamp(payload.successes,0,100);
    s.grapple.attempts=safeInt(s.grapple.attempts)+1;
    s.stage="grapple-counter";
  } else if (step === "grapple-hold" && s.stage === "grapple-counter" && isAttacker) {
    if (s.grapple?.escapeSuccesses==null) throw new Error("No escape attempt is pending");
    const holder=clamp(payload.successes,0,100);
    s.note=s.grapple.escapeSuccesses>holder?"HOLD ESCAPED":"Hold maintained: defender did not exceed holder's successes.";
    s.stage=s.grapple.escapeSuccesses>holder?"grapple-free":"holding";
    s.grapple.holderSuccesses=holder;
    s.grapple.escapeSuccesses=null;
  } else if (step === "grapple-release" && s.stage === "holding" && isAttacker) {
    s.stage="grapple-free";
    s.note="HOLD RELEASED";
  } else if (step === "defense" && s.stage === "defense" && isDefender) {
    if (!["dodge", "block", "parry", "none"].includes(payload.choice)) throw new Error("Unknown defense");
    const successes = payload.choice === "none" ? 0 : clamp(payload.successes, 0, 100);
    s.defense = {choice:payload.choice, successes};
    s.netSuccesses = Math.max(0, s.attackSuccesses - successes);
    s.stage = s.netSuccesses > 0 ? "damage" : "miss";
  } else if (step === "damage" && s.stage === "damage" && isAttacker) {
    const successes = clamp(payload.successes, 0, 100);
    s.damage = {successes};
    s.stage = successes > 0 ? "soak" : "done";
    if (!successes) {
      s.soak = {choice:"not needed",successes:0};
      s.finalDamage = 0;
      s.note = "No damage to apply.";
    }
  } else if (step === "soak" && s.stage === "soak" && isDefender) {
    if (!["roll", "none"].includes(payload.choice)) throw new Error("Unknown soak choice");
    const successes = payload.choice === "none" ? 0 : clamp(payload.successes, 0, 100);
    s.soak = {choice:payload.choice, successes};
    const afterSoak = Math.max(0, s.damage.successes - successes);
    s.finalDamage = s.damageType === "bashing" && gameType(target).includes("vampire")
      ? Math.floor(afterSoak / 2) : afterSoak;
    s.note = s.damageType === "bashing" && gameType(target).includes("vampire")
      ? "V20: bashing damage halved after soak (round down)." : "";
    s.stage = s.finalDamage > 0 ? "resolved" : "done";
    if (s.finalDamage === 0) s.note = [s.note, "No damage to apply."].filter(Boolean).join(" ");
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
    const restored = {...target.system.health.damage};
    for (const key of VALID_DAMAGE) {
      const count = safeInt(s.undo.before[key]);
      changes[`system.health.damage.${key}`] = count;
      restored[key] = count;
    }
    Object.assign(changes, nativeHealthFields(target, restored));
    await target.update(changes);
    s.stage = "done";
    s.note = "Damage undone by GM; prior health counts restored.";
    s.undo = null;
  } else if (step === "skip" && s.stage === "resolved" && isGM) {
    s.stage = "done";
    s.note = safeInt(s.finalDamage) > 0 ? "Not applied to Actor health (GM choice)." : "No damage to apply.";
  } else if (step === "apply" && s.stage === "resolved" && isGM) {
    // Legacy zero-damage chat cards must never produce an Actor update.
    if (safeInt(s.finalDamage) <= 0) {
      s.stage = "done";
      s.note = "No damage to apply.";
      return await advanceMessage(msg, s);
    }
    // Mark as applying BEFORE mutating health to prevent an accidental double application.
    s.stage = "applying";
    await updateMessage(msg, s);
    if (!target.system?.health?.damage || typeof CombatHelper?.ApplyDamageWithOverflow !== "function") {
      throw new Error("Health model unsupported: left at APPLYING for manual review");
    }
    const before = Object.fromEntries(VALID_DAMAGE.map(k => [k, safeInt(target.system.health.damage[k])]));
    const updated = foundry.utils.deepClone(target.system.health.damage);
    const max = CombatHelper.GetMaxHealthLevels(target.system);
    if (max < 1) throw new Error("Target has no native health track; inspect before resolving");
    const applied = CombatHelper.ApplyDamageWithOverflow(updated, s.damageType, s.finalDamage, max);
    const healthFields = nativeHealthFields(target, updated);
    updated.woundlevel = healthFields["system.health.damage.woundlevel"];
    updated.woundpenalty = healthFields["system.health.damage.woundpenalty"];
    const changes = {"system.health.damage":updated};
    for (const [key, value] of Object.entries(healthFields)) {
      if (!key.startsWith("system.health.damage.")) changes[key] = value;
    }
    await target.update(changes);
    s.undo = {before,after:Object.fromEntries(VALID_DAMAGE.map(k => [k,safeInt(updated[k])]))};
    s.stage = "done";
    s.note = applied === s.finalDamage ? "Applied to native Actor health." : `Applied ${applied}; remainder requires GM adjudication (overflow).`;
  } else {
    throw new Error("Step out of sequence or user does not control the required Actor");
  }
  await advanceMessage(msg, s);
}
function send(payload) {
  const leader = activeGM();
  if (!leader) return notify("A GM must be online to coordinate cross-player combat.");
  payload.userId = game.user.id;
  if (isLeader()) return authoritative(payload);
  game.socket.emit(CHANNEL, payload);
}
// Bound async waits avoid freezing combat if upstream chat/animation hooks change.
async function withDeadline(promise, milliseconds, fallback = null) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise(resolve => { timer = setTimeout(() => resolve(fallback), milliseconds); })
    ]);
  } finally { clearTimeout(timer); }
}
// WoD20 v7.3.1 starts ChatMessage.create without awaiting completion.
// Watch the matching native dice message before moving our card below it.
async function awaitNativeRollDisplay(actor, doRoll) {
  const canObserve = typeof Hooks?.on === "function" && typeof Hooks?.off === "function";
  let settleMessage;
  const foundMessage = new Promise(resolve => { settleMessage = resolve; });
  const onMessage = (message, _options, userId) => {
    if (userId !== game.user.id || message?.speaker?.actor !== actor?.id) return;
    if (!message?.rolls?.length) return;
    settleMessage(message);
  };
  if (canObserve) Hooks.on("createChatMessage", onMessage);
  try {
    const successes = await doRoll();
    if (!canObserve) return successes;
    const nativeMessage = await withDeadline(foundMessage, 2500);
    const waitForDice = game.modules?.get?.("dice-so-nice")?.active
      ? game.dice3d?.waitFor3DAnimationByMessageID : null;
    if (nativeMessage?.id && typeof waitForDice === "function") {
      try {
        await withDeadline(
          Promise.resolve(game.dice3d.waitFor3DAnimationByMessageID(nativeMessage.id)), 30000
        );
      } catch (error) {
        console.warn(`${MODULE} | Dice So Nice completion unavailable; continuing combat`, error);
      }
    }
    return successes;
  } finally {
    if (canObserve) Hooks.off("createChatMessage", onMessage);
  }
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
  return clamp(await awaitNativeRollDisplay(actor, () => DiceRoller(roll)), 0, 100);
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
function attackContext({attackerActor = null, attackerToken = null} = {}) {
  if (!DiceRoller) { notify("WoD20 dice functions unavailable."); return null; }
  // Sheet buttons supply an Actor; a token's right-click HUD supplies its
  // TokenDocument. A bare open() still supports a single controlled token.
  const tokenDoc = attackerToken?.document ?? attackerToken;
  const selected = attackerActor || tokenDoc ? [] : (canvas.tokens?.controlled ?? []);
  if (!attackerActor && !tokenDoc && selected.length !== 1) { notify("Select exactly one attacking token."); return null; }
  const attacker = attackerActor ?? tokenDoc?.actor ?? selected[0]?.actor;
  if (!attacker || !mayUse(game.user.id, attacker)) { notify("You do not control this Actor."); return null; }
  const attackerUuid = attackerActor?.uuid ?? tokenDoc?.uuid ?? selected[0]?.document?.uuid;
  if (!attackerUuid) { notify("Cannot identify the attacking Actor."); return null; }
  const targets = [...game.user.targets];
  if (targets.length !== 1) { notify("Target exactly one defending token."); return null; }
  const target = targets[0];
  if (!target?.actor) { notify("Target has no Actor."); return null; }
  if (!activeGM()) { notify("A GM must be online to coordinate combat."); return null; }
  return {attacker,attackerUuid,target};
}
async function open({attackerActor = null, attackerToken = null} = {}) {
  const context = attackContext({attackerActor, attackerToken});
  if (!context) return;
  const {attacker, attackerUuid, target} = context;
  const weapons = attackWeaponList(attacker);
  const fields = [
    {name:"weapon",label:"Weapon",type:"select",options:[{value:"",label:"Unarmed Strike"},...weapons.map(i=>({value:i.id,label:i.name}))]},
    {name:"difficulty",label:"Attack difficulty (0 = native default)",value:0,min:0,max:10},
    {name:"modifier",label:"Additional attack dice (+/-)",value:0,min:-50,max:50},
    {name:"damageOverride",label:"Damage type",type:"select",options:[
      {value:"",label:"Weapon default"}, {value:"bashing",label:"Bashing"},
      {value:"lethal",label:"Lethal"}, {value:"aggravated",label:"Aggravated"}
    ]},
    {name:"attacks",label:"Number of attacks (splits attack dice evenly)",type:"select",options:[1,2,3,4].map(n=>({value:String(n),label:String(n)}))}
  ];
  if (weapons.some(i=>i.type==="Ranged Weapon" && (i.system?.mode?.hasburst || i.system?.mode?.hasfullauto))) {
    fields.push({name:"fireMode",label:"Ranged firing mode (available on compatible weapons)",type:"select",options:availableFireModes(weapons)});
  }
  const choice = await promptFields(`${attacker.name}: Attack ${target.name}`,fields,"Roll Attack");
  if (!choice) return;
  const item = choice.weapon ? attacker.items.get(choice.weapon) : null;
  if (choice.weapon && !item) return notify("Weapon no longer exists.");
  if (isGrappleManeuver(item)) return notify("Use Actions → Grapple for this maneuver.");
  const count=clamp(choice.attacks||1,1,4);
  const mode=choice.fireMode||"single";
  if (count>1 && mode!=="single") return notify("Burst/full-auto and split multiple actions cannot be combined here.");
  if (!supportsFireMode(item,mode)) return notify("That weapon does not support the selected firing mode.");
  const spec=FIRE_MODES[mode]??FIRE_MODES.single;
  const stats=attackData(attacker,item);
  const difficulty=choice.difficulty==="0"||choice.difficulty===0||choice.difficulty==null
    ? clamp(stats.difficulty+spec.difficulty,2,10) : clamp(choice.difficulty,2,10);
  const modifier=clamp(choice.modifier,-50,50);
  const pool=Math.max(0,stats.pool+modifier+spec.bonus);
  const split=count>1?splitAttackPool(pool,count):null;
  if (count>1 && !split) return notify(`Cannot divide ${pool} attack dice among ${count} attacks.`);
  const ammo=ammunitionUse(item,mode);
  if (!ammo.valid) return notify(`${item.name}: firing mode ${mode} needs ${ammo.required} rounds; ${ammo.left} loaded.`);
  const success=await nativeRoll(attacker,{
    origin:"attack",action:`${item?.name||"Unarmed Strike"} attack`,
    attribute:stats.attribute,ability:stats.ability,
    pool:split?split[0]:pool,difficulty,bonus:modifier,
    extraInfo:[`Target: ${target.name}`,
      ...(mode!=="single"?[`Native firing mode: ${spec.caption} (+${spec.bonus} dice, +${spec.difficulty} difficulty)`]:[]),
      ...(split?[`Split action 1/${count}: pools ${split.join("/")}`]:[])]
  });
  if (ammo.spend && !await spendAmmunition(item,mode)) return notify("Ammo changed before expenditure; ask the GM to review this roll.");
  send({type:"start",nonce:foundry.utils.randomID(),attackerUuid,
    targetUuid:target.document.uuid,weaponId:item?.id||null,successes:success,
    damageOverride:choice.damageOverride,maneuver:"strike",firingMode:mode,attackDifficulty:difficulty,
    combo:split?{index:1,count,pools:split,continued:false}:null});

}
// Grapple is a distinct action: never display weapons, ammo, attack splitting,
// damage type, or ranged firing modes in the initial grapple prompt.
async function openGrapple({attackerActor = null, attackerToken = null} = {}) {
  const context = attackContext({attackerActor, attackerToken});
  if (!context) return;
  const {attacker, attackerUuid, target} = context;
  const base = Math.max(0, attributeValue(attacker, "strength") + abilityValue(attacker, "brawl"));
  const choice = await promptFields(`${attacker.name}: Grapple ${target.name}`, [
    {name:"pool",label:"Strength + Brawl dice",value:base,min:0,max:100},
    {name:"difficulty",label:"Difficulty",value:6,min:2,max:10}
  ], "Roll Grapple");
  if (!choice) return;
  const pool = clamp(choice.pool ?? base, 0, 100);
  const difficulty = clamp(choice.difficulty ?? 6, 2, 10);
  const successes = await nativeRoll(attacker, {
    origin:"attack",action:"Grapple / Hold",
    attribute:"strength",ability:"brawl",pool,difficulty,
    extraInfo:[`Target: ${target.name}`, "Grapple: opposed Strength + Brawl"]
  });
  send({type:"start",nonce:foundry.utils.randomID(),attackerUuid,
    targetUuid:target.document.uuid,weaponId:null,successes,
    maneuver:"hold",firingMode:"single",attackDifficulty:difficulty,combo:null});
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
  if (action === "next-attack" && state.combo && ["done","miss"].includes(state.stage)) {
    if (!mayUse(game.user.id,actor)) return notify("Only the attacker can make the next attack.");
    if (state.combo.continued||state.combo.index>=state.combo.count) return notify("This attack sequence is already complete.");
    const index=state.combo.index+1;
    const pool=state.combo.pools[index-1];
    const item=state.weaponId?actor.items.get(state.weaponId):null;
    if (state.weaponId&&!item) return notify("The attacker's weapon was removed.");
    const targets=[...game.user.targets];
    if (targets.length>1) return notify("Target only one defender for the next attack.");
    const current=targets.length===1?targets[0]:null;
    if (current&&!current.actor) return notify("New targeted token has no Actor.");
    const targetUuid=current?.document?.uuid??state.targetUuid;
    const targetName=current?.name??state.targetName;
    const ammo=ammunitionUse(item,"single");
    if (!ammo.valid) return notify(`${item.name}: no ammunition for another attack.`);
    const stats=attackData(actor,item);
    const successes=await nativeRoll(actor,{
      origin:"attack",action:`${item?.name||"Unarmed Strike"} split attack ${index}/${state.combo.count}`,
      attribute:stats.attribute,ability:stats.ability,pool,
      difficulty:clamp(state.attackDifficulty||stats.difficulty,2,10),
      extraInfo:[`Target: ${targetName}`,`Split action ${index} of ${state.combo.count}: ${pool} dice`]
    });
    if (ammo.spend&&!await spendAmmunition(item,"single")) return notify("Ammo changed; ask GM to review attack.");
    return send({type:"continue",messageId:msg.id,index,targetUuid,successes});
  }
  if (["grapple-resist","grapple-none","grapple-escape","grapple-hold","grapple-release"].includes(action)) {
    const holderAction=["grapple-hold","grapple-release"].includes(action);
    const contender=holderAction?actor:defender;
    if (!mayUse(game.user.id,contender)) return notify("Only the acting grappler (or GM) can respond.");
    if (action==="grapple-release") return send({type:"advance",messageId:msg.id,step:action});
    if (action==="grapple-none") return send({type:"advance",messageId:msg.id,step:"grapple-resist",choice:"none",successes:0});
    const base=attributeValue(contender,"strength")+abilityValue(contender,"brawl");
    const opts=await promptFields(`${contender.name}: ${action.replace("grapple-","")} (Strength + Brawl)`,[
      {name:"pool",label:"Strength + Brawl dice",value:base,min:0,max:100},
      {name:"difficulty",label:"Difficulty",value:6,min:2,max:10}
    ]);
    if (!opts) return;
    const successes=await nativeRoll(contender,{
      origin:"attack",action:`Grapple ${action.replace("grapple-","")}`,
      attribute:"strength",ability:"brawl",pool:clamp(opts.pool,0,100),difficulty:clamp(opts.difficulty,2,10),
      extraInfo:[`Grapple: ${actor.name} holding ${defender.name}`]
    });
    return send({type:"advance",messageId:msg.id,
      step:action==="grapple-resist"?"grapple-resist":action,
      ...(action==="grapple-resist"?{choice:"roll"}:{}),successes});
  }
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
// The WoD20 Dodge Button module inserts its shortcut synchronously during this
// same render hook. Defer ours until all render hooks have run so our control is
// immediately below Dodge regardless of module load order. Its presence is
// optional: without Dodge, Combat sits immediately below native Roll.
function sheetButtonColor(dodge, dice) {
  const value = dodge?.querySelector?.("svg rect[fill]")?.getAttribute?.("fill")
    ?? dice?.querySelector?.("svg path[fill]")?.getAttribute?.("fill")
    ?? "";
  return /^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(value) ? value : "#7d3f84";
}
function combatSheetIcon(color) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30" width="30" height="30" aria-hidden="true" focusable="false" style="border-radius:3px;height:30px;width:30px">
    <rect width="30" height="30" fill="${color}"/>
    <svg x="2" y="2" width="26" height="26" viewBox="0 0 512 512" aria-hidden="true">
      <g transform="translate(-33,-14)">
        <path fill="#fff" d="M19.75 14.438c59.538 112.29 142.51 202.35 232.28 292.718l3.626 3.75.063-.062c21.827 21.93 44.04 43.923 66.405 66.25-18.856 14.813-38.974 28.2-59.938 40.312l28.532 28.53 68.717-68.717c42.337 27.636 76.286 63.646 104.094 105.81l28.064-28.06c-42.47-27.493-79.74-60.206-106.03-103.876l68.936-68.938-28.53-28.53c-11.115 21.853-24.413 42.015-39.47 60.593-43.852-43.8-86.462-85.842-130.125-125.47-.224-.203-.432-.422-.656-.625C183.624 122.75 108.515 63.91 19.75 14.437zm471.875 0c-83.038 46.28-154.122 100.78-221.97 161.156l22.814 21.562 56.81-56.812 13.22 13.187-56.438 56.44 24.594 23.186c61.802-66.92 117.6-136.92 160.97-218.72zm-329.53 125.906l200.56 200.53c-4.36 4.443-8.84 8.793-13.405 13.032L148.875 153.53l13.22-13.186zm-76.69 113.28l-28.5 28.532 68.907 68.906c-26.29 43.673-63.53 76.414-106 103.907l28.063 28.06c27.807-42.164 61.758-78.174 104.094-105.81l68.718 68.717 28.53-28.53c-20.962-12.113-41.08-25.5-59.937-40.313 17.865-17.83 35.61-35.433 53.157-52.97l-24.843-25.655-55.47 55.467c-4.565-4.238-9.014-8.62-13.374-13.062l55.844-55.844-24.53-25.374c-18.28 17.856-36.602 36.06-55.158 54.594-15.068-18.587-28.38-38.758-39.5-60.625z"/>
      </g>
    </svg>
  </svg>`;
}
function addSheetCombatButtons(app, root) {
  if (game.system?.id !== "worldofdarkness" || app?.actor?.type !== "PC" || !root?.querySelectorAll) return 0;
  let count = 0;
  for (const dice of root.querySelectorAll('.macroBtn[data-rolldices="true"]')) {
    const toolbar = dice.parentElement;
    if (!toolbar || toolbar.querySelector?.(SHEET_BUTTON)) continue;
    const dodge = toolbar.querySelector?.(DODGE_BUTTON);
    const anchor = dodge ?? dice;
    const color = sheetButtonColor(dodge, dice);
    const btn = document.createElement("a");
    btn.className = "macroBtn pointer stl-combat-sheet-button";
    btn.setAttribute("role", "button");
    btn.setAttribute("tabindex", "0");
    btn.setAttribute("aria-label", "Combat Workflow");
    btn.title = "Combat Workflow — Attack, Defense, Damage, Soak";
    btn.innerHTML = combatSheetIcon(color);
    const activate = event => {
      event.preventDefault();
      event.stopPropagation();
      void open({attackerActor:app.actor}).catch(error => {
        console.error(`${MODULE} | Sheet shortcut failed`, error);
        notify(`Combat workflow: ${error.message}`);
      });
    };
    btn.addEventListener("click", activate);
    btn.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") activate(event);
    });
    anchor.insertAdjacentElement("afterend", btn);
    count++;
  }
  return count;
}
Hooks.on("renderActorSheetV2", (app, root) => {
  queueMicrotask(() => addSheetCombatButtons(app, root));
});

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
  const api = Object.freeze({open,openGrapple});
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

// One native Token HUD launcher for both independent combat and magick tools.
// The panel is a small overlay; it does not add columns or replace TokenHUD.
function magickPanelAPI() {
  const mod = game.modules?.get?.("wod20-player-actions");
  return mod?.active && typeof mod.api?.openPanel === "function" ? mod.api : null;
}
async function launchTokenAction(action, tokenDoc) {
  const actor = tokenDoc?.actor;
  if (!actor || !mayUse(game.user.id, actor)) {
    return notify("You do not control this token's Actor.");
  }
  if (action === "combat") return open({attackerToken: tokenDoc});
  if (action === "grapple") return openGrapple({attackerToken: tokenDoc});
  if (action === "magick") {
    const magick = magickPanelAPI();
    if (!magick) return notify("Enable WoD20 Player Actions to use Magick.");
    // Player Actions v0.1.14+ publicly accepts an Actor in openPanel(actor).
    // Never use a global selected token or create a second casting engine.
    return magick.openPanel(actor);
  }
}
function addTokenHudActionsButton(hud, root) {
  if (game.system?.id !== "worldofdarkness" || !root?.querySelector) return false;
  const tokenDoc = hud?.document ?? hud?.object?.document;
  const actor = tokenDoc?.actor;
  if (!tokenDoc?.uuid || !actor || !mayUse(game.user.id, actor)) return false;
  if (root.querySelector(".stl-token-actions-anchor")) return false;
  const container = root.querySelector(".col.right") ?? root.querySelector(".col.left");
  if (!container) return false;

  const anchor = document.createElement("div");
  anchor.className = "control-icon stl-token-actions-anchor";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "stl-token-actions-button";
  button.title = "Actions — Attack, Grapple & Magick";
  button.setAttribute("aria-label", "Actions — Attack, Grapple & Magick");
  button.setAttribute("data-tooltip", "Actions");
  button.setAttribute("aria-haspopup", "true");
  button.setAttribute("aria-expanded", "false");
  button.innerHTML = '<i class="fa-solid fa-bolt" aria-hidden="true"></i>';

  const menu = document.createElement("div");
  menu.className = "stl-token-actions-menu";
  menu.hidden = true;
  menu.setAttribute("role", "group");
  menu.setAttribute("aria-label", `Actions for ${actor.name}`);
  const closeMenu = () => {
    menu.hidden = true;
    button.setAttribute("aria-expanded", "false");
  };
  const addAction = (name, icon, action) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "stl-token-actions-item";
    item.setAttribute("aria-label", name);
    item.innerHTML = `<i class="${icon}" aria-hidden="true"></i><span>${name}</span>`;
    item.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      void Promise.resolve().then(() => launchTokenAction(action, tokenDoc)).catch(error => {
        console.error(`${MODULE} | Token HUD ${action} failed`, error);
        notify(`Actions: ${error.message}`, "error");
      });
    });
    menu.appendChild(item);
  };
  addAction("Attack", "fa-solid fa-crosshairs", "combat");
  addAction("Grapple", "fa-solid fa-hand-fist", "grapple");
  if (magickPanelAPI()) addAction("Magick", "fa-solid fa-wand-magic-sparkles", "magick");

  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    menu.hidden = !menu.hidden;
    button.setAttribute("aria-expanded", String(!menu.hidden));
    if (!menu.hidden && anchor.getBoundingClientRect && menu.getBoundingClientRect && typeof window !== "undefined") {
      const rect = anchor.getBoundingClientRect();
      const panel = menu.getBoundingClientRect();
      const top = Math.max(6, Math.min(rect.top + rect.height / 2 - panel.height / 2, window.innerHeight - panel.height - 6));
      menu.style.top = `${top - rect.top}px`;
      menu.style.transform = "none";
      menu.classList.toggle("stl-token-actions-menu--flip", rect.left < panel.width + 10);
    }
  });
  menu.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      button.focus?.();
    }
  });
  // The HUD itself disappears on close; all handlers and the menu go with it.
  menu.addEventListener("click", event => event.stopPropagation());

  anchor.appendChild(button);
  anchor.appendChild(menu);
  const nativeCombat = container.querySelector?.('button[data-action="combat"]');
  if (nativeCombat?.insertAdjacentElement) nativeCombat.insertAdjacentElement("afterend", anchor);
  else container.appendChild(anchor);
  return true;
}
Hooks.on("renderTokenHUD", (hud, root) => {
  addTokenHudActionsButton(hud, root?.querySelector ? root : hud?.element);
});
