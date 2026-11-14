# 16 - Combat Workflow handoff

**Owning chat:** 16.1 - Combat Macro
**Artifact:** `stl-combat-workflow` v0.2.5 experimental field-test
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

## v0.1.5 — Foundry core compatibility metadata

- Declares `compatibility.verified: "14"`, keeping Foundry minimum 14 and WoD20 relationship minimum 7.3.1. Other runtime functionality unchanged.

## v0.1.6 — Turn banners and zero-damage auto-complete

- User screenshot: a green NO DAMAGE banner still offered redundant Apply to Health/Leave Unapplied controls, and defense choices were easy to miss because chat header continued to say attacker's name (Marlowe).
- Added prominent `turnPrompt(state)` to action-stage cards with named target for defense/soak, named attacker for damage, and clear Storyteller/GM prompt for positive damage. The message speaker switches with acting Actor; neutral alias for terminal states. No remote popup or duplicate action authority.
- Zero-success damage transitions straight to `done` with finalDamage 0. Soak >= damage successes, and Vampire bashing rounding to zero, also transition straight to `done`. Neither case offers health application. Historical resolved/0 cards render without buttons and any old server-side Apply command finalizes without Actor mutation.
- Actor ownership checks, native roll functions, original chat roll messages, health changes and safety guard remain unchanged. Existing chat messages are not bulk-modified.
- Node tests: existing mock suite and `tests/test-turn-and-zero.cjs` pass; live Foundry v14 2-player turn cue/zero-damage verification remains necessary.
- Release v0.1.6, owning thread 16.1; v0.1.5 rollback. Shared `GLOBAL-03` should note added no-damage and turn-ownership smoke checks; `GLOBAL-02` data contract unchanged and Dodge module untouched.

## v0.1.7 — Player-color compact turn indicator

- User showed v0.1.6 banner and requested removal of role heading and instructional line: display **only the acting character name** in a box using that character's Foundry player color.
- Combat Workflow module owns this view; update is entirely its own `scripts/combat-workflow.js` and scoped stylesheet. Did not modify Dodge/Player Actions/other modules.
- Find assigned non-GM user through `User.character`; otherwise explicit owner or player with OWNER permission; fallback to elected active GM for NPCs and Storyteller stages. Read `User.color`, including v14 Color.css, sanitize hex before HTML interpolation; derive readable foreground automatically. Each new workflow ChatMessage stores its color styling in content for consistent display across all viewers.
- Only the single actor name remains inside the turn banner. Chat speaker and roll buttons unchanged. No migration, extra permissions, or data-contract changes.
- Existing 0.1.6 workflow cards retain their original appearance; updates are reflected in newly created cards.
- Node tests include color ownership and hostile/invalid CSS fallback. Two-player live visual validation remains pending. Owning conversation 16.1, rollback 0.1.6.


## v0.1.8 — Roll suffix on acting actor name

- User supplied v0.1.7 soak screenshot and requested bold text **ThugMelee (1) Roll** in the player-colored acting character box.
- Append ` Roll` for defense, damage, soak phases. Keep the GM `Storyteller` phase label unchanged. No additional text or role headings. Existing speaker behavior, controls, and player coloring preserved.
- Presentation-only inside Combat Workflow module. Regression tests updated; Foundry live check pending. Rollback v0.1.7. No changes to adjacent modules or cross-module contracts.


## v0.1.9 — Replace sidebar shield with native Token HUD attack control

- User requests removal of the always-visible left Token Controls shield; combat shortcut is more appropriate as a compact attack icon when right-clicking one's token.
- The Combat Workflow module owns both its PC sheet control (unchanged below Dodge) and the new native Foundry v14 `renderTokenHUD` injection. Removed `getSceneControlButtons` injection completely.
- Right-click HUD button uses WoD20 `assets/img/items/meleeweapons.svg`, inserted as a native `.control-icon` in `.col.right` directly following the native combat control (fallback to available HUD column), only when current user owns the Actor or is GM. Dedupe on re-renders.
- `open({attackerToken})` accepts a Token/TokenDocument, resolves its linked/synthetic Actor and uses the TokenDocument UUID. No dependence on `canvas.tokens.controlled`; PC sheet `open({attackerActor})` and macro `open()` preserved.
- No changed Actor or Scene data, combat state schema, dice/permissions contracts or adjacent modules. Foundry v14 TokenHUD markup integration is mock-tested only; confirm live right-click placement and correct token context. Rollback v0.1.8.


