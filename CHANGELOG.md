# Changelog

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