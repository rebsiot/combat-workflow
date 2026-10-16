# STL Combat Workflow v0.1.6

**Owner:** St. Louis v2 conversation `16.1 - Combat Macro`.
**Status:** Personal-use field testing; the user has verified the basic attack/defend/damage/soak flow in Foundry v14. New v0.1.6 UI and zero-damage behavior are automated/mock-tested only.
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

### Workflow card position and animation timing (v0.1.3)

The combat card is always the **last/newest** chat message after its current roll. A stage transition creates the new card and deletes only the prior Combat Workflow *card*, not any WoD20 dice/chat roll. Previous workflow stages therefore do not form a growing stack of button cards. **Old chat messages created in v0.1.2 are not migrated or rearranged.** They may be finished or left as-is; new transitions use the new behavior.

The module observes WoD20's native chat-roll creation and, where Dice So Nice is enabled and its `waitFor3DAnimationByMessageID` API is available, waits for that exact roll's 3D animation to finish before presenting the next stage. Other players' animation timing may differ from the roller's. A 2.5-second native-message detection limit and a 30-second animation timeout keep unexpected API failures from indefinitely freezing combat; in that exceptional case the card may still advance before the visual effect. This does not introduce any custom dice resolution.


## Installation

**Foundry install manifest:** `https://raw.githubusercontent.com/rebsiot/combat-workflow/main/module.json`

**Download ZIP:** https://github.com/rebsiot/combat-workflow/releases/download/v0.1.6/stl-combat-workflow-v0.1.6.zip

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

## Combat chat action contrast

As of v0.1.2, the Dodge / Block / Parry / No Defense chat buttons and later Damage, Soak and GM actions use module-scoped high-contrast text and backgrounds. Hover and keyboard focus are visibly outlined. This is strictly a UI styling fix, not an authorization or defense-rule change. If the chat card is already displayed after updating, reload the browser to apply the new stylesheet.

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

To roll back v0.1.6 to v0.1.5, disable the module, stop Foundry, restore your backed-up `stl-combat-workflow` folder (or the archived v0.1.5 ZIP), restart, and re-enable. You can also disable Combat Workflow without altering the independent Dodge module. Disabling the module does **not** undo game-play health changes already applied to Actors. Undo a specific action from its Chat card while safe, repair the affected Actor manually, or restore a consistent world snapshot if necessary. Native WoD20 dice rolls remain in the world; new v0.1.3+ combat transitions intentionally remove *only* the previous workflow card as described above. Existing v0.1.2 chat cards are not proactively deleted or migrated.

## Test summary

- v0.1.3: PASS under Node mocks for native roll-message matching and waiting, Dice So Nice completion, single newest workflow card, normal attack/damage/soak resolution and guarded health Apply/Undo. `node --check` and manifest JSON validation passed. **Live Dice So Nice/Foundry v14 timing and multiplayer verification not yet run.** User supplied a live v0.1.2 screenshot confirming the prior basic flow and health Undo works.

- v0.1.2: CSS contrast checks PASS (default 10.68:1; hover/focus 7.63:1; disabled 6.72:1), all styles scoped to module chat card. User screenshot confirmed v0.1.1 card rendered in Foundry, but v0.1.2 contrast is not yet tested live.

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

### Combat result banner and sheet icon (v0.1.4)

Once a result is known, a high-contrast colored status banner shows **MISSED!** (or **DODGED!**, **BLOCKED!**, **PARRIED!** when a defense cancels the attack), **NO DAMAGE** if no health levels remain after soak, or **N LETHAL/BASHING/AGGRAVATED DAMAGE**. Finalized outcomes distinguish applied, unapplied and undone damage in their subtitle; the underlying roll totals are unchanged. The card remains newest in chat as in v0.1.3.

The character-sheet Combat shortcut now displays the crossed-swords silhouette from WoD20's native `assets/img/items/meleeweapons.svg` (white glyph only), retaining the original 30px button, splat color and position immediately below Dodge. No other button module or game system files are changed.

Roll back to v0.1.3 by restoring its archived module directory after backing up the current module; any health changes from combat must be reviewed separately. Existing chat cards retain their historical content; new outcome banners appear on cards created or advanced by v0.1.4.

### Health label and Undo consistency (v0.1.4)

WoD20 persists the health condition (`system.health.damage.woundlevel`), the roll penalty (`system.health.damage.woundpenalty`), and the remaining health (`system.traits.health.totalhealthlevels`) separately from bashing/lethal/aggravated counts. v0.1.4 calculates these using the native ordered wound-level track and writes them in the **same Actor update** as the damage change. This affects both GM **Apply to Health** and **Undo Damage**. Undoing a strike that took a character from Wounded to Incapacitated should restore Wounded, including the corresponding wound penalty and remaining health. If the Actor has configured chimerical wounds, their separate track is preserved and the more severe state continues to display. Missing/invalid WoD20 health track blocks the change rather than guessing a condition.

The GM Undo guard against intervening damage remains intact, and this patch does not retroactively repair stale health states from earlier module versions. Review any affected Actor manually. The **DAMAGE UNDONE** banner describes reversal of this workflow's damage, not healing from other sources.

### Turn ownership and zero-damage auto-resolution (v0.1.6)

Every actionable workflow card now opens with a large, high-contrast role banner:

- **DEFENDER'S TURN — [target name]** for Dodge/Block/Parry/No Defense and Soak.
- **ATTACKER'S TURN — [attacker name]** for Roll Damage.
- **GM'S TURN — Storyteller** only when at least one health level remains to be applied.

The Foundry chat message speaker also matches the actor expected to act on defense, damage or soak (rather than always displaying the attacker). GM and completed-result cards use the Combat Workflow speaker. These labels identify the acting **Actor** rather than guessing which human is seated at a computer; permissions continue to be enforced by the existing owner-or-GM validation. All buttons retain their original actions and permissions.

If the damage roll produces zero successes, or soak reduces the final damage to zero, the workflow immediately shows **NO DAMAGE** and finishes. No Apply to Health or Leave Unapplied buttons are generated and the native Actor health remains untouched. Historic chat cards already saved under v0.1.5 are not rewritten; the zero-damage Apply path is nevertheless guarded when handled by v0.1.6. Missed attacks are unchanged.

**First live test:** Attack a defender for one damage success and roll two soak successes. Confirm the latest card shows NO DAMAGE / DONE with no GM buttons. Then launch another attack and confirm the first action card's speaker and highlighted role identify the **defender**, the damage card identifies the **attacker**, and a positive-damage result identifies the **GM**. Check both GM and player client displays.

**Upgrade:** Back up the existing module folder (and ideally the test world), install v0.1.6 using Foundry's module update or its release ZIP, restart Foundry and hard-refresh the browser. **Rollback:** disable the module, stop Foundry and restore the v0.1.5 module folder/ZIP; combat actions that already modified health are not undone by rollback. The v0.1.6 release does not migrate Actors, existing chat messages or item records.