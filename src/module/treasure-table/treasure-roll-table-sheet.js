export class OseRollTableConfig extends RollTableConfig {
  constructor(...args) {
    super(...args);
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["sheet", "roll-table-config", "ose-treasure-table"],
      template: "systems/ose/dist/templates/roll-tables/treasure-table-config.html",
    })
  }

  /** @inheritdoc */
  get title() {
    const headerPrefix = this.document.isTreasureTable
      ? game.i18n.localize("OSE.table.treasure.title")
      : game.i18n.localize("TABLE.SheetTitle");

    return `${headerPrefix}: ${this.document.name}`;
  }

  getData() {
    const data = super.getData();
    data.isTreasureTable = this.document.isTreasureTable;
    data.config = CONFIG.OSE;
    return data;
  }

  /* -------------------------------------------- */

  /**
   * Handle drawing a result from the RollTable
   * @param {Event} event
   * @private
   */
  async _onRollTable(event) {

    if (!this.document.isTreasureTable) {
      super._onRollTable(event);
      return;
    }

    event.preventDefault();
    await this.submit({ preventClose: true, preventRender: true });
    event.currentTarget.disabled = true;

    const tableRoll = await this.document.rollTreasure();
    const draws = this.document.getTreasuresForRoll(tableRoll.rolls);

    if (draws.length) {
      if (game.settings.get("core", "animateRollTable")) await this._animateRoll(draws);
      await this.document.draw(tableRoll);
    }

    event.currentTarget.disabled = false;
  }

  /** @inheritdoc */
  activateListeners(html) {
    super.activateListeners(html);

    html.find(".toggle-treasure").click((ev) => {
      const isTreasure = Boolean(this.document.getFlag("ose", "treasure"));
      this.document.setFlag("ose", "treasure", !isTreasure);
      this.render(true);
    });
  }
}
