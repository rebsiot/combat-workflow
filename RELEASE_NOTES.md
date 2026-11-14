# WoD20 Combat Workflow v0.2.6 — Attack directly from your weapon sheet

With one enemy targeted and a GM online, clicking **Attack** on an owned melee or ranged weapon now opens Combat Workflow with that weapon already selected. The workflow performs the attack roll once, then prompts the defender for Dodge, Block, Parry or No Defense before continuing through damage and soak.

### What changed
- Native WoD20 weapon **Attack** controls can launch Combat Workflow automatically. No second native attack roll or competing damage dialog opens.
- The new per-client **Use Combat Workflow from weapon attacks** setting is on by default and can be turned off at any time.
- Damage-only controls, unrelated rolls, Grapple, and attacks without one clear target retain their existing behavior.
- The public README now starts with usage and installation; internal handoffs and test files are excluded from the release ZIP.

### Before updating
Back up your world and current `stl-combat-workflow` module folder. Update to v0.2.6, restart Foundry and refresh player browsers. Your enabled/disabled setting in each world and saved Actor data remain unchanged.

**Testing:** Automated checks passed before publication if the release workflow shows success. Native weapon-sheet integration and multi-client Foundry operation still require live validation. If it behaves unexpectedly, disable the client auto-start setting or restore v0.2.5.

Install/update manifest: https://raw.githubusercontent.com/rebsiot/combat-workflow/main/module.json

Full details: [CHANGELOG.md](https://github.com/rebsiot/combat-workflow/blob/main/CHANGELOG.md)
