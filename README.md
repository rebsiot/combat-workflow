# STL Combat Workflow v0.2.2

**Owner:** St. Louis v2 conversation `16.1 - Combat Macro`.
**Status:** Personal-use field testing; the user has verified the basic attack/defend/damage/soak flow in Foundry v14. v0.2.2 adds an optional, per-player first-login quick tutorial. The new tutorial is mock-tested; live Foundry verification remains pending.
**System target:** Foundry VTT 14 + `worldofdarkness` / WoD20 7.3.1.
**Independent module ID:** `stl-combat-workflow`.
**Optional UI companion:** `wod20-dodge-button` 0.1.0+ (`rebsiot/M20-sheet-buttons`). No changes to or strict dependency on that module.

## Personal-use disclaimer

**Unofficial and provided as-is.** This is a personal St. Louis v2 campaign utility, not an official World of Darkness, Onyx Path, Paradox Interactive or Foundry VTT product. It is not supported by those organizations. No warranty, guaranteed compatibility, or technical support is offered. It can miscalculate combat or modify Actor health data; make backups and verify results against your game's rules. Publishing this repository does not mean the module passed live integration testing. User feedback and fixes are welcome, but this is not a managed public product.

## Purpose

A guided **single-target attack workflow**, with optional sequential attacks and a separate Grapple/Hold action using the WoD20 system's native dice rolls and native health track:

1. Attacker opens the workflow from their PC sheet or the right-click Token HUD, targets one enemy token, and selects an owned Melee/Ranged Weapon or Unarmed Strike.
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

**Download ZIP:** https://github.com/rebsiot/combat-workflow/releases/download/v0.2.2/stl-combat-workflow-v0.2.2.zip

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

- **On the canvas:** Right-click an owned token to open Foundry's native **Token HUD**. Click the lightning-bolt **Actions** icon, then choose **Attack**, **Grapple**, or **Magick** from the compact flyout. Attack and Grapple require one defender already targeted; Magick opens the existing Player Actions *Use Magick* panel for that same token's Actor. The HUD token is used independently of the current selected token.
- **Removed:** The old shield icon is no longer inserted in the left Token Controls toolbar.
- **Optional hotbar macro:** You can still create a Script Macro (requires exactly one selected attacker token) with:

```js
await game.modules.get("stl-combat-workflow").api.open();
```

- The Actions flyout is shown for a token whose Actor you own (or when logged in as GM). It uses the right-clicked TokenDocument, not whichever token is selected. **Magick** appears only when `wod20-player-actions` is enabled and exposes its `openPanel(actor)` API; Combat remains independently available. The sheet button uses its Actor with no token-selection requirement; the optional macro uses a single selected attacking token.
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

- **Single defender at a time.** Up to four sequential split attacks are supported, with each attack individually targeted and resolved. Select a new defender before pressing Next Attack; the same equipped weapon and an even split of the original attack pool are used. More complex mixed actions, Celerity/extra actions, suppression/spray, or independent rate-of-fire adjudication remain native WoD20/GM responsibilities.
- Initiative is left to the existing Foundry combat tracker and native WoD20 initiative control.
- Combat magic, counters, Powers/Disciplines and Paradox remain owned by their existing modules; the current release covers mundane weapon/unarmed attacks only.
- Dodge, Block and Parry are always offered; the Storyteller must decide if Block/Parry is legal against a ranged attack or whether a defense has already used the defender's action. The defaults can be overridden in the roll dialog.
- Specialty selection / Willpower spend, hit locations, cover, special damage conversions, soak-exception effects and additional defenses are not automated. Roll dialogs expose numeric overrides, but **the module will not adjudicate advanced rules for the GM**.
- The PC sheet Combat shortcut uses the same 30×30 `macroBtn` style as the independent `wod20-dodge-button` module. It does not alter that module.
- The native WoD20 system source was inspected at public version 7.3.1. Local exact installed system files, Player Actions, Dice Improvements, the Magick macro UI, Paradox and real Combat Library Items were **not provided**. A schema/API regression test using actual files is still required.
- This release uses Foundry v14's `DialogV2.input`, `renderActorSheetV2`, and `renderTokenHUD`, with native WoD20 7.3.1 roll and CombatHelper imports. The exposed APIs may change in newer system versions.

