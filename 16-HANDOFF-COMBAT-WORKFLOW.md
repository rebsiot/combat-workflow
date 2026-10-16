# 16 - Combat Workflow handoff

**Owning chat:** 16.1 - Combat Macro
**Artifact:** `stl-combat-workflow` v0.1.5 standalone field-test
**Status:** User v0.1.2 screenshot confirms attack, defense, damage, soak and GM Undo in Foundry; v0.1.3 roll timing and moving card are mock-tested only; two-client verification pending
**Date:** 2026-10-15

## Agreed intent

Provide player-facing sequential combat roll cards resembling the existing Magick macro's low-friction workflow; native Actor weapons and native WoD20 dice must be used. Full basic path is Attack, Dodge/Block/Parry, Damage, Soak, and GM-optional health application. GM should not need excessive approval steps for normal rolls.

## Implemented in this version

- One attacker token/one target; native Melee/Ranged Item or unarmed.
- ChatMessage-flag state machine and native dice rolls.
- Client chat buttons for the controlling attacker/defender (or GM); elected online GM updates workflow state over the native module socket.
- Native soak pool and native CombatHelper health application, confirmed GM apply / guarded Undo.
- V20 basic bashing and firearm special cases.
- Token-scene tool, optional macro API.

## Known source/input gaps

- `00-START-HERE.md` and any existing 16 handoff were not supplied.
- Actual installed WoD20 system 7.3.x files, Magick/Player Actions source ZIP and sample Combat Library weapon exports were not supplied. Implementation was based only on public WoD20 7.3.1 source and official Foundry v14 API reference.
- Live GM/player Foundry v14 and browser checks not run. Do not treat release ZIP creation as deployment or live success.

## Deferred

Multi-target fire, full-auto/burst/spray, action economy, complicated counterattacks, magick defense/countermagick, special soak, health consequences beyond the native health model. Test normal flow before adding them.

## Required live smoke test

Use the nine-step plan in `README.md`; the first high-value test is a two-client simple melee hit/dodge/damage/soak sequence with native chat cards and health Apply/Undo. Any failure should be reproduced with the browser console and a real weapon JSON.

## Cross-module contracts/status updates

- `GLOBAL-02`: Add Combat Workflow as a **consumer** of native WoD20 Item/roll/health and ChatMessage interfaces; it must not own dice, Paradox or Combat Library content.
- `GLOBAL-03`: Add two-user basic combat smoke test before release.
- `GLOBAL-04`: Add module 16 to the development queue as preview/unverified until live testing.
- Existing 05 Player Actions, 08/09 dice/Paradox and Combat Library ownership remains unchanged. Check integration when these module ZIPs are available.

## v0.1.1 integration — sheet launcher under Dodge

- Combat Workflow **owns** the injected `macroBtn.stl-combat-sheet-button` for PC `renderActorSheetV2`, directly after `macroBtn.wod20-dodge-button`; if the Dodge module is absent, insert after the native Roll button.
- Uses a microtask after the synchronous render hooks to remain independent of the registration order of `wod20-dodge-button`; no modification to the existing Dodge module or its `src/main.js`.
- The Combat sheet button launches `game.stlCombatWorkflow.open({attackerActor: app.actor})` internally. The Actor UUID is used for the attacker; canvas targeting of one defender is still required. The original Token Controls and no-argument `open()` entry points retain token-selection behavior.
- Test status: syntax/JSON and Node mock tests only until verified on the user's live Foundry v14 PC sheet.
- Cross-module handoff: the Dodge-button module remains separate and unchanged; document Combat shortcut's optional anchor CSS class as a read-only integration contract if its handoff is updated.

## v0.1.2 CSS contrast correction

- User live screenshot of v0.1.1 showed unreadably dark defender choices. Inspection showed the buttons were ordinary enabled HTML controls; the defect was inherited dark theme text, not disabled permissions.
- `styles/combat-workflow.css` now explicitly sets scoped contrast for normal, hover/focus and disabled actions. This fixes defense, attack/damage, soak and final GM buttons without changing native WoD20 UI or JavaScript behavior.
- Added `tests/test-chat-contrast.cjs` (static color ratio checks) to prevent regression. Other tests unchanged.
- v0.1.1 remains the rollback target. v0.1.2 changes no Actors, flags, schemas, hook contracts, or other module data.
- Need real live screenshot/check in user's dark Foundry theme after update; two-player workflow still unverified.

