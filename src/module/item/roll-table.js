export class OseRollTable extends RollTable {
  constructor(...args) {
    super(...args);
  }

  static get defaultOptions() {
    return super.defaultOptions;
  }

  get isTreasureTable() {
    const isTreasureTable = Boolean(this.getFlag("ose", "treasure"));

    return isTreasureTable;
  }

  async _rollTreasure({ roll, recursive = true, _depth = 0 }) {

    // Prevent excessive recursion
    if (_depth > 5) {
      throw new Error(`Maximum recursion depth exceeded when attempting to draw from RollTable ${this.id}`);
    }

    // Creating a d% roll to draw the treasure results
    roll = roll instanceof Roll ? roll : Roll.create("1d100");
    let results = [];

    // Ensure that at least one non-drawn result remains
    const available = this.data.results.filter(r => !r.data.drawn);
    if (!this.data.formula || !available.length) {
      ui.notifications.warn("There are no available results which can be drawn from this table.");
      return { roll, results };
    }

    // Ensure that results are available within the minimum/maximum range
    const minRoll = (await roll.reroll({ minimize: true, async: true })).total;
    const maxRoll = (await roll.reroll({ maximize: true, async: true })).total;
    const availableRange = available.reduce((range, result) => {
      const r = result.data.range;
      if (!range[0] || (r[0] < range[0])) range[0] = r[0];
      if (!range[1] || (r[1] > range[1])) range[1] = r[1];
      return range;
    }, [null, null]);
    if ((availableRange[0] > maxRoll) || (availableRange[1] < minRoll)) {
      ui.notifications.warn("No results can possibly be drawn from this table and formula.");
      return { roll, results };
    }

    // Continue rolling until one or more results are recovered
    let iter = 0;
    while (!results.length) {
      if (iter >= 10000) {
        ui.notifications.error(`Failed to draw an available entry from Table ${this.name}, maximum iteration reached`);
        break;
      }
      roll = await roll.reroll({ async: true });
      results = this.getResultsForRoll(roll.total);
      iter++;
    }

    // Draw results recursively from any inner Roll Tables
    if (recursive) {
      let inner = [];
      for (let result of results) {
        let pack;
        let documentName;
        if (result.data.type === CONST.TABLE_RESULT_TYPES.DOCUMENT) documentName = result.data.collection;
        else if (result.data.type === CONST.TABLE_RESULT_TYPES.COMPENDIUM) {
          pack = game.packs.get(result.data.collection);
          documentName = pack?.documentName;
        }
        if (documentName === "RollTable") {
          const id = result.data.resultId;
          const innerTable = pack ? await pack.getDocument(id) : game.tables.get(id);
          if (innerTable) {
            const innerRoll = await innerTable.roll({ _depth: _depth + 1 });
            inner = inner.concat(innerRoll.results);
          }
        }
        else inner.push(result);
      }
      results = inner;
    }

    // Return the Roll and the results
    return { roll, results }
  }
}