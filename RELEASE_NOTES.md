# WoD20 Combat Workflow v0.3.6 — Candidate

## Targeted Attack remembers your last attack

When reopening Combat Workflow through Targeted Attack, the Actor's last **rolled** weapon or maneuver is preselected. The remembered attack remains available in later rounds and against new targets, in that user's browser. Each Actor remembers separately; native sheet weapon clicks and virtual Bite/Kick/Punch clicks always override the remembered selection. A removed custom weapon safely falls back; stored basic attacks resolve to their current real/virtual version.

Roll Attack remains a deliberate click. Difficulty, dice bonuses, damage-type overrides, firing mode and multiple attacks continue to reset. The preference is stored in a hidden **client** setting, not on Actors, Items, user macros or world flags. No migration or changes to prior rolls occur. Cancelled dialogs and failed rolls never change the preference.

**Test status:** automated/mock only, not tested in live Foundry v14 with WoD20. Candidate based on the verified v0.3.5 source branch. Back up the module folder and world before installing; restart and Shift+F5 afterward. Rollback restores complete v0.3.5 module code; preference is inert if you downgrade.

\n---\n\n# WoD20 Combat Workflow v0.3.5 — Candidate (legacy Creature sheet support)

## Default attacks on every character

Bite, Kick, and Punch appear by default in the Attack chooser, and as read-only clickable rows in the native Natural Weapons section when an Actor doesn't already own the named weapon. These are virtual actions: no Items are created or written to Actors, and all existing customized copies take precedence.

- Bite: Dexterity + Brawl, difficulty 5, damage Strength +1 **bashing** by default.
- Kick: Dexterity + Brawl, difficulty 7, damage Strength +1 **bashing**.
- Punch: Dexterity + Brawl, difficulty 6, damage Strength **bashing**.

Damage type for Bite varies with physiology; use an edited owned Bite Item or choose Lethal/Aggravated when applicable. Spirits keep their existing splat-aware combat dice rules. Basic maneuvers continue into the native ChatMessage, defender reaction, damage/soak and optional split attacks.

## Character-sheet fix

The v0.3.5 candidate could load correctly but show only owned Natural Weapons such as Bite. The v0.3.5 candidate inserts missing virtual rows synchronously into Foundry v14 pending sheet HTML and also listens to the general ApplicationV2 render event for Creature/Spirit variants. The row insertion is idempotent even if both hooks fire. This is mock-tested, not yet confirmed in the user's Foundry sheet.

## Data safety and compatibility

No automatic character/Item import, Actor migration, compendium rewrite, or hotbar modification. Existing Bite/Kick/Punch weapons are neither replaced nor duplicated. GM-confirmed health changes through earlier combat workflows remain unrelated and unmodified.

Foundry v14 with WoD20 v7.3.1+; automated CI/mocks only at candidate stage. Back up world/module folder before testing. To roll, select one attacker and target exactly one defender, or click a default from its Combat sheet with exactly one target. A GM must be online.

## Upgrade and rollback

Candidate only; stable v0.3.2 remains published. Back up `Z:\\Data\\modules\\stl-combat-workflow` and the Foundry world. Install the complete inner ZIP under `Z:\\Data\\modules`, with `module.json` directly inside `stl-combat-workflow`. Restart Foundry and Shift+F5.

Rollback: restore v0.3.2 code and restart/hard-refresh. New virtual actions create no Actor data; existing applied combat wounds and completed rolls are not undone by code rollback.

**Source:** GitHub repo `rebsiot/combat-workflow`, verified source baseline main `2f6cf4cc7e671766ccc684abc605d0e7320dbc1a` (implementation v0.3.2 commit `7258a7fdb2c622c688b2611830b73d75117fe99e`). Branch `feature/basic-maneuvers-v0.3.5`. No live installation/release verified for v0.3.5.