## v0.1.3: Wait for native rolls / keep current card below dice

- Live user screenshot of v0.1.2 showed a completed attack/defense/damage/soak sequence with Undo, but the workflow card stayed above older roll results and advanced before Dice So Nice finished.
- Inspection of public WoD20 7.3.1 `roll-dice.js` shows native `DiceRoller` starts `ChatMessage.create(chatData)` without awaiting it. `awaitNativeRollDisplay()` listens on `createChatMessage` for the local author's Actor and actual rolled dice and only then optionally waits for `game.dice3d.waitFor3DAnimationByMessageID(nativeMessage.id)` (guarded by presence of the Dice So Nice module/API and capped timeouts). The native DiceRoller remains the only roller.
- `advanceMessage()` creates the next workflow ChatMessage **after** the roll and deletes the prior workflow ChatMessage to keep one actionable card at the bottom of the chat. If deletion fails, it attempts to mark the old one inactive; if new-card creation fails, the old one remains. Native WoD20 dice/chat rolls are never deleted. Intermediate APPLYING uses `updateMessage()` in place to preserve the once-only health write guard.
- Preserves schema 1, native Actor data, system roll/chat types, chat flags, permissions, sheet launcher/Dodge integration, and Combat Library contract. No unrelated modules changed.
- New tests `test-roll-timing.cjs`, updated `test-workflow.cjs`; Node mock checks and parse checks pass. Need a real Dice So Nice roll and a 2-client GM/player sequence to verify expected pacing/order in Foundry 14.
- v0.1.2 is the release rollback. Disabling v0.1.3 does not restore intentionally deleted old workflow cards. World health changes remain subject to normal Undo/backup discipline.

## v0.1.4 result banner and sheet icon

- Owning chat 16.1, repository `rebsiot/combat-workflow`; preserves module ID and schema 1.
- User requested a conspicuous colored result at end of each attack: misses, successful defenses, zero damage, and final damage amount/type. Added a single scoped status banner to each terminal state, with separate color for undone health.
- Sheet launcher still belongs to Combat Workflow (not Dodge). Replaced its original shield art with the crossed-swords silhouette from native WoD20 `assets/img/items/meleeweapons.svg`, rendered white against the existing sheet splat-color square.
- No change to native rolls, attack/soak calculations, chats' progressive placement, GM permissions, health data or Undo mechanics.
- Regression checks include banner states, escape safety and sheet icon. Syntax/Node mock only, not live Foundry. v0.1.3 rollback.
- Cross-module contract unchanged: read-only integration with Dodge class `macroBtn.wod20-dodge-button`. No other handoff edits required.

## v0.1.4 follow-up: Restore displayed wound condition on Apply/Undo

- User live report: rewinding three damage after Incapacitated restored wound counts but left the condition displayed as Incapacitated. Root cause: module only wrote the bashing/lethal/aggravated counters while WoD20 `module/actor/data/wod-actor-base.js` separately stores `system.health.damage.woundlevel`, `woundpenalty`, and `system.traits.health.totalhealthlevels`. Derived computation is async and not a guaranteed persisted document update.
- New `nativeHealthFields(actor, damage)` mirrors WoD20's ordered `CONFIG.worldofdarkness.woundLevels` and `max(normal,chimerical)` logic. Apply writes updated damage object plus native derived total-health fields atomically; Undo writes restored counters and condition/penalty/remaining health in the same update. The previous guard against intervening wound-count changes remains. Chimerical counts are preserved.
- Tests cover 0 damage cleared, 2 wounds to Hurt, 4+3 to Incapacitated followed by Undo to Wounded, correct wound penalties and remaining levels, and chimerical severity. No live Foundry test for this fix yet.
- Important caveat: Existing inconsistent Actors from pre-v0.1.4 Undo require manual inspection; installing this version does not mass-edit Actors.
## v0.1.5 — compatibility metadata

- User reported Foundry showing compatibility unknown. v0.1.4 module manifest had `compatibility.minimum: "14"` but no `verified` field.
- Set core `compatibility.verified: "14"` based on current user's live Foundry v14 testing, preserved min 14 and WoD20 system relationship minimum 7.3.1. No core `maximum` restriction.
- Independent v0.1.5 release, no runtime edits or Actor changes. Re-test in Foundry Setup after module update; full two-client game testing remains outstanding.
- Rollback to v0.1.4 if needed; v0.1.4 will again show compatibility unknown, but code behavior is identical.
