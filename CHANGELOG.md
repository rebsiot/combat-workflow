# Changelog

## v0.1.3 — 2026-10-15 — Combat pacing and newest active chat card

- Fixed workflow advancing before native roll chat creation or the matching Dice So Nice animation completes.
- Each completed stage creates its next workflow message at the bottom of the chat, below the native dice result, and removes only the previous workflow card.
- Native WoD20 dice/chat cards remain untouched. Existing old workflow cards are not mass-migrated.
- Preserved schema 1, Actor health, GM Apply/Undo safety checks, token/sheet launchers and native dice.
- Automated mock tests and module syntax checks; new pacing/order awaits live Foundry verification.


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
