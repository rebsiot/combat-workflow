# Changelog

## v0.2.4 — 2026-10-16 — Compact grapple buttons

- Shortened Grapple/Hold response buttons to **Resist / No Resist**, **Escape / Release Hold**, and **Resist Escape**, keeping native Strength + Brawl meanings in tooltips. No action IDs, chat flags, rolls or grapple rules changed.
- Added a narrowly scoped equal-width two-column layout for the paired grapple choices, with reduced horizontal padding and single-line labels; prevents cramped/wrapped choices in Foundry's chat sidebar.
- Standard weapon attacks, Dodge/Block/Parry, Soak, GM Apply/Undo, Token HUD, Magick, and per-user first-login tutorial remain unchanged.
- Updated static/mock regression coverage. Live Foundry v14 chat layout verification still required.


## v0.2.3 — 2026-10-16 — Remove duplicate Grapple entry in Attack weapon list

- WoD20 supplies Grapple as an owned Melee Weapon Item, which kept appearing in **Attack → Weapon** even after v0.2.1 introduced the separate Grapple launcher. The Attack dropdown now excludes exactly that native item by trimmed case-insensitive name and type; the Item remains in the Actor's Items and native WoD20 sheet.
- Preserve Bite, Disarm, Kick, Punch, Sweep, other equipment, firing modes, and the native Unarmed Strike option. Reject forged/stale Grapple Item picks in Attack; direct users to **Actions → Grapple**.
- No change to the dedicated Grapple workflow, combat mechanics, health, flags, User tutorial state or other modules. Added a dropdown and item-preservation regression mock; live Foundry UI check pending.


## v0.2.2 — 2026-10-16 — First-login quick tutorial

- Added a concise four-screen Combat Workflow orientation for each player or GM on first login after enabling the module, following the native Foundry `ready` hook.
- Includes lightning-bolt Token Actions, normal weapon attacks, separate grappling, chat turns/soak and GM health resolution; no dice or Actor changes from viewing the tutorial.
- Final **Don't show again** saves `flags.stl-combat-workflow.tutorialDismissed` on the **current User**, not globally. Closing without dismissal does not set the flag.
- A small `? Quick tutorial` footer inside the existing expanded Actions menu allows reopening the guide, even after it has been dismissed. No extra permanent icon or column.
- Introduced `scripts/tutorial.js` and `styles/tutorial.css` as independent resources. No edits to the combat engine, Player Actions/Magick, DiceRoller or health mechanics.
- Added Node mock coverage; live Foundry v14 user-flag saving and two-client rendering are still pending.


## v0.2.1 — 2026-10-16 — Separate Grapple UI and compact soak choice

- Separated **Grapple** from the main Attack dialog. Grapple has its own HUD Actions flyout item and a minimal Strength + Brawl / Difficulty dialog; weapon/ammo/damage/split options remain exclusively in **Attack**.
- Kept the existing Hold/Resist/Escape/Release state machine and normal attack combat sequence unchanged. Character-sheet Combat launcher continues to open Attack; published an additive `api.openGrapple()` entry point.
- Renamed the defender's chat action button **Cannot / Won't Soak** to **No Soak** while preserving its `no-soak` action and adding an explanatory tooltip.
- Added/updated Node mock tests. No Actor or Scene migrations; no Player Actions or WoD20 system changes. Live Foundry browser testing pending.


## v0.2.0 — 2026-10-16 — HUD positioning and extended combat maneuvers

- Changed Token HUD grid icon to a lightning bolt; anchored compact Combat/Magick flyout to its button and constrained it to the visible viewport.
- Added native ranged three-round burst (+3 dice/+1 difficulty/3 rounds) and full-auto (+10 dice/+2 difficulty/remaining magazine) for Item modes supported by WoD20 `dialog-weaponv2`. Supports single target; spray remains a native weapon action.
- Added 2–4 sequential same-weapon attacks using an evenly divided original attack pool. Each has independent defense/damage/soak/health resolution and its own final chat card; guarded next-step and optional retargeting.
- Added opposed **Grapple / Hold** maneuver and persistent chat-only Held → Escape/Contest → Released workflow with native Strength + Brawl rolls, no automatic grapple status or damage.
- Preserved ordinary single-attack UX, GM health Apply/Undo and use of existing WoD20 dice; did not modify adjacent Player Actions or Magick modules.
- New Node mocks for maneuvers, ammo, split actions, old stage behavior and HUD anchoring. **Live Foundry testing pending; this is an experimental personal-use release.**


