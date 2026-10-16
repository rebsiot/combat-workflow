# Changelog

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
