# 16 - Combat Workflow handoff

**Owning chat:** 16.1 - Combat Macro
**Artifact:** `stl-combat-workflow` v0.1.3 standalone field-test
**Status:** User confirms complete basic combat and GM Undo in v0.1.2; new v0.1.3 chat order and Dice So Nice pacing are mock-tested only
**Date:** 2026-10-15

## Agreed intent

Provide player-facing sequential combat roll cards resembling the existing Magick macro's low-friction workflow; native Actor weapons and native WoD20 dice must be used. Full basic path is Attack, Dodge/Block/Parry, Damage, Soak, and GM-optional health application. GM should not need excessive approval steps for normal rolls.

## Implemented in this version

- One attacker token/one target; native Melee/Ranged Item or unarmed.
- ChatMessage-flag state machine and native dice rolls.
- Client chat buttons for the controlling attacker/defender (or GM); elected online GM updates workflow state over the native module socket.
- Native soak pool and native CombatHelper health application, confirmed GM apply / guarded Undo.
- V20 basic bashing and firearm special cases.
- Token-scene tool, optional macro API.

## Known source/input gaps

- `00-START-HERE.md` and any existing 16 handoff were not supplied.
- Actual installed WoD20 system 7.3.x files, Magick/Player Actions source ZIP and sample Combat Library weapon exports were not supplied. Implementation was based only on public WoD20 7.3.1 source and official Foundry v14 API reference.
- Live GM/player Foundry v14 and browser checks not run. Do not treat release ZIP creation as deployment or live success.

## Deferred

Multi-target fire, full-auto/burst/spray, action economy, complicated counterattacks, magick defense/countermagick, special soak, health consequences beyond the native health model. Test normal flow before adding them.

## Required live smoke test

Use the nine-step plan in `README.md`; the first high-value test is a two-client simple melee hit/dodge/damage/soak sequence with native chat cards and health Apply/Undo. Any failure should be reproduced with the browser console and a real weapon JSON.

## Cross-module contracts/status updates

- `GLOBAL-02`: Add Combat Workflow as a **consumer** of native WoD20 Item/roll/health and ChatMessage interfaces; it must not own dice, Paradox or Combat Library content.
- `GLOBAL-03`: Add two-user basic combat smoke test before release.
- `GLOBAL-04`: Add module 16 to the development queue as preview/unverified until live testing.
- Existing 05 Player Actions, 08/09 dice/Paradox and Combat Library ownership remains unchanged. Check integration when these module ZIPs are available.

## v0.1.1 integration — sheet launcher under Dodge

- Combat Workflow **owns** the injected `macroBtn.stl-combat-sheet-button` for PC `renderActorSheetV2`, directly after `macroBtn.wod20-dodge-button`; if the Dodge module is absent, insert after the native Roll button.
- Uses a microtask after the synchronous render hooks to remain independent of the registration order of `wod20-dodge-button`; no modification to the existing Dodge module or its `src/main.js`.
- The Combat sheet button launches `game.stlCombatWorkflow.open({attackerActor: app.actor})` internally. The Actor UUID is used for the attacker; canvas targeting of one defender is still required. The original Token Controls and no-argument `open()` entry points retain token-selection behavior.
- Test status: syntax/JSON and Node mock tests only until verified on the user's live Foundry v14 PC sheet.
- Cross-module handoff: the Dodge-button module remains separate and unchanged; document Combat shortcut's optional anchor CSS class as a read-only integration contract if its handoff is updated.

## v0.1.2 CSS contrast correction

- User live screenshot of v0.1.1 showed unreadably dark defender choices. Inspection showed the buttons were ordinary enabled HTML controls; the defect was inherited dark theme text, not disabled permissions.
- `styles/combat-workflow.css` now explicitly sets scoped contrast for normal, hover/focus and disabled actions. This fixes defense, attack/damage, soak and final GM buttons without changing native WoD20 UI or JavaScript behavior.
- Added `tests/test-chat-contrast.cjs` (static color ratio checks) to prevent regression. Other tests unchanged.
- v0.1.1 remains the rollback target. v0.1.2 changes no Actors, flags, schemas, hook contracts, or other module data.
- Need real live screenshot/check in user's dark Foundry theme after update; two-player workflow still unverified.

## v0.1.3: Newest combat card after native roll and Dice So Nice

- Owning development remains 16.1. User's live v0.1.2 screenshot showed native attack, defense, damage and soak chat cards, but the changing workflow card remained above them and advanced before the 3D dice finished.
- WoD20 7.3.1 DiceRoller initiates ChatMessage.create without awaiting it. The module now observes createChatMessage for the local actor's native roll, and optionally waits for Dice So Nice's waitFor3DAnimationByMessageID before sending progression.
- ChatMessage progression posts a fresh workflow card and deletes only the superseded workflow card. No native roll cards are removed. APPLYING stage remains updated in place for once-only health mutation safety.
- Tests mock chat creation, Dice So Nice completion, workflow replacement and GM Apply/Undo. New live two-player Foundry verification remains necessary.
- No other module contracts altered. v0.1.2 is the rollback target; deletions of prior workflow chat cards are intentional in v0.1.3 and not restored by rollback.
