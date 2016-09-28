import Ember from 'ember';

export default Ember.Component.extend({
	draw: function(myData, myMaps) {
		// Draw functionality goes here.
		//
		console.log("maps to draw:");
		console.log(myMaps);
		console.log("data to draw:");
		console.log(myData);
	},

	selectedMapset: null,
	selectedMap: null,
	markerLocations: null,

	didInsertElement() {
		var mapset = this.get('selectedMapset.class');
		console.log("AAAAAAAAAAAAA " + mapset);
		//console.log("JUMP here" + mapset);
		let grid = d3.divgrid();
		//Create tmp data
		var testData = [
			{"map": "Chara_x_Glenlea-1A", "marker": 6476, "location":35.1},
			{"map": "Chara_x_Glenlea-1A", "marker": 6478, "location":1},
			{"map": "Chara_x_Glenlea-1A", "marker": 6479, "location":5.1},
			{"map": "Chara_x_Glenlea-1A", "marker": 1, "location":31},
			{"map": "Chara_x_Glenlea-1A", "marker": 1212, "location":21},
			{"map": "Chara_x_Glenlea-1A", "marker": 2, "location":-11},
			{"map": "Chara_x_Glenlea-1A", "marker": 3, "location":5.1},
			{"map": "Chara_x_Glenlea-1A", "marker": 23, "location":3.1},
			{"map": "Chara_x_Glenlea-1A", "marker": 24, "location":12},
			{"map": "Chara_x_Glenlea-1A", "marker": 76, "location":10},
			{"map": "Chara_x_Glenlea-1A", "marker": 78, "location":0},
			{"map": "Hlb_x_Crk-1A", "marker": 6476, "location":34.1},
			{"map": "Hlb_x_Crk-1A", "marker": 6478, "location":3},
			{"map": "Hlb_x_Crk-1A", "marker": 6479, "location":6.1},
			{"map": "Hlb_x_Crk-1A", "marker": 1, "location":31},
			{"map": "Hlb_x_Crk-1A", "marker": 1212, "location":21},
			{"map": "Hlb_x_Crk-1A", "marker": 2, "location":32},
			{"map": "Hlb_x_Crk-1A", "marker": 3, "location":1},
			{"map": "Hlb_x_Crk-1A", "marker": 23, "location":2},
			{"map": "Hlb_x_Crk-1A", "marker": 24, "location":80},
			{"map": "Hlb_x_Crk-1A", "marker": 76, "location":30},
			{"map": "Hlb_x_Crk-1A", "marker": 78, "location":0},
			{"map": "Hlb_x_Crk-1A2", "marker": 6476, "location":29},
			{"map": "Hlb_x_Crk-1A2", "marker": 2, "location":31},
			{"map": "Hlb_x_Crk-1A2", "marker": 3, "location":4},
			{"map": "Hlb_x_Crk-1A2", "marker": 23, "location":30},
			{"map": "Hlb_x_Crk-1A2", "marker": 24, "location":12},
			{"map": "Hlb_x_Crk-1A2", "marker": 76, "location":3},
			{"map": "Hlb_x_Crk-1A2", "marker": 78, "location":30},
		];
	var maps = ["Chara_x_Glenlea-1A","Hlb_x_Crk-1A","Hlb_x_Crk-1A2"];

	var m = [100, 160, 80, 320],
		w = 1480 - m[1] - m[3],
		h = 850 - m[0] - m[2];

	let x = d3.scaleOrdinal().domain(maps).range([0, w]);

	var y = {},
		z = {}, // will contain map/marker information
		markers = new Set(),
		showAll = false;

	maps.forEach(function(m) { z[m] = {} });

	//console.log(maps[1]);
	let line = d3.line(),
		axis = d3.axisLeft(),
		foreground,
		brushActives = [],
		brushExtents = [];

	let svg = d3.select("#holder").append("svg") // append a new svg element
				.attr("width", w + m[1] + m[3]) // set attributes
				.attr("height", h + m[0] + m[2])
				.append("svg:g") // add svg group element
				.attr("transform", "translate(" + m[3] + "," + m[0] + ")");

	d3.select("#holder").on("keydown", function()
		{
			if ((String.fromCharCode(d3.event.keyCode)) == "D") {
				deletemap();
			}
			else if ((String.fromCharCode(d3.event.keyCode)) == "Z") {
			 	zoom();
			}
			else if ((String.fromCharCode(d3.event.keyCode)) == "R") {
				refresh();
			}
			else if ((String.fromCharCode(d3.event.keyCode)) == "A") {
				showAll = !showAll;
				refresh();
			}
			else if ((String.fromCharCode(d3.event.keyCode)) == " ") {
				console.log("space");
			}

		})

	let ldHash = {};

	testData.forEach(function(d) {
		z[d.map][d.marker] = +d.location;
		markers.add(d.Marker);
	});

	markers = Array.from(markers);
	maps.forEach(function(d) {
		y[d] = d3.scaleLinear()
				.domain([0,d3.max(Object.keys(z[d]), function(x) { return z[d][x]; } )])
				.range([0, h]); // set scales for each map

		y[d].flipped = false;

		y[d].brush = d3.brush()
			//.y(y[d]) //not work in d3 v4. will find a solution
			.on("brush", brush);
	});

	//Add foreground lines.
	foreground = svg.append("svg:g") // foreground has as elements "paths" that correspond to markers
					.attr("class", "foreground")
					.selectAll("g")
					.data(markers) // insert map data into path elements (each line of the "map" is a path)
					.enter().append("g")
					.attr("class", function(d) { return d; })

	markers.map(function(m) { 
		d3.selectAll("."+m)
		.selectAll("path")
		.data(path(m))
		.enter()
		.append("path")
		.attr("d", function(d) { return d; })});

    // Add a group element for each map.
    var g = svg.selectAll(".map")
        .data(maps)
        .enter().append("svg:g")
        .attr("class", "map")
        .attr("id", function(d) { return d; })
        .attr("transform", function(d) { return "translate(" + x(d) + ")"; })
        .call(d3.drag()
        	//.origin(function(d) { return {x: x(d)}; })
        	//.on("dragstart", dragstart) //not dragstart in v4. 
        	.on("drag", drag)
        	.on("end", function(d) { dragend(d); d3.event.sourceEvent.stopPropagation(); }))
        	//.on("click", function(d) { if (d3.event.defaultPrevented) return; click(d); });
        .on("click", function(d) {
                if (d3.event.shiftKey) {
                    click(d);
                }
                else {
                    if (!d3.selectAll(".map.selected").empty()) {
                        d3.selectAll(".map").classed("selected", false);
                    }
                    else {
                        d3.select("#"+d).classed("selected", function() {
                                return !d3.select("#"+d).classed("selected"); }) 
                    }
                }
            });
         // Add an axis and title.
    g.append("svg:g")
        .attr("class", "axis")
        .each(function(d) { d3.select(this).call(axis.scale(y[d])); })
        .append("svg:text")
        .attr("text-anchor", "middle")
        .attr("y", -12)
        .text(String);

    g.selectAll(".axis")
        .append("svg:text")
        .attr("text-anchor", "middle")
        .attr("y", h+25)
        .text("7A");

    // Add a brush for each axis.
    g.append("svg:g")
        .attr("class", "brush")
        .each(function(d) { d3.select(this).call(y[d].brush); })
        .selectAll("rect")
        .attr("x", -8)
        .attr("width", 16);


     let zoomedMarkers = [];


     function refresh() {
		d3.selectAll(".foreground g").selectAll("path").remove();
		d3.selectAll(".foreground g").selectAll("path").data(path).enter().append("path");
		foreground.selectAll("path").attr("d", function(d) { return d; })
	}

	function brush() {
		console.log("brush event");
		brushActives = maps.filter(function(p) { return !y[p].brush.empty(); }), // maps with an active brush
		brushExtents = brushActives.map(function(p) { return y[p].brush.extent(); }); // extents of active brushes
		if (brushExtents.length > 0) {
			console.log(brushExtents[0][0], brushExtents[0][1]);
		}
		d3.selectAll(".foreground g").classed("fade", function(d) {
			return !brushActives.every(function(p, i) {
				return brushExtents[i][0] <= z[p][d] && z[p][d] <= brushExtents[i][1]}
			)
		});
	};

	// Returns an array of paths (links between maps) for a given marker.
	function path(d) { // d is a marker
		let r = [];
		for (var k=0; k<maps.length-1; k++) {
			if (d in z[maps[k]] && d in z[maps[k+1]]) { // if markers is in both maps
				r.push(line([[x(maps[k]), y[maps[k]](z[maps[k]][d])],
							[x(maps[k+1]), y[maps[k+1]](z[maps[k+1]][d])]]));
			}
			else if (showAll) {
				if (d in z[maps[k]]) { 
					r.push(line([[x(maps[k])-5, y[maps[k]](z[maps[k]][d])],
	            				[x(maps[k])+5, y[maps[k]](z[maps[k]][d])]]));
				}
				if (d in z[maps[k+1]]) {
					r.push(line([[x(maps[k+1])-5, y[maps[k+1]](z[maps[k+1]][d])],
								[x(maps[k+1])+5, y[maps[k+1]](z[maps[k+1]][d])]]));
				}
			}
		}
		return r;
	}

	function dragstart(d) {
		i = maps.indexOf(d);
	}

	function drag(d) {
		x.range()[i] = d3.event.x;
		maps.sort(function(a, b) { return x(a) - x(b); });
		g.attr("transform", function(d) { return "translate(" + x(d) + ")"; });
		d3.selectAll(".foreground g").selectAll("path").remove();
		d3.selectAll(".foreground g").selectAll("path").data(path).enter().append("path");
		foreground.selectAll("path").attr("d", function(d) { return d; })
	}

	function dragend(d) {
		x.domain(maps).rangePoints([0, w]);
		d3.selectAll(".foreground g").selectAll("path").data(path).enter().append("path");
		var t = d3.transition().duration(500);
		t.selectAll(".map").attr("transform", function(d) { return "translate(" + x(d) + ")"; });
		t.selectAll(".foreground path").attr("d", function(d) { return d; })
	}

	function click(d) {
	   if (y[d].flipped) {
	       y[d] = d3.scale.linear()
	            .domain([0,d3.max(Object.keys(z[d]), function(x) { return z[d][x]; } )])
	            .range([0, h]); // set scales for each map
	        y[d].flipped = false;
	        var t = d3.transition().duration(500);
	        t.selectAll("#"+d).select(".axis")
	          .attr("class", "axis")
	          .each(function(d) { d3.select(this).call(axis.scale(y[d])); })
	    }
	    else {
	        y[d] = d3.scale.linear()
	            .domain([0,d3.max(Object.keys(z[d]), function(x) { return z[d][x]; } )])
	            .range([h, 0]); // set scales for each map
	        y[d].flipped = true;
	        var t = d3.transition().duration(500);
	        t.selectAll("#"+d).select(".axis")
	          .attr("class", "axis")
	          .each(function(d) { d3.select(this).call(axis.scale(y[d])); })
	    }
	    y[d].brush = d3.svg.brush()
	        .y(y[d])
	        .on("brush", brush);
	    d3.selectAll(".foreground g").selectAll("path").data(path).enter().append("path");
	    var t = d3.transition().duration(500);
	    t.selectAll(".foreground path").attr("d", function(d) { return d; });
	}
/*
   

   


*/

/*
=======

  draw: function(myData, myMaps) {
    // Draw functionality goes here.
    //
    console.log("maps to draw:");
    console.log(myMaps);
    console.log("data to draw:");
    console.log(myData);
  },

  didInsertElement() {
    // Only called after DOM element inserted for first time.
    //
>>>>>>> origin/develop
    let svgContainer = d3.select('#holder').append('svg')
                         .attr('width',1000)
                         .attr('height',1000);
    svgContainer.append('circle')
                .attr('cx', 250)
                .attr('cy', 250)	
                .attr('r', 100);

*/
/*

<<<<<<< HEAD
d3.csv("chr19_r2_f.r0.1.csv", function(file) {
    file.forEach(function(e) {
        //console.log(e.Loci1,e.Loci2);
        if (d3.keys(ldHash).indexOf(e.Loci1) == -1) {
            ldHash[e.Loci1] = {};
        }
        ldHash[e.Loci1][e.Loci2] = e.r2;
    });

});

function makeLDPlot(d) {
    ld = d3.select("body").append("svg:svg")
                          .attr("height", 800)
                          .attr("width", 300)
                          .attr("transform", "translate(250,200)")
                          .attr("id", "LDPlot");
    u = 200/d.length;
    values = [];
    d.forEach(function(e) { d3.keys(ldHash[e]).forEach(function(f) {
                values.push(ldHash[e][f]) }) });
    console.log(d3.min(values),d3.max(values));
    grRamp = d3.scale.linear().interpolate(d3.interpolateHsl)
        .domain([d3.min(values),d3.max(values)]).range(["white", "#0066FF"]);
    for (i = 0; i < d.length; i++) {
        for (row = 0; row < d.length - i; row++) {
            xpos = 0 - row*u;
            ypos = i*2*u + row*u;
            ld.append("path").attr("d", "M"+xpos+","+ypos+
                                        "L"+(xpos+u)+","+(ypos+u)+
                                        "L"+xpos+","+(ypos+2*u)+
                                        "L"+(xpos-u)+","+(ypos+u)+
                                        "L"+xpos+","+ypos)
                .attr("stroke", "#D8D8D8")
                .attr("fill", function(p) {
                        if (d3.keys(ldHash).indexOf(d[i]) != -1) {
                        if (d3.keys(ldHash[d[i]]).indexOf(d[row]) != -1) {
                                return grRamp(ldHash[d[i]][d[row]]);
                            }
                        }
                        return grRamp(0);
                      });
        }
    }
}
*/
	//d3.divgrid can be used later
	d3.select('#grid')
		.datum(testData)
		.call(grid);
  },
   didRender() {
    // Called on re-render (eg: add another map) so should call
    // draw each time.
    //
    let data = this.get('data');
    let maps = this.get('maps');
    this.draw(data, maps);
  }
});
