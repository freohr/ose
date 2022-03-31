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

  async getResultsForRoll() {

  }

  /**
   * @param {roll: Roll, recursive: bool, _depth: int} Object: unpacking Roll object + Recursive flag + current recursion depth
   * @returns {rolls: Roll[], results: TableResult[]} Object: to unpack, contains the rolls from this table (single roll in case of a standard table, 1 roll/result for a treasure table), and the results obtained by the roll
   */
  async roll({ roll, recursive = true, _depth = 0 } = {}) {
    if (this.isTreasureTable) {
      return this.rollTreasure({ roll, recursive, _depth });
    } else {
      return super.roll({ roll, recursive, _depth });
    }
  }

  /**
   * Roll overload for Old School Treasure tables
   * @param {roll: Roll, recursive: bool, _depth: int} Object: unpacking Roll object + Recursive flag + current recursion depth
   * @returns {rolls: Roll[], results: TableResult[]}
   */
  async rollTreasure({ roll, recursive = true, _depth = 0 } = {}) {

    // Prevent excessive recursion
    if (_depth > 5) {
      throw new Error(`Maximum recursion depth exceeded when attempting to draw from RollTable ${this.id}`);
    }

    // Creating a d% roll to draw the treasure results
    roll = Roll.create("1d100");

    // Ensure that at least one non-drawn result remains
    const available = this.data.results.filter(r => !r.data.drawn);
    if (!this.data.formula || !available.length) {
      ui.notifications.warn("There are no available results which can be drawn from this table.");
      return { rolls: [roll], results };
    }

    // Iterate over each TableResult to check if it appears in the Treasure pile
    let rolls = [], results = [];

    available.forEach(result => {
      const localRoll = roll.reroll({ async: false });

      rolls.push(localRoll);

      if (localRoll.total <= result.data.weight) {
        results.push(result);
      }
    });

    // Draw results recursively from any inner Roll Tables
    if (recursive) {
      let inner = [];

      const getInnerTableData = (result) => {
        switch (result.data.type) {
          case CONST.TABLE_RESULT_TYPES.DOCUMENT:
            return [null, result.data.collection];
          case CONST.TABLE_RESULT_TYPES.COMPENDIUM:
            const pack = game.packs.get(result.data.collection);
            return [pack, pack?.documentName];
          default:
            return [null, null];
        }
      };

      for (let result of results) {

        const [pack, documentName] = getInnerTableData(result);

        if (documentName === "RollTable") {
          const id = result.data.resultId;
          const innerTable = pack ? await pack.getDocument(id) : game.tables.get(id);

          if (innerTable) {
            const { _, innerResults } = await innerTable.roll({ _depth: _depth + 1 });
            inner = inner.concat(innerResults);
          }
        } else {
          inner.push(result)
        }
      }
      results = inner;
    }

    // Return the Roll and the results
    return { rolls: rolls, results }
  }

  /**
   * Get an Array of valid results for a given rolled total
   * @param {number} value    The rolled value
   * @return {TableResult[]}  An Array of results
   */
  _getResultsForRoll(value) {
    return this.results.filter(r => !r.data.drawn && Number.between(value, ...r.data.range));
  }

  /**
   * Get an Array of valid results for a given rolled total
   * @param {number|number[]} value: The rolled value or values in the case of a treasure table
   * @return {TableResult[]}  An Array of results
   */
  getResultsForRoll(value) {
    if (this.isTreasureTable) {
      return getTreasuresForRoll(value);
    } else {
      return super.getResultsForRoll(value);
    }
  }

  getTreasuresForRoll(rolls) {
    if (!Array.isArray(rolls)) {
      // If a treasure table if treated as a normal table, it's less error-prone to return nothing than try to shoehorn the base table logic in the treasure table expected data-model
      return [];
    }

    if (rolls.length > this.results.length) {
      // In case we get more rolls than we have results in this Table, discard any excess to avoid errors
      values = values.slice(this.results.length);
    }

    const resultItr = this.results[Symbol.iterator]();
    const zippedResults = rolls.map(roll => { return { roll: roll, result: resultItr.next().value }; });

    return zippedResults
      .filter(zipResult => (!zipResult.result.data.drawn && zipResult.roll.total <= zipResult.result.data.weight))
      .map(zipResult => zipResult.result);
  }
}