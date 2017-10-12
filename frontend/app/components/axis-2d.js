import Ember from 'ember';

export default Ember.Component.extend({

    actions: {
	selectionChanged: function(selA) {
	    console.log("selectionChanged in components/axis-2d", selA);
	    for (let i=0; i<selA.length; i++)
		console.log(selA[i].marker, selA[i].position);
	},

    }

});