## v0.1.10 — Compact Actions menu cross-module launcher

- User reported v0.1.9 Token HUD crossed-swords icon resembled native Enter Initiative and wanted convenient player Magick without a column of six extra HUD controls; approved one Actions button with a labeled Combat/Magick flyout.
- **Owned by module 16:** Replace v0.1.9 Token HUD button with one grid-style Actions icon + small two-entry flyout, attached to the same native Foundry v14 `renderTokenHUD` hook. Combat launches the existing `open({attackerToken:tokenDoc})`. Magick dynamically detects `game.modules.get("wod20-player-actions")?.active` and calls its published `api.openPanel(tokenDoc.actor)`; hide Magick when missing. This Actor parameter is verified in Player Actions v0.1.14 `scripts/player-actions.js`. No edits to Player Actions or cross-module API required.
- Player Actions module ID `wod20-player-actions` and public `openPanel(actor)` remain independent. No rolls, Paradox, Resource, health, IDs, flags, import/export data or permissions contracts changed. Existing sheet button below Dodge and optional no-argument macro preserved; persistent left Token Controls shield was already removed in v0.1.9.
- Native Token HUD flyout is shown only for the acting user with Actor ownership (or GM). Contrast and accessibility for menu items; tiny only when collapsed; menu out-of-flow to avoid stretching Token HUD column. Buttons use dynamic checks, not dead placeholders.
- Automated Node mocks cover owner/GM visibility, deduplication, menu click, exact TokenDocument/Actor context, Magick API detection and keyboard close. **Live two-client Foundry HUD layout and Magick binding have not yet been tested.** Rollback v0.1.9. Companion Player Actions handoff `05-HANDOFF-UPDATE-0.1.14.md` should note the new *consumer* of `openPanel(actor)`; no code changes required in 05.


## v0.2.0 — Extended maneuvers and anchored HUD

- Owning thread 16.1. User approved implementing lightning-bolt HUD/flyout fix, burst/full-auto, split multiple attacks and grappling together. Scope restricted to independent Combat Workflow module; never modify Player Actions (05), Paradox, WoD20 system or other modules.
- Native source `worldofdarkness/module/dialogs/dialog-weaponv2.js` inspected: ranged `system.mode.hasburst/hasfullauto`, burst +3 dice/+1 difficulty/3 ammo, fullauto +10/+2/min half a clip/remaining ammunition spent. Respect `CONFIG.worldofdarkness.defaultAutoAmmo`. Spray/multi-target gunfire stays native.
- M20/V20 multiple actions share a lowest-pool divided dice approach. Implements *same-weapon sequential attacks* only, evenly distributed for up to 4; distinct target per Next Attack allowed. No supernatural extra actions or mixed ability allocations. Each attack has separate persistent flagged workflow card; validates continuation and prevents accidental double Next. Ordinary single attack unaffected.
- Hold grapple: initial Strength+Brawl vs defender Strength+Brawl resistance; persist hold in ChatMessage flags, defender Escape and holder Contest in later permitted actions, holder voluntary Release. Does not apply Active Effects, Actor flags, grapple damage, initiative spending or forced conditions.
- Token HUD Actions lightning bolt with flyout anchored to its button and runtime viewport-clamping/flipping; no additional permanent HUD icons or other module editing. Retains `wod20-player-actions.api.openPanel(actor)` contract.
- v0.2.0 regression tests include native mode data, ammo consumption, split pool, hold establishment/escape/maintain/release, chat card continuation, HUD anchor and prior health workflow. These are mock/local tests only; live Foundry and two-client exercise required before declaring compatibility.
- Upgrade: back up `Z:\Data\modules\stl-combat-workflow` and test world, install versioned ZIP, restart/refresh; rollback to v0.1.10. Neither upgrade nor rollback restores completed wound changes. Update this owning handoff; optional `GLOBAL-02` notes for Player Actions consumer already recorded in earlier v0.1.10 changes.


## v0.2.1 — Separate Grapple from Attack and shorten skip-soak label

