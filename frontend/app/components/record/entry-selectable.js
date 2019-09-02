import Ember from 'ember';

/**
 * @param node, e.g. block or dataset Ember object reference
 * @param nodeName, e.g. dataset.name
 * @param selectedNode reference of currently selected node, e.g. selectedDataset.
 * Used to apply distinguishing format to the element.
 * @param selectNode  action to select this node, e.g. selectDataset

 * @param extraClasses (optional)  added to the component's root element <li>, e.g. d-inline-block for formatting.
 */
export default Ember.Component.extend({

  tagName: 'li',

  classNames : ['list-group-item'],
  classNameBindings: ['selected:list-group-item-success:list-group-item-info', 'extraClasses'],
  selected: function() {
    // console.log('selected', this.get('node.id'), this.get('selectedNode.id'));
    return this.get('node.id') === this.get('selectedNode.id');
  }.property('node', 'selectedNode'),

  click() {
    // console.log('entry-selectable click', this, this.get('node'), this.get('element'), this.get('parentView'));
    this.sendAction('selectNode', this.get('node'));
  }

});
