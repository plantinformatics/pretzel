import Ember from 'ember';

export default Ember.Component.extend({

  actions: {
    updatedSelectedMarkers: function(markers) {
      let markersAsArray = d3.keys(markers)
        .map(function (key) {
          return markers[key].map(function(marker) {
            //marker contains marker name and position, separated by " ".
            var info = marker.split(" ");
            return {Map:key,Marker:info[0],Position:info[1]};
          });
        })
        .reduce(function(a, b) { 
          return a.concat(b);
        }, []);
      console.log(markersAsArray);
      console.log("updatedSelectedMarkers in draw-map component");
      this.sendAction('updatedSelectedMarkers', markersAsArray);
    }
  },

  draw: function(myData, myMaps) {
    // Draw functionality goes here.
    let me = this;

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
        copyY = {},
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
      mIDs.forEach(function(mapID) {
        let dataToArray = myData[i][mapID].toArray();
        //Push the values from the array to d3Data.
        d3Data.push.apply(d3Data, dataToArray);
        mapIDs.push(mapID);
        z[mapID] = {};
      });
    });
    //d3 v4 scalePoint replace the rangePoint
    //let x = d3.scaleOrdinal().domain(mapIDs).range([0, w]);
    let x = d3.scalePoint().domain(mapIDs).range([0, w]);
		/// x of each map. mapIDs.forEach() : o[d] = x(d);
    let o = {};

    let zoomSwitch,resetSwitch;
    let zoomed = false;
    let reset = false;

    let pathMarkers = {}; //For tool tip

    let selectedMaps = [];
    let selectedMarkers = {};
    let brushedRegions = {};

    //Reset the selected Marker region, everytime a map gets deleted
    me.send('updatedSelectedMarkers', selectedMarkers);

    mapIDs.forEach(function(d){
      o[d] = x(d);
    });
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
      
      copyY[d] = d3.scaleLinear()
                .domain([0,d3.max(Object.keys(z[d]), function(a) { return z[d][a]; } )])
                .range([0, h]); 

      //console.log("OOO " + y[d].domain);
      y[d].flipped = false;
      y[d].brush = d3.brushY()
                     .extent([[-8,0],[8,h]])
                     .on("end", brushended);
    });

    d3.select("svg").remove();
    d3.select("div.d3-tip").remove();
    let svgContainer = d3.select('#holder').append('svg')
                         .attr('width',1200)
                         .attr('height',700)
                         .append("svg:g")
                         .attr("transform", "translate(100,100)");

    //User shortcut from the keybroad to manipulate the maps
    d3.select("#holder").on("keydown", function() {
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
        .attr("d", function(d) { return d; });
    });

    // Add a group element for each map.
    let g = svgContainer.selectAll(".map")
        .data(mapIDs)
        .enter().append("g")
        .attr("class", "map")
        .attr("id", function(d) { return eltId(d); })
        .attr("transform", function(d) { return "translate(" + x(d) + ")"; })
        .call(d3.drag()
          .subject(function(d) { return {x: x(d)}; }) //origin replaced by subject
          .on("start", dragstarted) //start instead of dragstart in v4. 
          .on("drag", dragged)
          .on("end", dragended));//function(d) { dragend(d); d3.event.sourceEvent.stopPropagation(); }))

    // Add an axis and title
    g.append("g")
     .attr("class", "axis")
      .each(function(d) { d3.select(this).attr("id","m"+d).call(axis.scale(y[d])); });  

    g.append("text")
      .attr("text-anchor", "middle")
      .attr("y", -12)
      .style("font-size",12)
      .text(String);

      
    // Add a brush for each axis.
    g.append("g")
      .attr("class", "brush")
      .each(function(d) { d3.select(this).call(y[d].brush); });

    //Setup the tool tip.
    let toolTip = d3.select("body").append("div")
                    .attr("class", "toolTip")
                    .attr("id","toolTip")
                    .style("opacity", 0);
    //Probably leave the delete function to Ember
    //function deleteMap(){
    //  console.log("Delete");
    //}