- User found v0.2.0 Grapple option confusing because its initial attack dialog still displayed irrelevant weapon, ammo, damage, firing mode and multiple attack controls. User requested Grapple separate from Standard Attack.
- The sole Token HUD lightning-bolt flyout now offers **Attack**, **Grapple**, and (when Player Actions is active) **Magick**. No additional permanent HUD icons. Attack launches the existing weapon dialog without the Maneuver select. Grapple launches only Strength + Brawl dice and Difficulty using the same actor/target preflight, native dice and existing `maneuver:hold` state-machine path.
- Published module API is additive: `openGrapple({attackerActor,attackerToken})`, with default no-arg controlled-token behavior; existing `open` and Player Actions `openPanel(actor)` consumer remain unchanged. PC-sheet attack launcher remains attack-only.
- Defender's **Cannot / Won't Soak** button relabeled **No Soak** (tooltip explains) without changing its underlying `no-soak` callback, rules, chat stages or permissions.
- No existing chat flags, Actor health/Items, IDs, migrations, ammo maths or ownership changes. No adjacent modules edited.
- Regression mocks amended for Attack/Grapple separation, correct token binding, full native modes, split attacks and compact soak button. Live Foundry GM+player smoke test pending. Rollback v0.2.0.


## v0.2.2 — First-login user tutorial

- Owning conversation: 16.1 Combat Workflow. User requested a quick tutorial shown on first login, with **Don't show again** on the final page.
- Adds independent `scripts/tutorial.js` ES module and `styles/tutorial.css` to manifest. Does not touch attack, Grapple, Magick, chat cards, health or existing system APIs. First-login tutorial opens after `ready`, four brief screens (Token Actions, Attack, Grapple, Chat/Soak/GM Apply).
- Each person's opt-out is their own native Foundry User flag `flags.stl-combat-workflow.tutorialDismissed=true`, persisted by `game.user.setFlag`. No global/user-admin setting or forced completion. Closing without pressing final **Don't show again** does not store the flag; auto-prompt repeats on subsequent logins until dismissed. On-demand replay via a small `? Quick tutorial` footer inside the *existing* lightning-bolt Actions menu, including after dismissal; no extra permanent HUD icon.
- Node mock test covers lifecycle, four screens, per-user opt-out and replay/DOM dedupe. Requires live Foundry v14 check with non-GM User-document flag write permission, dialog appearance and HUD link layout. No world/Actor/Scene migrations, no adjacent-module changes. Backup module/world before updating; rollback v0.2.1. Keep User flag untouched if rolling back.


## v0.2.3 — Filter Grapple Item from Attack weapon choices

- Screenshot showed the system-native **Grapple** Melee Weapon Item in the Attack dropdown beside Bite, Disarm, Kick, Punch and Sweep, despite v0.2.1 having a separate Grapple launcher.
- Scope: owning Combat Workflow module 16 only. Attack populates the weapon options from `attackWeaponList(actor)` (the regular `weaponList(actor)` filtered only for Items with `type === 'Melee Weapon'` and trimmed case-insensitive `name === 'Grapple'`). No deletion or modification of the native Actor's Item; preserve `weaponList` for historical card validation and other internal uses. A manually provided suppressed Item id is rejected at Attack selection.
- Leave Bite, Disarm, Kick, Punch, Sweep, Unarmed Strike, all ranged guns and other melee options visible. Grapple remains in Token HUD **Actions → Grapple** with its minimal Strength + Brawl dialogue and existing Hold sequence. Per-user first-login tutorial v0.2.2 intact.
- Regression: Node mock includes all screenshot melee maneuvers and confirms only Grapple is hidden from Attack, while the source Item remains untouched. Live two-user Foundry/browser verification pending. Backup world/module before install; restore v0.2.2 for rollback. No cross-module API or schema changes. Update this owning handoff; no global data contract revisions required.


## v0.2.4 — Two-button Grapple chat layout

- User showed crowded Grapple defense/response buttons in the narrow chat sidebar. Keep one Token HUD lightning-bolt Actions menu and dedicated independent Grapple workflow from v0.2.1.
- Only the ChatMessage card button labels/layout change: initial Grapple defense **Resist** / **No Resist**, holding **Escape** / **Release Hold**, escape counter **Resist Escape**. Each retains its existing `data-stl-combat-action` key, WoD20 native dice behavior, GM coordination and state machine; tooltips explain the longer Strength + Brawl text. No actor, Item, health, flag or schema mutation.
- Added `.stl-combat-actions--paired` to paired Grapple button groups, with locally scoped two-column CSS grid and single-line typography. Other combat button groups and Foundry/other modules' buttons are unchanged.
- Node mock/static test checks chat labels, tooltips, CSS selectors and preservation of earlier weapon dropdown filtering. Live Foundry chat-column verification pending. Backup module/world before upgrade; restore v0.2.3 for rollback. No shared API or global data contract changes.


