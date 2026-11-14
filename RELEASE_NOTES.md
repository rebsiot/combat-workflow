# WoD20 Combat Workflow v0.3.1 — Spirit Punch dice fix

**Fixed:** Clicking Punch on a WoD20 Creature (Spirit) could produce a one-die attack despite having seven dots of Willpower.

- Spirit physical attack/defense/soak now use the **permanent trait rating** (the filled dots on the sheet) rather than a potentially stale or temporarily reduced computed `roll` value. Spirit damage uses permanent Rage.
- Native Spirit weapon rows now launch Combat Workflow before the original WoD20 Dexterity + Brawl handler. With one defender targeted and a GM online, the clicked weapon is preselected and the workflow makes one native attack roll.
- Without exactly one target or a connected GM, a Spirit weapon click now warns **without making a misleading roll**. Ordinary physical actors retain their native fallback.
- The Spirit attack dialog displays the Willpower-based pool before you roll. No changes to other creature stats, Actor data, macros, Paradox, Magick, or the native WoD20 system.

**Test it:** Captain Marsh should display **7 Willpower attack dice** for Punch, with **5 base Rage damage dice**, plus any qualifying net attack-success bonus. Select one target, click Punch, then check the native WoD20 chat card for **seven dice**, not merely the number of successes.

**Safety and status:** GitHub automated regressions cover the reported Willpower 7 / derived roll 1 case, targeted/untargeted sheet clicks, no-GM safeguards, and native opt-out. **Live Foundry v14 has not been retested.** Back up your world and current module folder, update, restart Foundry and refresh clients. For an immediate workaround select one target and use the lightning-bolt Actions → Attack menu with Punch.

**Rollback:** [v0.3.0](https://github.com/rebsiot/combat-workflow/releases/tag/v0.3.0). Reverting the module does not undo wounds or Essence changes already applied during play.

Install manifest: https://raw.githubusercontent.com/rebsiot/combat-workflow/main/module.json
