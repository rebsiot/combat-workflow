# STL Combat Workflow v0.1.1

**Owner:** St. Louis v2 conversation `16.1 - Combat Macro`.
**Status:** Published for personal-use field testing. Automated/mock-tested only; NOT yet verified in live Foundry.
**System target:** Foundry VTT 14 + `worldofdarkness` / WoD20 7.3.1.
**Independent module ID:** `stl-combat-workflow`.
**Optional UI companion:** `wod20-dodge-button` 0.1.0+ (`rebsiot/M20-sheet-buttons`). No changes to or strict dependency on that module.

## Personal-use disclaimer

**Unofficial and provided as-is.** This is a personal St. Louis v2 campaign utility, not an official World of Darkness, Onyx Path, Paradox Interactive or Foundry VTT product. It is not supported by those organizations. No warranty, guaranteed compatibility, or technical support is offered. It can miscalculate combat or modify Actor health data; make backups and verify results against your game's rules. Publishing this repository does not mean the module passed live integration testing. User feedback and fixes are welcome, but this is not a managed public product.

## Purpose

A guided **single-target, single-attack** M20/V20 combat flow using the WoD20 system's native dice rolls and native health track:

1. Attacker opens the workflow from their PC sheet (or controls one attacking token using Token Controls), targets one enemy token, and selects an owned Melee/Ranged Weapon or Unarmed Strike.
2. Attacker rolls native attack with weapon stats, difficulty and bonus dice; native system rules handle tens, ones, specialty settings and wound penalties.
3. The Workflow card in chat asks defender to Dodge, Block, Parry or take the hit. It subtracts defensive successes from attack successes.
4. If the attack hits, attacker rolls damage using the weapon's damage attribute/bonus and extra **net** attack successes beyond the first. A rules setting may turn off success-to-damage bonus.
5. The defender chooses native soak or skips soak; default dice pool comes from the Actor's precomputed soak for the damage type plus soak setting bonus.
6. The Workflow card shows final health levels; GM can Apply to Health, Leave Unapplied, or (after applying) Undo Damage if nobody altered those same wound counts later.

Every roll is made using WoD20's own `DiceRollContainer` and `DiceRoller`, producing native chat rolls and Dice So Nice integration if installed. This module does not implement an alternative d10 algorithm or modify Paradox.

## Installation

**Foundry install manifest:** `https://raw.githubusercontent.com/rebsiot/combat-workflow/main/module.json`