## v0.2.5 — Foundry display name only (2026-10-18)

- User explicitly approved changing only the Foundry display name to **WoD20 Combat Workflow**. The GitHub repository remains `rebsiot/combat-workflow`; module ID stays `stl-combat-workflow` and folder is unchanged. No reinstallation under a different ID or duplicate module is needed.
- Source of truth verified before edit: GitHub `v0.2.4`, commit `4b803d5320b40f24301413ee33c30cf062102e56` on `main`, module manifest v0.2.4 and published complete ZIP. Installed live module version and exact installed WoD20 version **unknown**; previous older basic combat live test does not validate this patch or v0.2.4 extension behavior.
- This is a name/version-only release to support clearer Foundry Module Management. No behavior, Actor/Item/Scene/Chat/User flags, macros/hotbars, permissions, dice, health, Magick API or Paradox logic changed. Automated manifest assertions include new display title, stable internal ID, and versioned ZIP URI.
- Rollback code: published v0.2.4 release; back up world and module folder prior to replacement. Safe to revert module files with Foundry stopped; completed combat health changes are not undone by rollback.
- Next live smoke test: update module in Foundry v14 world, refresh both GM/player clients, verify a single checkbox entry titled **WoD20 Combat Workflow** and correct enabled status, then execute one ordinary Attack → Defense → Damage → Soak → optional GM Apply/Undo (including chat roll creation). Updated release's two-client Grapple/HUD behavior remains unverified until user tests it.
- Scope excludes upcoming README/repository presentation cleanup in W17 proposed handoff; per user standard, reserve that work for next approved functional release. Proposed future owner 17 (former 16.1) is a private planning label, not a module ID or current chat rename. Shared contracts 100/101/104 unchanged.


## v0.2.6 — Native weapon Attack launcher (2026-11-14)

**Component / owner:** WoD20 Combat Workflow (proposed W17 / 17; historic development thread 16.1). Module ID `stl-combat-workflow` unchanged; repository `rebsiot/combat-workflow` unchanged. **Baseline verified before edits:** v0.2.5 tag/asset, commit `e3a2b515b2adead0a35c34d5ee88843def122d6e`; `main` and release tag matched. **Installed module version / live WoD20 version:** unknown; user's earlier live screenshots are not proof of v0.2.5 or v0.2.6 integration.

**Requirement:** When a player attacks using an owned Melee/Ranged Weapon's normal WoD20 sheet Attack control, automatically begin Combat Workflow. Do not roll twice and do not open two competing damage dialogs. Preserve the existing right-click Actions → Attack/Grapple/Magick menu, sheet Combat button, flags, health and Paradox boundaries.

**Verified upstream integration (source only):** In `JohanFalt/Foundry_WoD20` system source 7.3.2, `ActionHelper.RollDialog(dataset,actor)` is the native launcher for `dataset.rollitem === "true"`, `dataset.object === "Melee"|"Ranged"`, and `dataset.itemid`. It otherwise opens `DialogWeaponV2`. That dialog calls `DiceRoller` on attack and then transitions directly to its own damage state. Hooking a later ChatMessage would create competing workflows; we instead wrap `ActionHelper.RollDialog` at the start, only for eligible weapon attacks, to open the existing `open({attackerActor,weaponId})` prompt with the clicked weapon selected. One WoD20-native attack roll occurs inside Combat Workflow.

**Guards/fallback:** User must own Actor or be GM; exactly one token targeted; GM online; valid corresponding Melee/Ranged Weapon, attack roll permitted; not the system native Grapple Item; user client's new `autoWeaponAttacks` setting enabled (default true). Otherwise delegate unchanged to the original WoD20 `RollDialog`. Damage-only, Power, Item, Trait and other roll paths unaffected. Guard against rewrapping; if a new workflow fails after launch, notify instead of running native attack again (avoids potential double roll). Native WoD20 special weapon dialog options beyond module's features require opting out for that client.

