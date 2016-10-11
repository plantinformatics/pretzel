import Ember from 'ember';

export default Ember.Component.extend({

  draw: function(myData, myMaps) {
    // Draw functionality goes here.

   //convert myData into format like: {map:1,marker:1,location:1}
    let d3Data = [];
    //myMaps should contain map IDs instead of mapset IDs.
    //mapIDs will be used to store map IDs
    let mapIDs = [];

    //margins, width and height (defined but not be used)
    let m = [100, 160, 80, 320],
    w = 1200 - m[1] - m[3],
    h = 700 - m[0] - m[2];

    let y = {},
        z = {}, // will contain map/marker information
        d3Markers = new Set(),
        showAll = false;

    let line = d3.line(),
        axis = d3.axisLeft(),
        foreground,
        brushActives = [],
        brushExtents = [];

    //Convert the data into proper format
    //myMaps mapset ID
    myMaps.forEach(function(i){
      //map ID
      let mIDs = Object.keys(myData[i]);
      //List of objects 
      //e.g.
      //location:36.2288
      //map:"1-1A"
      //marker:"IWB6476"
      //console.log(mIDs);
      mIDs.forEach(function(mapID) {
        var dataToArray = myData[i][mapID].toArray();
        //Push the values from the array to d3Data.
        d3Data.push.apply(d3Data, dataToArray);
        mapIDs.push(mapID);
        z[mapID] = {};
      });
    });
    //d3 v4 scalePoint replace the rangePoint
    //let x = d3.scaleOrdinal().domain(mapIDs).range([0, w]);
    let x = d3.scalePoint().domain(mapIDs).range([0, w]);
    let o = {};
    mapIDs.forEach(function(d){
      o[d] = x(d);
    })
    //console.log(z);
    //let dynamic = d3.scaleLinear().domain([0,1000]).range([0,1000]);
    
    d3Data.forEach(function(d) {
      z[d.map][d.marker] = +d.location;
      //console.log(d.map + " " + d.marker + " " + d.location);
      d3Markers.add(d.marker);
    });
    
    //creates a new Array instance from an array-like or iterable object.
    d3Markers = Array.from(d3Markers);
    //console.log(axis.scale(y[mapIDs))
    
    mapIDs.forEach(function(d) {
                  y[d] = d3.scaleLinear()
                          .domain([0,d3.max(Object.keys(z[d]), function(a) { return z[d][a]; } )])
                          .range([0, h]); // set scales for each map
                  y[d].flipped = false;
                  y[d].brush = d3.brushY()
                                 .extent([[-8,0],[8,h]])
                                 .on("brush", brushed);
                                 //.on("end",brushended);
              });

    d3.select("svg").remove();
    let svgContainer = d3.select('#holder').append('svg')
                           .attr('width',1200)
                           .attr('height',700)
                           .append("svg:g")
                           .attr("transform", "translate(100,100)");

    //User shortcut from the keybroad to manipulate the maps
    d3.select("#holder").on("keydown", function()
      {
        if ((String.fromCharCode(d3.event.keyCode)) == "D") {
          deleteMap();
        }
        else if ((String.fromCharCode(d3.event.keyCode)) == "Z") {
          zoomMap();
        }
        else if ((String.fromCharCode(d3.event.keyCode)) == "R") {
          refreshMap();
        }
        else if ((String.fromCharCode(d3.event.keyCode)) == "A") {
          showAll = !showAll;
          refreshMap();
        }
        else if ((String.fromCharCode(d3.event.keyCode)) == " ") {
          console.log("space");
        }

    });

    //Add foreground lines.
    foreground = svgContainer.append("g") // foreground has as elements "paths" that correspond to markers
                .attr("class", "foreground")
                .selectAll("g")
                .data(d3Markers) // insert map data into path elements (each line of the "map" is a path)
                .enter()
                .append("g")
                .attr("class", function(d) { return d; });
    
    d3Markers.forEach(function(m) { 
                  d3.selectAll("."+m)
                    .selectAll("path")
                    .data(path(m))
                    .enter()
                    .append("path")
                    .attr("d", function(d) { return d; })
                });

    // Add a group element for each map.
    var g = svgContainer.selectAll(".map")
        .data(mapIDs)
        .enter().append("g")
        .attr("class", "map")
        .attr("id", function(d) { return d; })
        .attr("transform", function(d) { return "translate(" + x(d) + ")"; })
        .call(d3.drag()
          .subject(function(d) { return {x: x(d)}; }) //origin replaced by subject
          .on("start", dragstarted) //start instead of dragstart in v4. 
          .on("drag", dragged)
          .on("end", dragended));//function(d) { dragend(d); d3.event.sourceEvent.stopPropagation(); }))
          //.on("click", function(d) { if (d3.event.defaultPrevented) return; click(d); });
        /*.on("click", function(d) {
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
            });*/
    // Add an axis and title.
    g.append("g")
      .attr("class", "axis")
      .each(function(d) { d3.select(this).call(axis.scale(y[d])); });

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("y", -12)
      .style("font-size",12)
      .text(String);

      
    // Add a brush for each axis.
    g.append("g")
      .attr("class", "brush")
      .each(function(d) { d3.select(this).call(y[d].brush); });


    //Probably leave the delete function to Ember
    //function deleteMap(){
    //  console.log("Delete");
    //}

    function zoomMap(){
      console.log("Zoom");
    }
    function refreshMap(){
      console.log("Refresh");
    }
    // Returns an array of paths (links between maps) for a given marker.
    function path(d) { // d is a marker
        var r = [];
        //console.log("Path function");
        for (var k=0; k<mapIDs.length-1; k++) {
            //console.log(k + " " + mapIDs.length);
            if (d in z[mapIDs[k]] && d in z[mapIDs[k+1]]) { // if markers is in both maps
                r.push(line([[o[mapIDs[k]], y[mapIDs[k]](z[mapIDs[k]][d])],
                             [o[mapIDs[k+1]], y[mapIDs[k+1]](z[mapIDs[k+1]][d])]]));
            }
            else if (showAll) {
                if (d in z[mapIDs[k]]) { 
                    r.push(line([[o[mapIDs[k]]-5, y[mapIDs[k]](z[mapIDs[k]][d])],
                                [o[mapIDs[k]]+5, y[mapIDs[k]](z[mapIDs[k]][d])]]));
                }
                if (d in z[mapIDs[k+1]]) {
                    r.push(line([[o[mapIDs[k+1]]-5, y[mapIDs[k+1]](z[mapIDs[k+1]][d])],
                                [o[mapIDs[k+1]]+5, y[mapIDs[k+1]](z[mapIDs[k+1]][d])]]));
                }
            }
        }
        return r;
    }
    function update(d){

    }
    let selectedMaps = {};
    let brushedRegions = {};
    function brushed() {
      if (!d3.event.sourceEvent) return; // Only transition after input.
      if (!d3.event.selection) {
          d3.selectAll(".foreground g").classed("fade",false);
          return; // Ignore empty selections.
      }
      var name = d3.select(this).data();

      //there is no empty function in v4. 
      //define two hashes to store the brush information from selected maps.
      selectedMaps[name[0]] = name[0]; 
      brushedRegions[name[0]] = d3.event.selection;

      brushExtents = Object.keys(selectedMaps).map(function(p) { return brushedRegions[p]; }); // extents of active brushes
      d3.selectAll(".foreground g").classed("fade", function(d) {
        return !Object.keys(selectedMaps).every(function(p, i) {
            //use the invert function to transfer the brush regions into proper domain values.
            return y[p].invert(brushExtents[i][0]) <= z[p][d] && z[p][d] <= y[p].invert(brushExtents[i][1]);
        });
      });
      //d3.select(".brush").call(brush.move, null);
    }

   // function brushended() {
   //   var s = d3.event.selection;
   //   if(!s){
   //     d3.selectAll(".foreground g").classed("fade", false);
    //  }
   // }

    function dragstarted(d) {
      d3.select(this).classed("active", true);
      d3.event.subject.fx = d3.event.subject.x;
    }

    function dragged(d) {
      o[d] = d3.event.x;
      // Now impose boundaries on the x-range you can drag.
      // These values should really be based on variables defined previously.
      if (o[d] < -50) { o[d] = -50; } else if (o[d] > 770) { o[d] = 770 }
      mapIDs.sort(function(a, b) { return o[a] - o[b]; });
      console.log(mapIDs + " " + o[d]);
      d3.select(this).attr("transform", function() {return "translate(" + o[d] + ")";});
      d3.selectAll(".foreground g").selectAll("path").remove();
      d3.selectAll(".foreground g").selectAll("path").data(path).enter().append("path");
      d3.selectAll(".foreground g").selectAll("path").attr("d", function(d) { return d; })
      //d3.event.subject.fx = d3.event.x;
    }

    function dragended(d) {
      // Order of mapIDs may have changed so need to redefine x and o.
      x = d3.scalePoint().domain(mapIDs).range([0, w]);
      mapIDs.forEach(function(d){
        o[d] = x(d);
      });
      x.domain(mapIDs).range([0, w]);
      d3.selectAll(".foreground g").selectAll("path").data(path).enter().append("path");
      var t = d3.transition().duration(500);
      t.selectAll(".map").attr("transform", function(d) { return "translate(" + x(d) + ")"; });
      t.selectAll(".foreground path").attr("d", function(d) { return d; })
      d3.select(this).classed("active", false);
      d3.event.subject.fx = null;
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
       let zoomedMarkers = [];

    //let grid = d3.divgrid();
    //console.log(myMaps.start + " " + myMaps.end);
    //d3.select('#grid')
      //.datum(d3Data)
      //.call(grid);
     function refresh() {
    d3.selectAll(".foreground g").selectAll("path").remove();
    d3.selectAll(".foreground g").selectAll("path").data(path).enter().append("path");
    foreground.selectAll("path").attr("d", function(d) { return d; })
  }

 

 
  
*/

  },

  didInsertElement() {
    /*
      let svgContainer = d3.select('#holder').append('svg')
                           .attr('width',1480)
                           .attr('height',850)
                           .append("svg:g")
                           .attr("transform", "translate(320,100)");
      //User shortcut from the keybroad to manipulate the maps
      d3.select("#holder").on("keydown", function()
      {
        if ((String.fromCharCode(d3.event.keyCode)) == "D") {
          deleteMap();
        }
        else if ((String.fromCharCode(d3.event.keyCode)) == "Z") {
          zoomMap();
        }
        else if ((String.fromCharCode(d3.event.keyCode)) == "R") {
          refreshMap();
        }
        else if ((String.fromCharCode(d3.event.keyCode)) == "A") {
          showAll = !showAll;
          refreshMap();
        }
        else if ((String.fromCharCode(d3.event.keyCode)) == " ") {
          console.log("space");
        }

      });
*/

                           //console.log("AAAAA " + Ember.inspect(svgContainer));
    // Only called after DOM element inserted for first time.
    //
    //let d3Data = this.get('data');
    //let maps = this.get('maps');
    //let grid = d3.divgrid();
    //let svgContainer = d3.select('#holder').append('svg')
    //                    .attr('width',700)
    //                    .attr('height',700);
    //svgContainer.append('circle')
    //            .attr('cx', 250)
    //            .attr('cy', 250)
    //            .attr('r', 100);
    //console.log("AAAAA " + d3Data[0]);// + " " + maps);
    //d3.select('#grid')
    //.datum(d3Data)
    //.call(grid);
  },

  didRender() {
    // Called on re-render (eg: add another map) so should call
    // draw each time.
    //
    let data = this.get('data');
    let maps = d3.keys(data);
    //console.log("BBBB");
    //console.log(data);
    this.draw(data, maps);
  }
});
