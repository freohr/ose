// Import Modules
import { OseItemSheet } from "./module/item/item-sheet.js";
import { OseActorSheetCharacter } from "./module/actor/character-sheet.js";
import { OseActorSheetMonster } from "./module/actor/monster-sheet.js";
import { preloadHandlebarsTemplates } from "./module/preloadTemplates.js";
import { OseActor } from "./module/actor/entity.js";
import { OseItem } from "./module/item/entity.js";
import { OSE } from "./module/config.js";
import { registerSettings } from "./module/settings.js";
import { registerHelpers } from "./module/helpers.js";
import { registerFVTTModuleAPIs } from "./module/fvttModuleAPIs.js";
import * as chat from "./module/chat.js";
import * as macros from "./module/macros.js";
import * as party from "./module/party.js";
import { OseCombat } from "./module/combat.js";
import * as renderList from "./module/renderList.js";
import { OsePartySheet } from "./module/party/party-sheet.js";

import { OseRollTable } from "./module/treasure-table/treasure-roll-table.js";
import { OseRollTableConfig } from "./module/treasure-table/treasure-roll-table-sheet.js";

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

Hooks.once("init", async function () {
  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  CONFIG.Combat.initiative = {
    formula: "1d6 + @initiative.value",
    decimals: 2,
  };

  CONFIG.OSE = OSE;

  game.ose = {
    rollItemMacro: macros.rollItemMacro,
    oseCombat: OseCombat,
  };

  // Init Party Sheet handler
  OsePartySheet.init();

  // Custom Handlebars helpers
  registerHelpers();

  // Register custom system settings
  registerSettings();

  // Register APIs of Foundry VTT Modules we explicitly support that provide custom hooks
  registerFVTTModuleAPIs();

  CONFIG.Actor.documentClass = OseActor;
  CONFIG.Item.documentClass = OseItem;
  CONFIG.RollTable.documentClass = OseRollTable;

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("ose", OseActorSheetCharacter, {
    types: ["character"],
    makeDefault: true,
    label: "OSE.SheetClassCharacter",
  });
  Actors.registerSheet("ose", OseActorSheetMonster, {
    types: ["monster"],
    makeDefault: true,
    label: "OSE.SheetClassMonster",
  });

  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("ose", OseItemSheet, {
    makeDefault: true,
    label: "OSE.SheetClassItem",
  });

  RollTables.unregisterSheet("core", RollTableConfig);
  RollTables.registerSheet("ose", OseRollTableConfig, {
    makeDefault: true,
    label: "OSE.TreasureTable"
  });

  await preloadHandlebarsTemplates();
});

/**
 * This function runs after game data has been requested and loaded from the servers, so entities exist
 */
Hooks.once("setup", function () {
  // Localize CONFIG objects once up-front
  const toLocalize = [
    "saves_short",
    "saves_long",
    "scores",
    "armor",
    "colors",
    "tags",
  ];
  for (let o of toLocalize) {
    CONFIG.OSE[o] = Object.entries(CONFIG.OSE[o]).reduce((obj, e) => {
      obj[e[0]] = game.i18n.localize(e[1]);
      return obj;
    }, {});
  }

  // Custom languages
  const languages = game.settings.get("ose", "languages");
  if (languages != "") {
    const langArray = languages.split(",");
    langArray.forEach((l, i) => (langArray[i] = l.trim()));
    CONFIG.OSE.languages = langArray;
  }
});

Hooks.once("ready", async () => {
  Hooks.on("hotbarDrop", (bar, data, slot) =>
    macros.createOseMacro(data, slot)
  );
});

// License info
Hooks.on("renderSidebarTab", async (object, html) => {
  if (object instanceof ActorDirectory) {
    party.addControl(object, html);
  }
  if (object instanceof Settings) {
    let gamesystem = html.find("#game-details");
    // SRD Link
    let ose = gamesystem.find("h4").last();
    ose.append(
      ` <sub><a href="https://oldschoolessentials.necroticgnome.com/srd/index.php">SRD<a></sub>`
    );

    // License text
    const template = `${OSE.systemPath()}/templates/chat/license.html`;
    const rendered = await renderTemplate(template);
    gamesystem.find(".system").append(rendered);

    // User guide
    let docs = html.find("button[data-action='docs']");
    const styling =
      "border:none;margin-right:2px;vertical-align:middle;margin-bottom:5px";
    $(
      `<button data-action="userguide"><img src='systems/ose/assets/dragon.png' width='16' height='16' style='${styling}'/>Old School Guide</button>`
    ).insertAfter(docs);
    html.find('button[data-action="userguide"]').click((ev) => {
      new FrameViewer("https://vttred.github.io/ose", {
        resizable: true,
      }).render(true);
    });
  }
});

Hooks.on("preCreateCombatant", (combat, data, options, id) => {
  let init = game.settings.get("ose", "initiative");
  if (init == "group") {
    OseCombat.addCombatant(combat, data, options, id);
  }
});

Hooks.on("updateCombatant", OseCombat.debounce(OseCombat.updateCombatant), 100);
Hooks.on("renderCombatTracker", OseCombat.debounce(OseCombat.format, 100));
Hooks.on("preUpdateCombat", OseCombat.preUpdateCombat);
Hooks.on("getCombatTrackerEntryContext", OseCombat.debounce(OseCombat.addContextEntry, 100));

Hooks.on("renderChatLog", (app, html, data) => OseItem.chatListeners(html));
Hooks.on("getChatLogEntryContext", chat.addChatMessageContextOptions);
Hooks.on("renderChatMessage", chat.addChatMessageButtons);
Hooks.on("updateActor", party.update);

Hooks.on("renderCompendium", renderList.RenderCompendium);
Hooks.on("renderSidebarDirectory", renderList.RenderDirectory);

Hooks.on("OSE.Party.showSheet", OsePartySheet.showPartySheet);