**Files/contract:** `scripts/combat-workflow.js` adds `shouldStartFromNativeWeapon`, `installNativeWeaponLauncher`, optional `weaponId` in `open`, preselected choice support in `promptFields`, and a per-client Foundry setting. `module.json` title remains **WoD20 Combat Workflow** and ID `stl-combat-workflow`; version raised to 0.2.6, pinned release ZIP. No Actor/Scene/Journal/Item data migration, macro changes or Paradox handling. The `game.stlCombatWorkflow.open/openGrapple` API remains backward compatible.

**Release presentation:** Public README trimmed to first-use walkthrough, requirements, installation, simple example, limitations and links; new concise `RELEASE_NOTES.md`. Workflow packaging excludes `16-HANDOFF-...` and `tests/` from public installable ZIP, but source/historical handoff remains in GitHub for continuity pending separately approved removal. Private W17 handoff should be synchronized after actual live tests. No real-game screenshot was added; avoid publishing a private campaign screenshot without authorization.

**Test classification:** Automated/native-launch mock covers owner/GM, no target, multiple targets, no GM, client opt-out, Grapple, damage-only, disabled attack, foreign Item, correct preselection, once-only handling and error paths. Existing regression suite still expected to pass in CI. **Live Foundry two-client test: not run**. First live smoke test: as player, target exactly one NPC, click a real owned sword's native Attack control, verify Combat Workflow opens with that sword selected, one WoD20 native attack ChatMessage appears, defender gets Defense choices, GM Apply/Undo works. Remove target, repeat to verify native WoD20 weapon dialog appears. Test damage-only button remains native. Live v14 compatibility and WoD20 installed version must be recorded before declaring S3/S4.

**Upgrade/rollback:** Back up world and module folder, update to v0.2.6 via released ZIP/manifest, restart/hard-refresh. Immediate reversible fallback: turn off client setting **Use Combat Workflow from weapon attacks**. Code rollback: v0.2.5 full ZIP. Reverting code does not undo wounds applied during play. No shared data-contract change; 101/103/104 reference this behavior/evidence, 100 ownership of native rolls unchanged.


## v0.3.0 — Splat-aware Spirit / physical combat (2026-11-14)

**Component:** Proposed W17 / 17 (historical owner thread 16.1); published module ID **`stl-combat-workflow`** unchanged. **Baseline inspected**: connected GitHub repository `rebsiot/combat-workflow`, `v0.2.6` release asset `stl-combat-workflow-v0.2.6.zip`, `main` exact commit `cfa35a63396e316d5ef58574a6a7a9832b9c7b3f`, current manifest/entrypoints and tests. The user has not supplied the installed module ZIP or exact live system version; installed/deployed version remains **Unknown**. Foundry is documented v14 and WoD20 about 7.3.x; the upstream system source inspected is `JohanFalt/Foundry_WoD20` current `system.json` **7.3.2**, which is **not** proof of the live installed version.

**User approval:** GM needs Combat Workflow for vampires, werewolves, spirits and other WoD20 creatures, not only Mage/normal PC. Prior problem: a Spirit Actor has Rage/Gnosis/Willpower/Essence but no visible Dexterity/Brawl/Strength/Stamina; old module silently used missing values and risked writing a nonexistent wound track.

**Splat data contracts / implementation:**
- Treat `Actor.type==="Creature"` + `system.settings.variant==="spirit"` (and a native type `Spirit`) as a Spirit. Do not classify Werewolf/ChangingBreed actors as spirits from `hasrage`, `hasgnosis` or Rage alone.
- Physical combat Spirit: rollable `system.advantages.willpower.roll` (fallback `permanent`) for basic physical attacks/defense/soak; `system.advantages.rage.roll` (fallback `permanent`) for base physical damage; `system.advantages.gnosis` for nonphysical powers outside this module. Spirit basic unarmed/Punch/Kick defaults to lethal in M20; explicit damage override covers variant W20 aggravated/Charm rulings. Additional net-hit dice follow existing WoD20 system flag.
- Spirit Grapple begins with Willpower (coordination) and uses Rage for physical escape/hold; prompts remain manually adjustable, not a claim of full canonical Spirit Grapple/Charm automation.
- V20 physical soak, normal vampire bashing/firearm treatment, WoD20 configured Item bonuses, native damage tags, and form-adjusted Werewolf Attributes/soak remain on existing physical path. No universal Fortitude/Gifts/regeneration auto-resolution. Cross-realm touch and spirit immunities remain GM adjudication.
- **Target health model:** physical `system.health.damage` continues native CombatHelper and existing GM guarded Undo; Spirit `system.advantages.essence.temporary` only when valid and nonnegative, with GM-only Apply/Undo and post-apply value check; protect `permanent`/`max`. Wraith/Corpus and missing Essence/other health models → **manual only**; no invented wounds or document writes. A pre-0.3.0 flagged card lacking the Essence model cannot apply directly to a Spirit.
- Preserve full player Attack → Defender defense → Attack Damage → Defender Soak → optional GM Apply/Undo; no user macro/hotbar changes, system modifications, Paradox writes, or double dice rolls. The independent native weapon launcher v0.2.6 stays in place.
- No automatic Actor/Scene/Item/Journal/User data migrations. New spirit Essence updates occur **only** after explicit GM Apply. Rollback requires matching world snapshot for health/Essence changes made during play; reverting code alone cannot undo those.

