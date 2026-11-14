# WoD20 Combat Workflow

A guided attack and defense flow for the **World of Darkness 20th edition** system in Foundry VTT. Players roll with WoD20's native dice; the chat card moves through **Attack → Dodge / Block / Parry → Damage → Soak → optional GM Apply / Undo**.

For example: a character attacks an NPC with a sword. The native attack roll appears in chat; the defender chooses Dodge, Block, Parry or No Defense; a successful hit proceeds to damage and soak. The GM can apply the final wounds to the native health track and undo that application while it is still safe.

The module also supports a separate Grapple/Hold flow, split attacks, and supported ranged burst/full-auto modes.

## Requirements

- Foundry VTT **v14** and the **`worldofdarkness`** system (**7.3.1+** declared; compatibility of the current build still needs a live two-client test).
- An active GM is needed to coordinate an attack across players.
- Optional: Player Magick (`wod20-player-actions`) adds Magick to the token Actions menu. It remains an independent module.
- Optional: Dice So Nice adds animations; Combat Workflow still requires a native WoD20 ChatMessage.

## Install or update

1. Back up your Foundry world and existing `Data/modules/stl-combat-workflow` folder.
2. In **Foundry Setup → Add-on Modules → Install Module**, use the manifest URL below, or install the full release ZIP manually into `Data/modules/stl-combat-workflow` while Foundry is stopped.
3. Enable **WoD20 Combat Workflow** in **Game Settings → Manage Modules** for your world, then restart/refresh as appropriate.

Manifest: https://raw.githubusercontent.com/rebsiot/combat-workflow/main/module.json

[Latest GitHub release](https://github.com/rebsiot/combat-workflow/releases/latest)

## Your first attack

1. Target **one defending token** using Foundry's normal target controls.
2. On your Actor's sheet, click the native **Attack** control next to an owned melee or ranged weapon. Combat Workflow opens with **that weapon already selected**. Alternatively, right-click an owned token, click the lightning-bolt **Actions** button, and choose **Attack**.
3. Confirm the attack choices and roll. Only **one native attack roll** is made.
4. Follow the acting character's colored name banner in chat. The defender chooses **Dodge, Block, Parry or No Defense**, followed by damage and **Roll Soak** or **No Soak**, as appropriate.
5. The GM can choose **Apply to Health** or leave damage unapplied. Guarded **Undo Damage** is available only while the original health state can still be restored safely.

### Native weapon attacks: new in v0.2.6

Clicking a **Melee Weapon** or **Ranged Weapon** native Attack control automatically enters Combat Workflow **when exactly one defender is targeted, the attacking Actor is controlled by the current user, and a GM is online**. The original native weapon attack/damage dialogs are not also opened. The native weapon is preselected in the Combat Workflow attack prompt.

If those conditions aren't met, WoD20's existing weapon dialog opens normally. **Damage-only** controls, other dice rolls, and native Grapple weapon Items continue to use their original behavior.

To opt out on your own client, turn off **Use Combat Workflow from weapon attacks** in the module settings. The manual lightning-bolt Actions launcher and sheet Combat button remain available.

This integration routes the native weapon *launcher* into Combat Workflow; it does not inspect or copy successes from an attack that already rolled. The WoD20 system's own complex weapon-dialog-only features (for example, spray fire or specialist modifiers) remain available by disabling auto-launch for that client.

### Grapple and extra actions

- **Grapple** is a separate choice under the token's lightning-bolt Actions menu; it asks for Strength + Brawl and Difficulty, then handles Resist, Hold, Escape and Release.
- **Multiple attacks** divide the selected attack pool across 2–4 sequential attacks. This is not a replacement for supernatural extra-action rules.
- **Burst and full-auto** are offered only for weapons with suitable WoD20 Item flags. This module currently handles a single defender at a time.

Players can replay the short tutorial from **Actions → Quick tutorial**. A first-login guide offers **Don't show again** on its last step.

## Permissions, limits and testing

- Attackers/defenders act only through Actors they control, or as GM. Only the GM applies/undoes health. No automatic mass import or data migration occurs.
- Native WoD20 dice and chat messages are retained. Combat Workflow does **not** add a second dice system or process Paradox.
- **Beta / field testing:** v0.2.6 passes automated regression checks, but the new native-sheet interception has **not** been verified in a live Foundry world. The current Grapple, firing-mode and two-client chat workflow also need fresh live checks. Before playing, test a single owned melee attack and its damage application in a backed-up test world.
- Rollback: disable the new client setting for immediate return to WoD20's native weapon launcher, or restore the [v0.2.5 module release](https://github.com/rebsiot/combat-workflow/releases/tag/v0.2.5). Restoring module code does **not** reverse wounds already applied in a game.

For changes and older versions, see the [changelog](CHANGELOG.md), [releases](https://github.com/rebsiot/combat-workflow/releases), and [issues](https://github.com/rebsiot/combat-workflow/issues).

## License

MIT-licensed code: [LICENSE](LICENSE). Unofficial World of Darkness fan utility, not endorsed or supported by Paradox Interactive, Onyx Path, or Foundry VTT. No proprietary character or map assets are included. Use at your own risk and keep a recoverable world backup.
