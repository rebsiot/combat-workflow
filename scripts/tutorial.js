// STL Combat Workflow tutorial: player-specific, optional, and fully dismissible.
// Kept separate from the combat engine so it cannot interfere with native rolls.
(() => {
  const MOD = "stl-combat-workflow";
  const FLAG = "tutorialDismissed";
  const STEPS = [
    {
      title: "Start from your token",
      body: "<p>Right-click a token you control, then click the <strong>lightning-bolt Actions</strong> icon.</p><p>For Attack or Grapple, <strong>target one defender</strong> first using Foundry's normal token targeting.</p>"
    },
    {
      title: "Attack",
      body: "<p>Choose <strong>Attack</strong> for weapons or an unarmed strike. Pick your weapon and roll with WoD20's native dice.</p><p>Weapons that support it can use burst or full-auto fire. Split attacks advance one at a time through the chat card.</p>"
    },
    {
      title: "Grapple",
      body: "<p>Choose <strong>Grapple</strong> for a separate, simple <strong>Strength + Brawl</strong> roll.</p><p>The defender may resist. If a hold is established, follow the chat card to attempt escape, contest escape, or release the hold on an allowed action.</p>"
    },
    {
      title: "Follow the chat",
      body: "<p>The colored name box shows <strong>whose turn it is</strong>. Defenders choose a defense, then <strong>Roll Soak</strong> or <strong>No Soak</strong> when prompted.</p><p>The GM can apply or undo wounds. <strong>Magick</strong> appears in Actions when Player Actions is enabled.</p><p>To see these tips again later, choose <strong>Actions → Quick tutorial</strong>.</p>"
    }
  ];
  async function showTutorial() {
    if (game.system?.id !== "worldofdarkness" || document.querySelector(".stl-combat-tutorial")) return;
    const Dialog = foundry.applications?.api?.DialogV2;
    if (!Dialog) return;
    const content = '<section class="stl-combat-tutorial" aria-label="Combat Workflow quick tutorial">' +
      '<div class="stl-combat-tutorial-progress" aria-live="polite"></div>' +
      '<h3 class="stl-combat-tutorial-title"></h3>' +
      '<div class="stl-combat-tutorial-body"></div>' +
      '<div class="stl-combat-tutorial-controls">' +
        '<button type="button" data-stl-tutorial-action="back">Back</button>' +
        '<button type="button" data-stl-tutorial-action="next">Next</button>' +
        '<button type="button" data-stl-tutorial-action="dismiss">Don\u0027t show again</button>' +
      '</div></section>';
    const dialog = new Dialog({
      window: {title: "Combat Workflow — Quick Start"},
      position: {width: 470},
      content,
      buttons: [{action: "close",label: "Close for now"}]
    });
    await dialog.render({force: true});
    const root = dialog.element?.querySelector?.(".stl-combat-tutorial");
    if (!root) return;
    const progress = root.querySelector(".stl-combat-tutorial-progress");
    const title = root.querySelector(".stl-combat-tutorial-title");
    const body = root.querySelector(".stl-combat-tutorial-body");
    const back = root.querySelector('[data-stl-tutorial-action="back"]');
    const next = root.querySelector('[data-stl-tutorial-action="next"]');
    const dismiss = root.querySelector('[data-stl-tutorial-action="dismiss"]');
    let index = 0;
    const renderStep = () => {
      progress.textContent = "Step " + (index + 1) + " of " + STEPS.length;
      title.textContent = STEPS[index].title;
      body.innerHTML = STEPS[index].body;
      back.disabled = index === 0;
      next.hidden = index === STEPS.length - 1;
      dismiss.hidden = index !== STEPS.length - 1;
    };
    root.addEventListener("click", async event => {
      const action = event.target.closest?.("[data-stl-tutorial-action]")?.dataset?.stlTutorialAction;
      if (!action) return;
      event.preventDefault();
      if (action === "back" && index > 0) index--;
      else if (action === "next" && index < STEPS.length - 1) index++;
      else if (action === "dismiss" && index === STEPS.length - 1) {
        try {
          await game.user.setFlag(MOD, FLAG, true);
          await dialog.close();
        } catch (error) {
          console.error(MOD + " | Could not save tutorial preference", error);
          ui.notifications?.warn?.("Could not save your tutorial preference. Try again.");
        }
        return;
      }
      renderStep();
    });
    renderStep();
  }
  function addTutorialHelp(hud, html) {
    const root = html?.querySelector ? html : hud?.element;
    const menu = root?.querySelector?.(".stl-token-actions-menu");
    if (!menu || menu.querySelector(".stl-token-actions-help")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "stl-token-actions-help";
    button.textContent = "? Quick tutorial";
    button.title = "Show Combat Workflow quick tutorial";
    button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      menu.hidden = true;
      menu.parentElement?.querySelector?.(".stl-token-actions-button")?.setAttribute("aria-expanded", "false");
      void showTutorial().catch(error => {
        console.error(MOD + " | Tutorial unavailable", error);
        ui.notifications?.warn?.("Could not open the Combat Workflow tutorial.");
      });
    });
    menu.appendChild(button);
  }
  Hooks.on("renderTokenHUD", (hud, html) => {
    queueMicrotask(() => addTutorialHelp(hud, html));
  });
  Hooks.once("ready", () => {
    if (game.system?.id !== "worldofdarkness" || !game.user) return;
    setTimeout(() => {
      if (game.user?.getFlag?.(MOD, FLAG)) return;
      void showTutorial().catch(error => console.error(MOD + " | Tutorial unavailable", error));
    }, 1000);
  });
})();
