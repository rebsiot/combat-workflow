# WoD20 Combat Workflow v0.3.2 — Review incomplete NPC stats

Combat Workflow now offers a **GM-only stat review** when a non-player character has a missing or untrained (0) combat Ability.

For example, Catfiend's **Punch** has Dexterity 1 + Brawl 0, so the default attack is legitimately one die. If the character is unfinished, the GM may enter temporary **Dexterity 3 + Brawl 2** and roll **five dice** instead. The value is for this roll only; **the Actor sheet is not changed**. Accept the existing zero if being untrained is intentional.

This works with supported NPC Attack, Defense, Grapple, Damage and Soak steps. Missing Spirit Willpower/Rage and unknown native NPC soak pools can also be reviewed. It never invents stats or automatically edits character data.

The option **Review untrained NPC combat stats (GM)** is enabled by default per GM client and can be switched off. Other player and PC rolls are unchanged.

**Upgrade:** Back up your Foundry world and the existing module folder `Data/modules/stl-combat-workflow`. Install the complete v0.3.2 ZIP or update from the manifest, restart Foundry and refresh clients.

**First test:** As GM, target an opponent with Catfiend, click Punch, accept/adjust Dexterity and Brawl, then verify the native WoD20 dice card shows the selected number of dice. Confirm Catfiend's saved stats are unchanged.

**Verification:** Automated and mock tests only until tested in a live Foundry v14 world. No Actor migrations. If necessary, turn off the client setting or restore [v0.3.1](https://github.com/rebsiot/combat-workflow/releases/tag/v0.3.1); code rollback does not reverse wound/Essence changes from gameplay.

Install manifest: https://raw.githubusercontent.com/rebsiot/combat-workflow/main/module.json