## v0.1.10 — 2026-10-16 — One HUD Actions flyout (Combat and Magick)

- Replaced the v0.1.9 single-purpose Token HUD attack icon with a distinctive small grid-style **Actions** menu button. The flyout displays two labeled entries, Combat and Magick, beside the native HUD rather than adding a tall column.
- Combat invokes the existing `open({attackerToken:tokenDoc})` workflow. Magick invokes the active independent Player Actions `openPanel(tokenDoc.actor)` API; no duplicate casting or dice engine.
- Hide Magick when Player Actions is disabled/missing; check Actor ownership, avoid duplicate HUD controls, keep Escape/focus support and native character-sheet Combat button.
- No changes to combat rules, stage messages, resource/health writes, Actor/Token data, Player Actions module source, or Paradox integrations.
- Node mock regression for HUD menu, per-token binding, Magick enabled/disabled, GM/non-owner permissions. Live Foundry v14 HUD/multiplayer validation pending.


## v0.1.9 — 2026-10-16 — Right-click Token HUD attack shortcut

- Removed the dedicated left Token Controls shield tool, decluttering the permanent scene toolbar.
- Added a small crossed-swords Attack icon to the native Foundry v14 Token HUD displayed by right-clicking an owned token; GM can use it on NPCs too.
- The HUD launcher uses the exact TokenDocument being right-clicked, not the selected token; the sheet launcher remains directly below Dodge and optional script macro remains available.
- Native button sizing/placement, permissions and deduplication; no separate HUD class, combat mechanic or Actor/Scene migration.
- Added Node mock coverage for HUD injection, deduplication, permissions and token-specific launch; live Foundry HUD verification pending.


## v0.1.8 — 2026-10-16 — Explicit Roll in combatant name box

- Display `<Actor name> Roll` (e.g. `ThugMelee (1) Roll`) during defender choice/soak and attacker damage stages, keeping the player-colored box from v0.1.7.
- Keep `Storyteller` for final GM health application; that step is not a dice roll.
- No changes to stage sequence, native dice, chat speaker, damage/soak, health or other modules.
- Update mock tests for the concise label wording; live Foundry UI verification pending.


## v0.1.7 — 2026-10-16 — Compact player-color turn indicator

- Simplified the active combat turn banner to show only the acting Actor name; removed extra "ATTACKER'S TURN"/"DEFENDER'S TURN"/"GM'S TURN" and instruction lines.
- Use the controlling player's assigned Foundry user color for the background, choosing appropriate contrasting text. Unassigned NPCs and Storyteller actions use active GM color; neutral fallback if unavailable.
- Preserve the speaker changes introduced in v0.1.6, defense/damage/soak controls, zero-damage automatic completion, and complete combat mechanics.
- Added Node mock regression coverage for assigned player colors, fallback, text contrast and name-only banner; Foundry multi-client visual verification remains pending.


## v0.1.6 — 2026-10-16 — Clear combat turn ownership and zero-damage finalization

- Added prominent, accessible color-coded turn banners identifying the Actor who must respond: Defender, Attacker, or GM.
- Changed new workflow chat card speaker to the current defender/attacker, or a neutral Combat Workflow alias for GM/finished states, instead of retaining the original attacker name throughout.
- Damage-roll failure, successful soak and Vampire bashing reduction that leave zero final damage now complete immediately with NO DAMAGE; no needless GM Apply/Leave choices or Actor health updates.
- Historical zero-damage cards in resolved state now render without Apply/Leave buttons, and their prior Apply action can only finalize without mutating health. No bulk chat migration.
- Preserved original WoD20 roll/chat history, Dice So Nice pacing, single active card, weapons, permissions, health Apply/Undo safety, sheet icon and module ID.
- Added Node mock/regression coverage for actor names, stage-specific speakers, zero-damage transitions and guarding historical zero-damage Apply. Live two-client verification still pending.

## v0.1.5 — 2026-10-16 — Foundry compatibility metadata

- Set `compatibility.verified` to `14`, preserving minimum core version `14`; no runtime changes.


## v0.1.4 — 2026-10-15 — Combat result banners, native swords and health Undo correction