## First live smoke test (do this in a copy/test world)

1. Log in as GM and as a player in separate browser clients; confirm WoD20 version and enabled module.
2. Place one Mage Actor and one target token, then give the Mage a native Melee Weapon Item.
3. Target the defender, then click **Combat directly below Dodge** on the PC sheet, without selecting an attacker token. Repeat by right-clicking the attacking token and choosing Actions → Combat (no selection required). Also test Actions → Magick with Player Actions enabled.
4. Roll an attack and verify **both** a native dice ChatMessage and an interactive Workflow ChatMessage appear.
5. On defender client choose Dodge and roll; check net successes, then attacker damage, then defender soak.
6. As GM verify the final health preview, Apply, and Undo; confirm only the selected target Actor's wound counts changed.
7. Repeat with V20 Vampire being hit by a firearm; check firearm damage type and bashing-after-soak halving.
8. Reload the browser midway through a workflow and try its next action. Check console for errors.
9. Test another attack after a defender gains new wounds and verify that Undo refuses to erase intervening damage.

Do **not** declare live compatibility until these pass. Keep the matching world backup.

## Upgrade and rollback

To roll back v0.2.2 to v0.2.1, disable the module, stop Foundry, restore your backed-up `stl-combat-workflow` folder (or the archived v0.2.1 ZIP), restart, and re-enable. You can also disable Combat Workflow without altering the independent Dodge module. Disabling the module does **not** undo game-play health changes already applied to Actors. Undo a specific action from its Chat card while safe, repair the affected Actor manually, or restore a consistent world snapshot if necessary. Native WoD20 dice rolls remain in the world; new v0.1.3+ combat transitions intentionally remove *only* the previous workflow card as described above. Existing v0.1.2 chat cards are not proactively deleted or migrated.

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

### Compact player-color turn banner (v0.1.7)

The chat card now displays **only the acting character's name** in a colored box; the redundant "DEFENDER'S TURN", "ATTACKER'S TURN", and helper sentence are removed. The rest of the card and its action buttons remain unchanged.

- Background uses the Foundry **User color** of the player assigned to the Actor. If no assigned character is found, an explicit non-GM Actor owner is used, followed by a permitted non-GM owner.
- For unassigned NPCs and Storyteller-only resolution, the active GM's User color is used. If no valid User color exists, a neutral dark gray is used.
- Text automatically switches to light or dark contrast. The color is sanitized before being written to the chat HTML and will be consistent for all clients viewing that message.
- The Foundry chat speaker still changes to the current actor (or Combat Workflow for completed/GM stages).
- No ownership or permissions changes, no new settings, and no changes to rolls, wounds, stage transitions or Dice So Nice.

**Live verification:** Assign different colors to two player users, have their characters attack and defend, and check that each new chat card shows just the responsible name with the correct color. Verify an unassigned NPC uses the GM fallback.

**Upgrade:** Back up the module folder, install v0.1.7, restart Foundry and hard-refresh. Existing chat cards are historical and are not recolored in bulk. Roll back by restoring v0.1.6; actor data and completed roll history are untouched by this visual update.


### Turn banner wording (v0.1.8)

Active combat choices now display **`<Actor name> Roll`** (for example, **ThugMelee (1) Roll**) inside the player-color name box for defense, damage, and soak stages. The GM resolution box remains **Storyteller**, as health application is not a roll. The preceding v0.1.7 color and speaker behavior remains intact. This is presentation-only: no changes to permissions, dice, damage rules, or health data. Existing historical chat cards are not rewritten. Automated mock tests cover each banner state; live Foundry v14 verification is pending. Rollback release: v0.1.7.


### Right-click Token HUD launcher (v0.1.9)