**Download ZIP:** [https://github.com/rebsiot/combat-workflow/raw/refs/heads/main/releases/stl-combat-workflow-v0.1.1.zip](https://raw.githubusercontent.com/rebsiot/combat-workflow/main/releases/stl-combat-workflow-v0.1.1.zip)

To install through Foundry Setup, use **Install Module → Manifest URL** and paste the manifest URL above. Otherwise follow the manual instructions below.

1. **Back up the world** and any existing `Z:\Data\modules\stl-combat-workflow` directory.
2. Verify that the installed WoD20 system is **7.3.1**. This preview was developed against that public source version; an installed 7.3.0 version is **not** verified.
3. Stop the Foundry server process before replacing module files.
4. Extract this ZIP into `Z:\Data\modules\` so the manifest is directly at `Z:\Data\modules\stl-combat-workflow\module.json`.
5. Restart Foundry, enter the intended world and enable **STL Combat Workflow** in Manage Modules.
6. Reload all GM and player browser clients.

## How to launch

- **On a PC sheet:** find the vertical native Roll/Dodge button column. A new **Combat Workflow** shield-and-sword icon appears **directly below Dodge**. The sheet's Actor is the attacker; you do **not** need to select its token on the canvas. If the separate `wod20-dodge-button` module is disabled or not installed, Combat appears directly below the native Roll icon instead.
- **Target exactly one defender token** using Foundry's normal targeting control; an online GM is required. Clicking Combat opens the weapon/attack dialog and then the sequential Chat workflow.
- The Dodge button itself remains the independent Dodge module's native single-defense roll; Combat does not replace it.

- On the canvas, activate **Token** scene controls. The new **Combat Workflow** shield tool is added to that toolbar.
- If the tool is not visible in your Foundry theme, create a personal *Script Macro* with:

```js
await game.modules.get("stl-combat-workflow").api.open();
```

- When launching from **Token Controls**, select **exactly one** attacking token you own/control and target exactly one defending token. When launching from the **sheet button**, that sheet Actor is the attacker and token selection is unnecessary.
- An **online GM is required** to coordinate turns and perform health updates. One active GM serves as workflow authority; players still roll their own Actor dice by clicking the current Chat card button.
- The correct Actor owner (or GM) clicks each step. Stage changes persist in the ChatMessage flags and can survive clients being reloaded.

## Weapon and rules integration

- Weapon Item types are the **native WoD20 `Melee Weapon` and `Ranged Weapon`** Items already present on Actors. A Combat Library Item works after dragging a **copy** onto the Actor. No new compendium or duplicate weapon schema is created.
- Single-shot ranged attacks consume one clip round **only when the WoD20 system setting `defaultAutoAmmo` is enabled**, matching the native configuration. Insufficient ammunition cancels the attack.
- All dice use the WoD20 API from `systems/worldofdarkness/module/scripts/roll-dice.js`. Damage overflow uses its existing `CombatHelper.ApplyDamageWithOverflow`.
- The module uses native Actor `system.soak.bashing/lethal/aggravated`, not a hardcoded rule that mortals can soak everything. Soak dialog permits an override where an unusual ability, armor or Storyteller ruling changes the pool.
- For V20 Vampire defenders, **remaining bashing damage is halved after soak, rounded down**. Ordinary firearm attacks using the `firearms` attack Ability default to bashing against Vampires; damage type can be overridden for headshots, ammunition or special cases.
- Difficulty, damage dice and soak dice can be changed by the rolling player. This is a trusted-table tool, not a GM approval gate.

## Known limitations and decisions pending a real test

- **Single target, single attack only.** Burst/full-auto, spray/multiple targets, split actions, rate of fire, reloading beyond single shots and ammo special cases are not implemented. The normal WoD20 sheet remains available for those cases.
- Initiative is left to the existing Foundry combat tracker and native WoD20 initiative control.
- Combat magic, counters, Powers/Disciplines and Paradox remain owned by their existing modules; the current release covers mundane weapon/unarmed attacks only.
- Dodge, Block and Parry are always offered; the Storyteller must decide if Block/Parry is legal against a ranged attack or whether a defense has already used the defender's action. The defaults can be overridden in the roll dialog.
- Specialty selection / Willpower spend, hit locations, cover, special damage conversions, soak-exception effects and additional defenses are not automated. Roll dialogs expose numeric overrides, but **the module will not adjudicate advanced rules for the GM**.
- The PC sheet Combat shortcut uses the same 30×30 `macroBtn` style as the independent `wod20-dodge-button` module. It does not alter that module.
- The native WoD20 system source was inspected at public version 7.3.1. Local exact installed system files, Player Actions, Dice Improvements, the Magick macro UI, Paradox and real Combat Library Items were **not provided**. A schema/API regression test using actual files is still required.
- This release uses Foundry v14's `DialogV2.input`, `renderActorSheetV2`, and `getSceneControlButtons`, with native WoD20 7.3.1 roll and CombatHelper imports. The exposed APIs may change in newer system versions.

## First live smoke test (do this in a copy/test world)

1. Log in as GM and as a player in separate browser clients; confirm WoD20 version and enabled module.
2. Place one Mage Actor and one target token, then give the Mage a native Melee Weapon Item.
3. Target the defender, then click **Combat directly below Dodge** on the PC sheet, without selecting an attacker token. Repeat using the Token Controls shortcut with one attacker token selected.
4. Roll an attack and verify **both** a native dice ChatMessage and an interactive Workflow ChatMessage appear.
5. On defender client choose Dodge and roll; check net successes, then attacker damage, then defender soak.
6. As GM verify the final health preview, Apply, and Undo; confirm only the selected target Actor's wound counts changed.
7. Repeat with V20 Vampire being hit by a firearm; check firearm damage type and bashing-after-soak halving.
8. Reload the browser midway through a workflow and try its next action. Check console for errors.
9. Test another attack after a defender gains new wounds and verify that Undo refuses to erase intervening damage.

Do **not** declare live compatibility until these pass. Keep the matching world backup.

## Upgrade and rollback

To roll back v0.1.1 to v0.1.0, disable the module, stop Foundry, restore your backed-up `stl-combat-workflow` folder (or the archived v0.1.0 ZIP), restart, and re-enable. You can also disable Combat Workflow without altering the independent Dodge module. Disabling the module does **not** undo game-play health changes already applied to Actors. Undo a specific action from its Chat card while safe, repair the affected Actor manually, or restore a consistent world snapshot if necessary. Native WoD20 rolls and ChatMessages remain in the world; flags are not automatically migrated or deleted.

## Test summary

- v0.1.1 sheet shortcut insertion, Dodge-order fallback, deduplication, accessible controls, and Actor-context/no-token launch: PASS under Node mock; live sheet verification pending.
- JavaScript parse check (`node --check`): PASS.
- Manifest JSON validation: PASS.
- Scripted mock: PASS for attack/damage pool math, defense subtraction, damage/soak stage transitions, V20 firearm override, V20 bashing halving, once-only health application, and Undo.
- Live Foundry v14 / WoD20 7.3.1: **NOT RUN**.
- Two-player socket collaboration and real Combat Library Items: **NOT RUN**.

## Upstream references (integration only; not redistributed)

- WoD20 system: https://github.com/JohanFalt/Foundry_WoD20
- Foundry v14 scene controls: https://foundryvtt.com/api/functions/hookEvents.getSceneControlButtons.html
- Foundry v14 dialogs: https://foundryvtt.com/api/classes/foundry.applications.api.DialogV2.html
