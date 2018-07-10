
    /** Constructor for Flow type.
     *  Wrap the connection of data to display via calculations (aliases etc).
     * These functions operate on an array of Flow-s :  pathUpdate(), collateStacks().
     *
     * The data points in a genetic map are features, in a physical map (chromosome) they are genes.
     * Here, the term feature is used to mean features or genes as appropriate.
     * @param direct	true : match feature names; false : match feature aliases against feature names.
     * @param unique	require aliases to be unique 1:1; i.e. endpoints (features or genes) with only 1 mapping in the adjacent axis are shown
     */
    function Flow(name, direct, unique, collate) {
      this.name = name;
      this.direct = direct;
      this.unique = unique;
      this.collate = collate;
      this.visible = this.enabled;
    };
    Flow.prototype.enabled = true;

/*----------------------------------------------------------------------------*/

export { Flow };
