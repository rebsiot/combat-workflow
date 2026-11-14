# WoD20 Combat Workflow v0.3.0 — Spirit and creature combat

Combat Workflow now recognizes WoD20 **Spirit** creatures instead of trying to calculate a spirit's punch from nonexistent Dexterity and Brawl dots. It supports attacks in both directions between spirits and physical Actors.

### What's changed

- **Spirits:** Willpower for basic attacks/defenses/soak, Rage for physical damage, Essence as the GM-managed health resource. Missing traits prompt a warning instead of a misleading tiny dice pool.
- **Vampires, werewolves and physical creatures:** keep their native Actor Attributes, form-adjusted totals, weapon values, soak pools and wound tracks. A werewolf with Rage/Gnosis is not mistaken for a spirit.
- **GM Apply/Undo:** Can apply post-soak wounds to a physical Actor or reduce a spirit's temporary Essence, with guarded Undo. Missing Essence and special Corpus resources remain manual; existing character data is not migrated.
- **Preserved:** Native weapon Attack handoff, normal chat turn sequence, Grapple, ranged modes and the separate Player Magick/Paradox systems.

### Before you update

Back up the Foundry world and the existing `stl-combat-workflow` module folder. Install v0.3.0 and refresh clients. **Applying Essence is a real Actor update**; restoring the previous module does not automatically restore health or Essence values. Retain a world backup.

### Known limits and verification

This implements common physical combat pools; it does not automate every W20/M20 supernatural rule. Spirit Charms, cross-realm contact, different aggravated-damage conventions, regeneration, Fortitude/Gifts, Wraith Corpus and other special resources remain GM decisions. The attack dialog allows a damage-type override.

**Automated tests:** native dice integration mocks and spirit/physical combat regression checks. **Live Foundry v14:** the new cross-splat flow has not yet been confirmed by a GM and player together. First live test: spirit attacks a mortal, then a mortal attacks a spirit; check the roll pools, Essence application and guarded Undo.

**Rollback:** [v0.2.6](https://github.com/rebsiot/combat-workflow/releases/tag/v0.2.6), with a matching world snapshot if play has changed Actor data.

**Install:** https://raw.githubusercontent.com/rebsiot/combat-workflow/main/module.json
