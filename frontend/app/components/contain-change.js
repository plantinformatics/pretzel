import { on } from '@ember/object/evented';
import $ from 'jquery';
import { later } from '@ember/runloop';
import Component from '@ember/component';

export default Component.extend({
  listen: on('init', function() {
    let drawMap = this.get('drawMap'); 
    console.log("listen", drawMap);
    if (drawMap === undefined)
      console.log('parent component drawMap not passed');
    else {
      drawMap.on('pathHovered', this, 'pathHovered');
    }
  }),

  // remove the binding created in listen() above, upon component destruction
  cleanup: on('willDestroyElement', function() {
    let drawMap = this.get('drawMap');
    if (drawMap)
    drawMap.off('pathHovered', this, 'pathHovered');
  }),

  actions : {
    /** initial value of pinned is undefined - falsey */
    pinToolTip : function () {
      console.log("path-hover pinToolTip", this.get('pinned'));
      this.toggleValue('pinned');
    },
    /** initial value of extended is undefined - falsey */
    extendToolTip : function () {
      console.log("path-hover extendToolTip", this.get('extended'));
      this.toggleValue('extended');
    }

  },

  didInsertElement() {
    this._super(...arguments);
    let features = this.features, targetId = this.targetId,
    targetSel = "#" + targetId;
    
    console.log("components/path-hover didInsertElement()", this.element,
                features, targetId, this._targetObject, this.parentView.element);

    later(function() {
      let d = $('.tooltip.ember-popover');  // make-ui-draggable
      console.log(d, d.length, d[0], d[1]);
      // d.draggable();
    });
  },

  /** set attribute name of this to value, if that is not the current value.
   * It is expected that value is not a complex type.
   */
  ensureValue : function(name, value)
  {
    if (this.get(name) != value)
      this.set(name, value);
  },
  /** toggle the value of the named attribute name of this.
   * It is expected that value is boolean.
   */
  toggleValue : function(name, value)
  {
    this.set(name,  ! this.get(name));
  },

  pathHovered: function(hovered, hoverFeatures) {
    console.log("pathHovered in components/contain-change", hovered, hoverFeatures);
    this.ensureValue('pathHoveredVar', hovered);
    this.set('hoverFeatures', hoverFeatures);
  }

});