- The extra shield tool in the left Token Controls palette is removed. Nothing is added to that sidebar.
- Right-click an **owned token** (or any Actor token as GM). Foundry's native Token HUD shows a small crossed-swords button with tooltip **Attack — Combat Workflow**, normally directly after its combat-toggle control.
- Click it after targeting **one defender**. The module passes the specific right-clicked TokenDocument UUID to the existing attacker workflow, independent of controlled-token selection. The normal PC sheet icon below Dodge and the optional no-argument macro remain available.
- This uses Foundry v14 `renderTokenHUD`; it does not replace the TokenHUD class or modify WoD20 templates, other token controls, permissions, combat state, or dice. No Actor/Scene/Token data migrations or writes occur from simply showing the HUD.
- **Live check:** In a test world, right-click a player-owned attacker; verify the small swords icon appears and the sidebar shield is absent. Target a defender while another token is selected, then click swords. Confirm the correct attacking character appears in the attack dialog. Verify a player does not get the button on an unowned token and a GM does.
- **Upgrade:** Back up the module and world, update to v0.1.9, refresh/restart as necessary. **Rollback:** restore the v0.1.8 module ZIP. Existing Actors, items, scenes, tokens, and roll history are not migrated.


### One Token HUD Actions flyout (v0.1.10)

The native right-click Token HUD has **one** added grid/menu-style **Actions** button. It opens a small labeled flyout beside the HUD, rather than growing a column of competing icons. It currently offers only:

- **Combat** — launches the existing independent Combat Workflow using exactly the right-clicked TokenDocument; target one defender first.
- **Magick** — calls `game.modules.get("wod20-player-actions").api.openPanel(tokenDoc.actor)` and opens the existing Player Actions **Use Magick** window with that Actor; if Player Actions is disabled, unavailable or lacks the API, Magick is omitted. No casting code, dice, flags, resources, Paradox or Player Actions module is changed.

The always-visible left sidebar shield remains removed. The PC-sheet Combat icon below Dodge remains. A personal Script Macro can still invoke the no-argument `game.stlCombatWorkflow.open()` with exactly one controlled attacker token. The flyout has explicit accessible labels, Escape-to-close, click-to-toggle, contrast/focus treatment, deduplication on HUD rendering and ownership checks. It is a HUD-only DOM enhancement, not a TokenHUD replacement or Actor/Scene migration.

**Live smoke test:** With Player Actions v0.1.14+ enabled, right-click a player-owned Mage token. Click the grid Actions button and confirm the two-item Combat/Magick flyout appears beside the HUD without extending the icon column. Choose Magick and check the correct Mage appears in the existing Use Magick panel. Repeat Combat with one target and verify the correct token attacks. Disable Player Actions temporarily: Actions should offer only Combat. Check non-owner players do not get the launcher for an unowned token; GM can use it. The new HUD behavior is **mock-tested only**, not yet confirmed live.

**Upgrade:** Back up `Z:\Data\modules\stl-combat-workflow` and test world, install v0.1.10, restart Foundry and hard-refresh all browsers. No data conversion required. **Rollback:** restore v0.1.9 module ZIP; existing workflow health changes and chat history are unaffected by changing the HUD launcher.


## v0.2.1 — Separate Grapple launcher and compact soak button

The **Actions** flyout now has three entries behind the same single lightning-bolt icon: **Attack**, **Grapple**, and **Magick** (Magick only if Player Actions is available). No new permanent Token HUD controls are introduced.