**Tests designed:** automated smoke and mock harness `tests/test-splat-combat.cjs` (Spirit→Mage, Mage→Spirit, Essence apply/undo conflict, missing Essence, unsupported Wraith Corpus, vampires/firearms, Werewolf active-form totals and nonspirit Creature). Existing suite also checks native WoD20 rolls, no duplicate attack launcher, Grapple/HUD and permissions. **Not yet live verified:** GM/player with current Foundry v14 and exact WoD20 install, Spirit↔physical, W20 behavior, supernatural powers, two-client timing, immunity/realm. First live test: back up world, attack a Mage with a Spirit (check Willpower attack, Rage damage), then attack Spirit with Mage (Willpower soak, post-soak Essence GM Apply/Undo). Confirm no physical wound update on Spirit and check missing Essence stays manual. One test world; no live deployment performed here.

**Release artifact:** `stl-combat-workflow-v0.3.0.zip` through existing CI workflow; require checked commit/tag, manifest URL, ZIP contents, license and real GitHub release before marking Published. Full public ZIP excludes internal handoff/test files per standard 104. **Rollback source:** validated GitHub v0.2.6 release; backup existing module and world separately before replacement. **Adjacent docs:** private W17/17 handoff and project 103 readiness row after live confirmation; no Player Magick (05), Dice (08), legacy Paradox (09), sheet buttons (16) source edits or contract changes. Update shared 100-series only when a real cross-module interface changes.


### v0.3.0 publish verification (2026-11-14)

- **Published and verified GitHub release:** [v0.3.0](https://github.com/rebsiot/combat-workflow/releases/tag/v0.3.0), source tag commit `2625a97ae15d0e612560904d1933a951701f5171`; published ZIP `stl-combat-workflow-v0.3.0.zip` (39,342 bytes) at `https://github.com/rebsiot/combat-workflow/releases/download/v0.3.0/stl-combat-workflow-v0.3.0.zip`.
- **Verified manifest:** module ID `stl-combat-workflow`, display title **WoD20 Combat Workflow**, version `0.3.0`, exact v0.3.0 download URL. Package checks: ZIP test succeeded, module.json and both script/style entrypoints present; private handoff, tests and workflow config absent from installable package. LICENSE remains included.
- **Automated/mock-tested:** GitHub Actions run [43639521756](https://github.com/rebsiot/combat-workflow/actions/runs/43639521756) completed **success**; all original regressions plus new Spirit vs Mage, Mage vs Spirit, Essence apply/undo and invalid-legacy-card checks passed.
- **Confirmed live:** **NOT YET RUN** for v0.3.0; no claim of installed update or two-client Foundry verification. User must test a real Spirit and a physical Actor, native ChatMessage, GM Apply/Undo, missing Essence and W20/M20 damage-type choice in a backed-up world. Previous historical basic combat tests do not validate new code.
- **Rollback:** GitHub [v0.2.6](https://github.com/rebsiot/combat-workflow/releases/tag/v0.2.6), plus separately retained world backup to restore Spirit Essence or wound edits; code rollback does not undo play-time changes.
- **Next synchronization:** proposed W17 private handoff and 103 readiness after live test. No implemented modifications in independent Player Magick, Dice Improvements, Paradox, Sheet Buttons or native WoD20 system.