//d3.selectAll(".foreground g").selectAll("path")
    d3.selectAll("path")
      .on("mouseover",handleMouseOver)
      .on("mouseout",handleMouseOut);

    function handleMouseOver(d){
      //console.log(pathMarkers[d]);
       let t = d3.transition()
                 .duration(800)
                 .ease(d3.easeElastic);
       let listMarkers  = "";
       d3.select(this).transition(t)
          .style("stroke", "#880044")
          .style("stroke-width", "6px")
          .style("stroke-opacity", 1)
          .style("fill", "none");       
       toolTip.style("height","auto")
         .style("width","auto")
         .style("opacity", .9)
         .style("display","inline");  
       Object.keys(pathMarkers[d]).map(function(m){
         listMarkers = listMarkers + m + "<br />";
       });
       toolTip.html(listMarkers)     
         .style("left", (d3.event.pageX) + "px")             
         .style("top", (d3.event.pageY - 28) + "px");
    }

    function handleMouseOut(d){
      let t = d3.transition()
                .duration(800)
                .ease(d3.easeElastic);
      //Simple solution is to set all styles to null, which will fix the confusion display with brush. Note: tried css class, maybe my way is not right, but it didn't work.
      d3.select(this).transition(t)
           .style("stroke", null)
           .style("stroke-width", null)
           .style("stroke-opacity",null)
           .style("fill", null);
      toolTip.style("display","none");
    }


    function zoomMap(){
      console.log("Zoom");
    }
    function refreshMap(){
      console.log("Refresh");
    }
    // Returns an array of paths (links between maps) for a given marker.
    function path(d) { // d is a marker
        let r = [];

        for (let k=0; k<mapIDs.length-1; k++) {
            if (d in z[mapIDs[k]] && d in z[mapIDs[k+1]]) { // if markers is in both maps
                 //Multiple markers can be in the same path
                let sLine = line([[o[mapIDs[k]], y[mapIDs[k]](z[mapIDs[k]][d])],
                             [o[mapIDs[k+1]], y[mapIDs[k+1]](z[mapIDs[k+1]][d])]]);
                //pathMarkers[sLine][d] = 1;
                if(pathMarkers[sLine] != null){
                   pathMarkers[sLine][d] = 1;
                } else {
                   pathMarkers[sLine]= {};
                   pathMarkers[sLine][d] = 1;
                }
                r.push(sLine);
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

     // Returns an array of paths (links between maps) for a given marker when zoom in starts.
    function zoomPath(d) { // d is a marker
        let r = [];
        for (let k=0; k<mapIDs.length-1; k++) {
           //y[p].domain
           //z[mapIDs[k]][d] marker location
           //y[mapIDs[k]](z[mapIDs[k]][d]) relative marker location in the map
            if (d in z[mapIDs[k]] && d in z[mapIDs[k+1]]) { // if markers is in both maps
              //Remove those paths that either side locates out of the svg
                  if(y[mapIDs[k]](z[mapIDs[k]][d]) <=h && y[mapIDs[k+1]](z[mapIDs[k+1]][d]) <=h 
                      && y[mapIDs[k]](z[mapIDs[k]][d]) >=0 && y[mapIDs[k+1]](z[mapIDs[k+1]][d])>=0){
                        let sLine = line([[o[mapIDs[k]], y[mapIDs[k]](z[mapIDs[k]][d])],
                             [o[mapIDs[k+1]], y[mapIDs[k+1]](z[mapIDs[k+1]][d])]]);
                        if(pathMarkers[sLine] != null){
                          pathMarkers[sLine][d] = 1;
                        } else {
                          pathMarkers[sLine]= {};
                          pathMarkers[sLine][d] = 1;
                        }
                        r.push(line([[o[mapIDs[k]], y[mapIDs[k]](z[mapIDs[k]][d])],
                             [o[mapIDs[k+1]], y[mapIDs[k+1]](z[mapIDs[k+1]][d])]]));
                  } 
              
            } 
        }
        return r;
    }

      /* Used for group element, class "map"; required because id may start with
       * numeric mongodb id (of geneticmap) and element id cannot start with
       * numeric.
       * Not required for axis element ids because they have "m" suffix.
       */
      function eltId(name)
      {
				return "id" + name;
      }

    function brushHelper(that) {
      //Map name, e.g. 32-1B
      let name = d3.select(that).data();

      //Remove old circles.
      svgContainer.selectAll("circle").remove();

      if (d3.event.selection == null) {
        selectedMaps.removeObject(name[0]);
      }
      else {
        selectedMaps.addObject(name[0]); 
      }

      // selectedMaps is an array containing the IDs of the maps that
      // have been selected.
      
      if (selectedMaps.length > 0) {
        console.log("Selected: ", " ", selectedMaps.length);
        // Maps have been selected - now work out selected markers.
        brushedRegions[name[0]] = d3.event.selection;
        brushExtents = selectedMaps.map(function(p) { return brushedRegions[p]; }); // extents of active brushes

        selectedMarkers = {};
        selectedMaps.forEach(function(p, i) {
          selectedMarkers[p] = [];
          d3.keys(z[p]).forEach(function(m) {
            if ((z[p][m] >= y[p].invert(brushExtents[i][0])) &&
                (z[p][m] <= y[p].invert(brushExtents[i][1]))) {
              //selectedMarkers[p].push(m);    
              selectedMarkers[p].push(m + " " + z[p][m]);
              //Highlight the markers in the brushed regions
              //o[p], the map location, z[p][m], actuall marker position in the map, 
              //y[p](z[p][m]) is the relative marker position in the svg
              let dot = svgContainer.append("circle")
                                    .attr("class", m)
                                    .attr("cx",o[p])
                                    .attr("cy",y[p](z[p][m]))
                                    .attr("r",2)
                                    .style("fill", "red");

        
            } else {
              svgContainer.selectAll("circle." + m).remove();
            }
          });
        });
        me.send('updatedSelectedMarkers', selectedMarkers);

        d3.selectAll(".foreground g").classed("faded", function(d){
         //d3.event.selection [min,min] or [max,max] should consider as non selection.
         //maybe alternatively use brush.clear or (brush.move, null) given a mouse event
          return !d3.keys(selectedMarkers).every(function(p) {
             return selectedMarkers[p].includes(d);
          });
        
        });

        svgContainer.selectAll(".btn").remove();

          zoomSwitch = svgContainer.selectAll("#" + eltId(name[0]))
                  .append('g')
                  .attr('class', 'btn')
                  .attr('transform', 'translate(10)');
        zoomSwitch.append('rect')
                  .attr('width', 60).attr('height', 30)
                  .attr('rx', 3).attr('ry', 3)
                  .attr('fill', '#eee').attr('stroke', '#ddd');
        zoomSwitch.append('text')
                  .attr('x', 30).attr('y', 20).attr('text-anchor', 'middle')
                  .text('Zoom');
        
        zoomSwitch.on('click', function () {
           zoom(that,brushExtents);
           zoomed = true;

           //reset function
           svgContainer.selectAll(".btn").remove();
           //Remove all the existing circles
           svgContainer.selectAll("circle").remove();
            resetSwitch = svgContainer.selectAll("#" + eltId(name[0]))
                                    .append('g')
                                    .attr('class', 'btn')
                                    .attr('transform', 'translate(10)');
           resetSwitch.append('rect')
                  .attr('width', 60).attr('height', 30)
                  .attr('rx', 3).attr('ry', 3)
                  .attr('fill', '#eee').attr('stroke', '#ddd');
           resetSwitch.append('text')
                      .attr('x', 30).attr('y', 20).attr('text-anchor', 'middle')
                      .text('Reset');

           resetSwitch.on('click',function(){
             let t = svgContainer.transition().duration(750);
             
             mapIDs.forEach(function(d) {
               let idName = "m"+d; // axis ids have "m" suffix
               y[d].domain([0,d3.max(Object.keys(z[d]), function(a) { return z[d][a]; } )]);
               let yAxis = d3.axisLeft(y[d]).ticks(10);
               svgContainer.select("#"+idName).transition(t).call(yAxis);
             });
             d3.selectAll(".foreground g").selectAll("path").remove();
             d3.selectAll(".foreground g").selectAll("path").data(path).enter().append("path");
             t.selectAll(".foreground path").attr("d", function(d) {return d; });
             d3.selectAll("path")
              .on("mouseover",handleMouseOver)
              .on("mouseout",handleMouseOut);
               d3.selectAll("#" + eltId(name[0])).selectAll(".btn").remove();
             selectedMarkers = {};
             me.send('updatedSelectedMarkers', selectedMarkers);
             zoomed = false;
           });
        });
        
      } else {
        // No axis selected so reset fading of paths or circles.
        svgContainer.selectAll(".btn").remove();
        svgContainer.selectAll("circle").remove();
        d3.selectAll(".foreground g").classed("faded", false);
        selectedMarkers = {};
        me.send('updatedSelectedMarkers', selectedMarkers);
        brushedRegions = {};
      }

    }

    function zoom(that, brushExtents) {
      let mapName = d3.select(that).data();
      let t = svgContainer.transition().duration(750);
      selectedMaps.map(function(p, i) {
        if(p == mapName){
          y[p].domain([y[p].invert(brushExtents[i][0]), y[p].invert(brushExtents[i][1])]);
          let yAxis = d3.axisLeft(y[p]).ticks(10);
          let idName = "m"+p;
          svgContainer.selectAll(".btn").remove();
          svgContainer.select("#"+idName).transition(t).call(yAxis);
          d3.selectAll(".foreground g").selectAll("path").remove();
          d3.selectAll(".foreground g").selectAll("path").data(zoomPath).enter().append("path");
          t.selectAll(".foreground path").attr("d", function(d) {return d; });
          d3.selectAll("path")
            .on("mouseover",handleMouseOver)
            .on("mouseout",handleMouseOut);
          //that refers to the brush g element
          d3.select(that).call(y[p].brush.move,null);
        }
      });
    }

    function brushended() {
      //console.log("brush event ended");
      brushHelper(this);
    }


    function dragstarted(d) {
      d3.select(this).classed("active", true);
      d3.event.subject.fx = d3.event.subject.x;
    }

    function dragged(d) {
      o[d] = d3.event.x;
      // Now impose boundaries on the x-range you can drag.
      // These values should really be based on variables defined previously.
      if (o[d] < -50) { o[d] = -50; } else if (o[d] > 770) { o[d] = 770; }
      mapIDs.sort(function(a, b) { return o[a] - o[b]; });
      //console.log(mapIDs + " " + o[d]);
      d3.select(this).attr("transform", function() {return "translate(" + o[d] + ")";});
      d3.selectAll(".foreground g").selectAll("path").remove();
      if(zoomed){
        d3.selectAll(".foreground g").selectAll("path").data(zoomPath).enter().append("path");
      } else {
        d3.selectAll(".foreground g").selectAll("path").data(path).enter().append("path");
      }
      d3.selectAll(".foreground g").selectAll("path").attr("d", function(d) { return d; });
      d3.selectAll("path")
        .on("mouseover",handleMouseOver)
        .on("mouseout",handleMouseOut);
      //Do we need to keep the brushed region when we drag the map? probably not.
      //The highlighted markers together with the brushed regions will be removed once the dragging triggered.
      d3.select(this).select(".brush").call(y[d].brush.move,null);
      //Remove all highlighted Markers.
      svgContainer.selectAll("circle").remove();
    }

    function dragended(d) {
      // Order of mapIDs may have changed so need to redefine x and o.
      x = d3.scalePoint().domain(mapIDs).range([0, w]);
      
      mapIDs.forEach(function(d){
        o[d] = x(d);
      });
      x.domain(mapIDs).range([0, w]);
      if(zoomed){
        d3.selectAll(".foreground g").selectAll("path").data(zoomPath).enter().append("path");  
      } else {
        d3.selectAll(".foreground g").selectAll("path").data(path).enter().append("path");
      }
      
      let t = d3.transition().duration(500);
      t.selectAll(".map").attr("transform", function(d) { return "translate(" + x(d) + ")"; });
      t.selectAll(".foreground path").attr("d", function(d) { return d; });
      d3.select(this).classed("active", false);
      d3.selectAll("path")
        .on("mouseover",handleMouseOver)
        .on("mouseout",handleMouseOut);
      d3.event.subject.fx = null;
    }
    

  /*function click(d) {
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
       let zoomedMarkers = [];

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
  },

  didRender() {
    // Called on re-render (eg: add another map) so should call
    // draw each time.
    //
    let data = this.get('data');
    let maps = d3.keys(data);
    this.draw(data, maps);
  }
});