- Added clearly colored end-state banners: MISS, DODGED/BLOCKED/PARRIED, NO DAMAGE or final damage amount and type.
- Outcome subtitle distinguishes damage application, GM skip and GM Undo; Undo shows a clear DAMAGE UNDONE banner.
- Replaced the sheet Combat shortcut shield art with the crossed-swords silhouette from the native `meleeweapons.svg` while keeping the 30px button and color.
- Fixed Apply/Undo to update WoD20 native woundlevel, woundpenalty and total health fields atomically alongside damage counts; previously Undo could leave Incapacitated visible after restoring wounds.
- No changes to damage calculations, sockets, native dice or the separate Dodge module.
- Added banner/SVG and health-state regression tests for restored 0 wounds and Incapacitated back to Wounded, including independent chimerical damage; live Foundry verification remains pending.


## v0.1.3 — 2026-10-15 — Dice animation pacing and current action at bottom

- Wait for WoD20's actual native ChatMessage creation before advancing each roll. The system's `DiceRoller` initiates chat creation without awaiting it.
- When Dice So Nice is active, wait for the associated 3D roll animation to complete before sending the next combat action. The wait is bounded to prevent stalled sessions; if the module/API is missing, the native roll still works.
- Post the next Combat Workflow state as a fresh, bottom-of-chat message **after** the dice result and remove the previous *workflow* card. Native dice-roll chat messages are retained and remain immediately above the current choices.
- Temporary APPLYING health protection and all GM-only Apply/Undo checks remain unchanged. Only the prior workflow chat cards are deleted in the new flow; Actors and item data are not migrated.
- Added Node mock coverage for chronological workflow-card replacement, no duplicate actionable cards, completion of native roll chat creation, and Dice So Nice waiting.
- User screenshot confirmed basic attack/defense/damage/soak and guarded GM Undo on a live Foundry instance in v0.1.2; the v0.1.3 order/timing changes have not been verified live.


## v0.1.2 — 2026-10-15 — Readable combat chat actions

- Fixed nearly-black text on Dodge, Block, Parry, and No Defense buttons in dark Foundry/WoD20 chat themes. The same explicit styles cover Damage, Soak, Apply and Undo actions.
- Scoped high-contrast text, background and border colors to Combat Workflow chat cards only; native system buttons remain untouched.
- Added clear hover/focus styling and distinct readable disabled-state styling. Buttons were not functionally disabled in v0.1.1; this was a contrast defect.
- Kept the combat state machine, actor data, native dice, permissions, and both launcher icons unchanged. No migrations.
- Automated: Node state/sheet mock checks and static contrast regression checks passed (active 10.68:1, focus 7.63:1, disabled 6.72:1). Live contrast verification on the user's Foundry theme is pending.

## v0.1.1 — Character-sheet Combat shortcut

- Added a native-sized **Combat Workflow** icon immediately **below Dodge** in WoD20 PC character sheets. If the separate Dodge module is unavailable, the shortcut appears immediately below the native Roll icon.
- The new sheet shortcut uses the displayed PC as the attacker without requiring that token to be selected; still requires exactly one defending token to be targeted and a GM online.
- Retained the existing Token Controls shortcut and single-attacker-token requirement for that entry point.
- Button uses the existing sheet icon color, tooltip, accessible label, keyboard activation, and duplicate protection on rerenders.
- No change to WoD20 native dice resolution, combat state, Actor data, or the independent Dodge module.
- Automated mock tests only; a live Foundry v14 sheet and two-player workflow test is still outstanding.

# Release notes

## v0.1.0 - 2026-10-15

### Added
- Published source, Foundry manifest URL and installable archive in the GitHub repository.
- New, independent Foundry 14/WoD20 7.3.1 combat workflow module.
- Single-target weapon/unarmed attack -> defender reaction -> damage -> soak -> GM-approved health flow.
- Native WoD20 dice rolls, weapon Item lookups and health overflow helper.
- Persisted ChatMessage workflow stages and player/GM permissions.
- Token-toolbar Combat Workflow action and optional hotbar Script Macro API.
- V20 Vampire bashing-after-soak halving and typical firearm conversion, with damage-type override.
- GM Undo Damage guarded against intervening changes to wound counts.

### Preserved
- Existing Actors, weapons, Combat Library master Items and native WoD20 dice/rules.
- Existing Magick, Paradox, Player Actions and Dice Improvements modules are not changed.

### Limitations
- Only one mundane attack and one target per workflow; complex firearms/multi-actions/magick not automated.
- Requires an online GM for cross-client stage coordination.
- No live Foundry/browser integration test performed.

### Tests
- JavaScript syntax, module manifest JSON and mock end-to-end resolution: passed.
- Live Foundry and two-client roll/chat/socket test: not run.