- **Attack** uses the original weapon attack dialog (weapon, difficulty, attack modifier, damage type, count, optional firing mode), **without** a Grapple maneuver selector.
- **Grapple** opens a *separate* minimal initial dialog showing only **Strength + Brawl dice** and **Difficulty** (default 6). It runs the existing v0.2.0 opposed Hold / Resist / Escape / Contest / Release workflow, not weapon selection, ammunition, split attacks or damage.
- The PC-sheet Combat button still opens Attack; the existing macro API `game.stlCombatWorkflow.open()` is unchanged. Integrations can call `game.stlCombatWorkflow.openGrapple()` with one selected token, or `api.openGrapple({attackerActor})` / `api.openGrapple({attackerToken})` with context supplied.
- The defender's wide **Cannot / Won't Soak** chat button is renamed **No Soak** so it fits on one line. A tooltip retains the full meaning, *Cannot or choose not to soak*. The underlying `no-soak` action is identical.
- No Actor/Item, weapon, combat dice, health, permission, Paradox or magick logic changes. Existing in-progress grapple chat cards remain supported and need no migration. Historical chat messages are not rewritten.

**Live smoke test:** In a backed-up test world, right-click an owned token with one defender targeted. Actions → Attack should show weapon fields but **not Grapple**. Actions → Grapple should show only Strength + Brawl and Difficulty, then produce the existing opposed grapple card. Separately take a normal hit to the soak step: **Roll Soak** and **No Soak** should fit in their buttons and behave exactly as before. Test as a second player and GM. Rollback to v0.2.0 if necessary.

**Tests:** Node mock checks for independent dialogs, HUD action routing, soak button labeling, native firing modes, split attacks and grapple-state transitions; live Foundry v14 has not yet been tested.

## v0.2.0 — Extended maneuvers (historical v0.2.0 behavior; v0.2.1 separates Grapple)

The standard Attack → Defense → Damage → Soak → optional GM health application remains the default and is unchanged. The attack dialog now has **Maneuver** (Standard / Grapple-Hold), **Number of attacks** (1–4) and, only when an Actor owns a ranged weapon supporting it, a **Firing mode** selector. Special modes have no extra setup dialogs in routine single attacks.

### Burst and full-auto

- Reads native WoD20 Ranged Weapon `system.mode.hasburst` and `hasfullauto` flags. Does not infer automatic capability from weapon names.
- Three-round burst: +3 attack dice and +1 difficulty; spends 3 rounds when `CONFIG.worldofdarkness.defaultAutoAmmo` is enabled.
- Full-auto: +10 attack dice and +2 difficulty; uses the native dialog's minimum of at least half a configured magazine and expends the remaining loaded magazine when auto-ammo is enabled. Full-auto is **against a single target** here; spreading fire / spray across targets remains with native WoD20.
- If a chosen weapon does not support a selected mode, or lacks required ammunition, the attack is canceled before rolling. Each completed roll consumes ammo only once; when native auto-ammo is disabled, the module does not alter clip counts.
- Do not combine burst/full-auto with split-action attacks through this interface. For unusual suppressive fire or special ammunition, use the native weapon dialog and GM adjudication.

### Sequential split attacks

- Choose 2–4 attacks in the initial dialog. The module divides the **same weapon attack pool** evenly into positive integer pools, with any remainder allocated to earlier attacks (e.g., 8 dice over 3 attacks → 3/3/2). If there are fewer dice than attacks, it refuses to begin.
- Each attack runs its own defense, damage, soak and health resolution. When an attack is complete or misses, the attacker receives a **Next Attack** button, with a counter. Attacker can target one other defender before clicking it, or leave the current target selected.
- Previous completed attack cards and native WoD20 roll chat remain; prior Next Attack button is disabled after continuation, preventing an accidental duplicate sequence. Guarded Undo on a prior damage card remains available until later health edits make it unsafe.
- This implements the M20/V20 common divided-pool approach **for repeated same-weapon attacks only**. It does not attempt different-ability multi-actions, supernatural extra actions, dual-wielding, rate-of-fire exceptions, or a GM-side initiative economy. GM retains authority over legal declarations.

### Grapple / Hold

- Choose **Grapple / Hold** (one action), which uses native Strength + Brawl at difficulty 6 (overridable at roll). The defender chooses **Resist (Strength + Brawl)** or **Do Not Resist**. Net attacker successes establish a persistent Hold card rather than ordinary damage.
- On a later permitted action the defender chooses **Attempt Escape** (Strength + Brawl), after which the holder uses **Contest Escape** (Strength + Brawl). The defender must exceed holder successes to escape; otherwise the Hold card remains active. The holder may voluntarily **Release Hold** without rolling.
- The hold persists only as a module ChatMessage flag, not as a condition or status imposed on tokens; it creates no Item, Active Effect, permission change or combat tracker action. GM decides when actions can occur and whether holds affect movement/other action options. **Clinch damage, throws, grappling magick and form-dependent exceptions are not automated** in this version; native system rolls and manual rulings remain available.

### Token HUD improvement

- The single **Actions** icon is now a lightning bolt. The Combat/Magick flyout is anchored to that icon rather than to the top of the whole Token HUD column, vertically clamped within the visible browser viewport, and flipped horizontally when necessary.
- The flyout remains two items tall and does not expand the native HUD icon column. Player Actions `openPanel(actor)` is still used only when the companion module is enabled.

### First new live tests

1. With a backed-up test world, right-click an owned token near the bottom and near the left edge of the viewport. Confirm the lightning bolt and flyout position beside it, not above the HUD.
2. Equip a Ranged Weapon with native burst/full-auto flags and clip. Fire a burst, check +3 dice/+1 difficulty/three rounds, then full-auto and check +10 dice/+2 difficulty/ammunition. Test insufficient ammo.
3. Choose 2 attacks with a 6-dice normal attack. Verify two 3-dice attacks, independent defenses/damage/soak and one Next Attack. Try targeting another defender before the second attack.
4. Choose Grapple/Hold. Establish an opposed hold, attempt escape, verify the holder rolls, and test both escape and Hold Maintained. Try Release Hold.
5. Repeat an ordinary melee attack and the existing GM Apply/Undo sequence; verify no regression. Re-test a player-owned NPC and the two-player socket flow.

**Evidence:** Source and native WoD20 firing mode fields inspected. Automated/mock tests cover mode arithmetic, ammo, split pools, grapple state transitions, HUD behavior and regressions. Nothing in v0.2.0 has been live-verified against the user's running Foundry v14 yet. **Upgrade:** Back up world and module, install v0.2.0, restart/refresh. **Rollback:** restore v0.1.10; previous gameplay health changes are not reverted by module rollback.


## v0.2.2 — Per-user quick tutorial

On the first login after this release is enabled, each user (GM or player) sees an optional **Combat Workflow — Quick Start** window after the world finishes loading. The tutorial contains four short screens: **Token Actions**, **Attack**, **Grapple**, and **Follow the chat**. Back/Next controls make it navigable without performing any rolls or affecting the world. Users can close the window without saving a preference, in which case it may appear on their next login.

The final screen offers a clearly labeled **Don't show again** button. It saves only a flag on the current Foundry User document: `flags.stl-combat-workflow.tutorialDismissed`. That user will not see the automatic tutorial on later logins in this world, including on another device. No GM approval, change to other users, shared settings, Actor writes, or migration is involved. Users can still reopen the tutorial on demand from the small **? Quick tutorial** footer link inside the Token HUD lightning-bolt Actions flyout. It does not add another permanent HUD icon or another full-size action button. If saving the preference fails, the window warns and stays open so the user can try again.

**Verification:** Automated mock test covers first-login behavior, four screens, Back/Next, final per-user dismissal and manually reopening it after dismissal. Live Foundry UI and player User-document flag permissions have not yet been confirmed. For a live smoke test, log in with a test player's account, use Don't show again on the final page, refresh/rejoin the world and verify the pop-up stays suppressed. Then right-click an owned token, open Actions, and use ? Quick tutorial to reopen it. Test from GM and player clients. No need to change the Player Actions/Magick module.

**Upgrade:** Back up the world and existing `Z:\Data\modules\stl-combat-workflow` module, update to v0.2.2, restart or hard-refresh all clients. **Rollback:** restore v0.2.1. The preference is stored on the User document and persists across module rollback; it is harmless if an older release does not read it. Completed combat health changes are not undone by rollback.
