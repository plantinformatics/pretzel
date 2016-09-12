/* mapViewer.js
   1. Using d3 as the graphic rendering engine to display maps and corresponding markers. 
   2. Search marker 
   3. Zoom in/out 
   4. ...
*/

/*
d3 variables
*/
var svg;
var width = 750;
var height = 600;
var grid = d3.divgrid();
var xAxis;
var yAxis;
var xScale;
var yScale;
var doubleYScale;
var tripleYScale;
var yScaleM;
var padding = {left:30, right:30, top:20, bottom:20};
var div = d3.select("body").append("div") 
    .attr("class", "tooltip")
    .style("display","none")       
    .style("opacity", 0);
var zoom = d3.behavior.zoom()
    .scaleExtent([1, 10])
    .on("zoom", zoomed);
var brushed = 0; //0 brush has been disabled. 1 brush has been enabled.
var mapStart;
var mapStop;
var defaultStart;
var defaultFlanking;
var scaleStart;
var scaleStop;
var position;
var left;
var right;
var middle = width/2;

/*
data variables
*/
//Count how many maps have been added
var clicks = 0;
var old_map;
var old_mapset;
var maps = [];
var mapsets = [];
var dataJson;
var coordMarker;
var doubleCoordMarker;
var tripleCoordMarker;
var lineData = [];
//Search function
var returnedMarkers = [];
var doubleMarkers;
var tripleMarkers;
var checkedData;

/* 
system variables
*/
var serverURL = "http://dav127.it.csiro.au:1776/api/v1/";



function zoomed() {
  svg.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
}

function hideshow(which){
  if (!document.getElementById)
    return
  if (which.style.display=="block")
    which.style.display="none"
  else
    which.style.display="block"
}

/*
From JavaScript and Forms Tutorial at dyn-web.com
Find information and updates at http://www.dyn-web.com/tutorials/forms/
*/
function removeAllOptions(sel, removeGrp) {
    var len, groups, par;
    if (removeGrp) {
        groups = sel.getElementsByTagName('optgroup');
        len = groups.length;
        for (var i=len; i; i--) {
            sel.removeChild( groups[i-1] );
        }
    }
    
    len = sel.options.length;
    for (var i=len; i; i--) {
        par = sel.options[i-1].parentNode;
        par.removeChild( sel.options[i-1] );
    }
}

function appendDataToSelect(sel, obj) {
    var f = document.createDocumentFragment();
    var labels = [], group, opts;
    
    function addOptions(obj) {
        var f = document.createDocumentFragment();
        var o;
        
        for (var i=0, len=obj.text.length; i<len; i++) {
            o = document.createElement('option');
            o.appendChild( document.createTextNode( obj.text[i] ) );
            
            if ( obj.value ) {
                o.value = obj.value[i];
            }
            
            f.appendChild(o);
        }
        return f;
    }
    
    if ( obj.text ) {
        opts = addOptions(obj);
        f.appendChild(opts);
    } else {
        for ( var prop in obj ) {
            if ( obj.hasOwnProperty(prop) ) {
                labels.push(prop);
            }
        }
        
        for (var i=0, len=labels.length; i<len; i++) {
            group = document.createElement('optgroup');
            group.label = labels[i];
            f.appendChild(group);
            opts = addOptions(obj[ labels[i] ] );
            group.appendChild(opts);
        }
    }
    sel.appendChild(f);
}
//Anonymous function assigned to onchange event of controlling select list
document.getElementById('mapset').onchange = function(e) {
    // name of associated select list
    var relName = 'maps';
    
    // reference to associated select list 
    var relList = document.getElementById(relName);
    
    // get data from object literal based on selection in controlling select list (this.value)
    var obj = Select_List_Data[relName][document.getElementById('mapset').value];

    // remove current option elements
    removeAllOptions(relList, true);
    
    // call function to add optgroup/option elements
    // pass reference to associated select list and data for new options
    appendDataToSelect(relList, obj);
    clicks = 0;

};

// object literal holds data for optgroup/option elements
var Select_List_Data = {
    
    // name of associated select list
    'maps': {
        
        // names match option values in controlling select list
        Burke_x_Frontiera: {
            // optgroup label
            'Maps': {
                text: ['1A','1B','1D','2A','2A2','2B','2D','2D2','3A','3B',
                '3D','3D2','4A','4B','4D','4D2','4D3','5A','5B','5D','5D2',
                '5D3','5D4','6A','6A2','6A3','6B','6D','6D2','7A','7B','7D','7D2','7D3','7D4'],
                value: ['1A','1B','1D','2A','2A2','2B','2D','2D2','3A','3B',
                '3D','3D2','4A','4B','4D','4D2','4D3','5A','5B','5D','5D2',
                '5D3','5D4','6A','6A2','6A3','6B','6D','6D2','7A','7B','7D','7D2','7D3','7D4']
            },
        },
        Chara_x_Glenlea: {
          'Maps': {
                text: ['1A','1B','1D','1D2','2A','2A2','2B','2B2','2B3','2D','3A','3B',
                '3D','3D2','4A','4B','4D','4D2','5A','5B','5D','5D2',
                '6A','6B','6B2','6D','6D2','7A','7B','7D','7D2'],
                value: ['1A','1B','1D','1D2','2A','2A2','2B','2B2','2B3','2D','3A','3B',
                '3D','3D2','4A','4B','4D','4D2','5A','5B','5D','5D2',
                '6A','6B','6B2','6D','6D2','7A','7B','7D','7D2']
              }
        },
        Hlb_x_Crk: {
          'Maps': {
                text: ['1A','1B','1D','2A','2B','2D','3A','3B',
                '3D','4A','4B','4D','5A','5B','5D',
                '6A','6B','6D','6D2','7A','7B','7D2','7D3'],
                value: ['1A','1B','1D','2A','2B','2D','3A','3B',
                '3D','4A','4B','4D','5A','5B','5D',
                '6A','6B','6D','6D2','7A','7B','7D2','7D3']
              }
        },
        SunxAUS: {
          'Maps':{ 
                text: ['1A','1B','1D','2A','2B','2D','2D2','3A','3B','3B2',
                '3D','3D2','4A','4A2','4B','4D','4D2','5A','5B','5D','5D2',
                '6A','6B','6D','6D2','6D3','7A','7B','7D','7D2'],
                value: ['1A','1B','1D','2A','2B','2D','2D2','3A','3B','3B2',
                '3D','3D2','4A','4A2','4B','4D','4D2','5A','5B','5D','5D2',
                '6A','6B','6D','6D2','6D3','7A','7B','7D','7D2']
              }
        }
    }
    
};

// populate associated select list when page loads
window.onload = function() {
    // reference to controlling select list
    var sel = document.getElementById('mapset');
    sel.selectedIndex = 0;

    // name of associated select list
    var relName = 'maps';
    // reference to associated select list
    var rel = document.getElementById(relName);
   
    // get data for associated select list passing its name
    // and value of selected in controlling select list
    var data = Select_List_Data[relName][sel.value];

    // add options to associated select list
    appendDataToSelect(rel, data);
};

//getJson fetches map information as json associated with a particular mapset from sails
//Called in draw map feature
function getJson(mapSets,maps,clicks){

  var mapObj = [];
  for(i=0; i<clicks; i++) {
    var xmlHttp = new XMLHttpRequest();
    console.log(i);
    var url = serverURL + "mapsets?name=" + mapSets[i];
    console.log(url);
    xmlHttp.open("GET",url,false);
    xmlHttp.send();
    var mapsetJson = JSON.parse(xmlHttp.responseText);
    //alert("check " + mapsetJson.mapsets[0].name + " Finished check.");
    var mapsetId = mapsetJson.mapsets[0].id;

    xmlHttp = new XMLHttpRequest();
    var url = serverURL + "mapsets/" + mapsetId + "/maps?name=" + maps[i];
    xmlHttp.open("GET",url,false);
    xmlHttp.send();
    var mapJson = JSON.parse(xmlHttp.responseText);
    mapObj.push(mapJson.maps[0]);
  }
  return mapObj;
}

//getMarkers fetches marker information as json from sails
//Called in search marker feature
function getMarkers(marker,format){
  var url;
  var xmlHttp = new XMLHttpRequest();
  var markerJson;

  if(format == 1){
    url = serverURL + "markers?id=" + marker;
  } else {
    url = serverURL + "markers?name=" + marker;
  }
  xmlHttp.open("GET",url,false);
  xmlHttp.send();
  markerJson = JSON.parse(xmlHttp.responseText);
  if(markerJson.markers[0]){
    //alert("Marker: " + marker + " cannot be found.");
  //} else {
    return markerJson.markers[0];
  }
}

//getMarkerJson fetches marker location information associated with two or three chosen maps from sails
//Called in draw map feature
function getMarkerJson(maps){
    var markerObj = [];
    var markerJson;
    var xmlHttp = new XMLHttpRequest();
    var url;
    var synMarkers = [];

    if(maps.length == 2){
       url = serverURL + "markermaplocations?map=" + maps[0].id + "&map=" + maps[1].id;
       //console.log(url);
    } else if(maps.length ==3){
       url = serverURL + "markermaplocations?map=" + maps[0].id + "&map=" + maps[2].id;
       //console.log(url);
    }
    xmlHttp.open("GET",url,false);
    xmlHttp.send();
    markerJson = JSON.parse(xmlHttp.responseText);
    markerObj.push(markerJson.markermaplocations);
    //console.log(markerObj.length);

    var total = markerJson.meta.total;
    if(total > 100){ //Based on the url request, 100 per page
      var sum = 100;
      var count = 1;
      var tmpURL;
      while(total > sum){
        tmpURL = url + "&limit=100&skip=" + sum;
        count ++;
        sum = count*100;
        xmlHttp.open("GET",tmpURL,false);
        xmlHttp.send();
        markerJson = JSON.parse(xmlHttp.responseText);
        //Array of array, where each array contains 100 markermaplocation objects, 
        //which have marker location information from two selected maps.
        markerObj.push(markerJson.markermaplocations);
        //console.log(markerObj.length);

      }    
    }
    //console.log(markerObj);

    //Fetch marker id and location information.
    //for(i = 0; i<markerObj.length; i++){
    //  for(j=0;j<markerObj[i].length;j++){
    //    console.log(markerObj[i][j].marker,markerObj[i][j].location);
    //  }
    //}

    //console.log(markerObj[0][0].marker);

    var markerIDs = [];
    var markerLoca = [];
    var mapName = [];
    var stack =0;
    var coordMarker;
    //var mapName;

    for(i=0;i<markerObj.length;i++){
      for(j=0; j<markerObj[i].length;j++){
         if(markerIDs[markerObj[i][j].marker] == 1){
            stack++;
            markerIDs[markerObj[i][j].marker] = 2;
            //for(k=0;k<maps.length;k++){
            //  if(maps[k].id == markerObj[i][j].map){
            //     mapName = maps[k].name;
            //  }
            //}

           //console.log("LKOOOOO " + markerObj[i][j].marker + " " 
           //   + mapName[markerObj[i][j].marker] + " " 
           //   + markerLoca[markerObj[i][j].marker] + " " 
           //   +  markerObj[i][j].map + " " + markerObj[i][j].location);

           //markerObj[i][j].marker is the marker ID
            coordMarker = {["marker"]: markerObj[i][j].marker, [mapName[markerObj[i][j].marker]]: markerLoca[markerObj[i][j].marker], [markerObj[i][j].map]: markerObj[i][j].location};
            synMarkers.push(coordMarker);
         } else {
          markerIDs[markerObj[i][j].marker] = 1; 
          markerLoca[markerObj[i][j].marker] = markerObj[i][j].location;
          //console.log(maps.length);
          //for(k=0;k<maps.length;k++){
          //  if(maps[k].id == markerObj[i][j].map){
          //     console.log("66666666666666 " + maps[k].id);
          mapName[markerObj[i][j].marker] = markerObj[i][j].map;
          //  }
         // }
         }
      }
    }
    //console.log(stack);
    return synMarkers;
}

//drawAxis renders the axis of the first chosen map  
function drawAxis(){
  yScale = d3.scale.linear()
                   .domain([mapStart,mapStop])
                   .range([scaleStart,scaleStop]);
  yAxis = d3.svg.axis().scale(yScale).orient("left");
  svg.append("g")
     .attr("class","axis")
     .attr("transform","translate(" + position + "," + 0 + ")")
     .call(yAxis);
}

//highlightPath highlights the markers found during the search feature in the associated maps
//Called in search marker feature
function highlightPath(dataJson, targetMarkers){
  //console.log(sourceMarkers.length);
  //console.log(targetMarkers.length);
  var size = dataJson.length;
  var source = middle;
  var reference = width/10;
  var coordData;
  var coordData2;
  var lineData;
  d3.selectAll("path.line").remove();

  if(size == 2){
    //alert("22222");
    //d3.select("#testaaa").remove();
   // $('#testaaa').remove();
   //d3.selectAll("path.line").remove();
    //alert("F 22222");
    for(i= 0; i < doubleCoordMarker.length; i++){
     // console.log(doubleCoordMarker[i]['marker']);
      for(j=0; j< targetMarkers.length;j++){
        var markerID = targetMarkers[j].id;
        var markerName = targetMarkers[j].name;
        //console.log("TTTTTTTTTTTTTT " + " - " + markerID + " - " + markerName);
        if(markerID == doubleCoordMarker[i]['marker']){
          var hName = markerID + "-" + markerName;
          //console.log("Zoom Map " + start + " " + stop);
            console.log("Highlight: " + yScaleM(doubleCoordMarker[i][dataJson[0].id]) + " " + doubleYScale(doubleCoordMarker[i][dataJson[1].id]));
          coordData = {"x": source, "y": yScaleM(doubleCoordMarker[i][dataJson[0].id]), "name": hName};
          coordData2 = {"x": reference,"y": doubleYScale(doubleCoordMarker[i][dataJson[1].id]),"name": hName};
          lineData = [coordData,coordData2];
          
          var lineFunction = d3.svg.line()
                  .x(function(d) { return d.x; })
                  .y(function(d) { return d.y; })
                  .interpolate("linear");
          var lineGraph = svg.append("path")
                    .attr("d", lineFunction(lineData))
                    .datum(lineData)
                    .attr("class","line") //use line instead of axis here to make the remove function work
                    .style("stroke", "red")
                    .style("stroke-width", 3)
                    .style("stroke-opacity", 0.2)
                    .style("fill", "none");
          lineGraph.on("mouseover",handleHighlightMouseOver)
                   .on("mouseout",handleHighlightMouseOut);    

        }

      }
    }
  } else {
    //alert("33333");
   // d3.select("#testaaa").remove();
   //d3.selectAll("path.line").remove();
    //alert("F 33333");
    for(i= 0; i < doubleCoordMarker.length; i++){
      //console.log(doubleCoordMarker[i]['marker']);
      for(j=0; j< targetMarkers.length;j++){
        var markerID = targetMarkers[j].id;
        var markerName = targetMarkers[j].name;
        if(markerID == doubleCoordMarker[i]['marker']){
          var hName = markerID + "-" + markerName;
          coordData = {"x": source, "y": yScaleM(doubleCoordMarker[i][dataJson[0].id]), "name": hName};
          coordData2 = {"x": reference,"y": doubleYScale(doubleCoordMarker[i][dataJson[1].id]),"name": hName};
          lineData = [coordData,coordData2];
          
          var lineFunction = d3.svg.line()
                  .x(function(d) { return d.x; })
                  .y(function(d) { return d.y; })
                  .interpolate("linear");
          var lineGraph = svg.append("path")
                    .attr("d", lineFunction(lineData))
                    .datum(lineData)
                    .attr("class","line")
                    .style("stroke", "red")
                    .style("stroke-width", 3)
                    .style("stroke-opacity", 0.2)
                    .style("fill", "none");
          lineGraph.on("mouseover",handleHighlightMouseOver)
                   .on("mouseout",handleHighlightMouseOut);    
        }

      }
    }
    for(i= 0; i < tripleCoordMarker.length; i++){
     // console.log(tripleCoordMarker[i]['marker']);
      for(j=0; j< targetMarkers.length;j++){
        var markerID = targetMarkers[j].id;
        var markerName = targetMarkers[j].name;
        if(markerID == tripleCoordMarker[i]['marker']){
          var hName = markerID + "-" + markerName;
          coordData = {"x": source, "y": yScaleM(tripleCoordMarker[i][dataJson[0].id]),"name":hName};
          coordData2 = {"x": width*9/10,"y": tripleYScale(tripleCoordMarker[i][dataJson[2].id]),"name": hName};
          lineData = [coordData,coordData2];
          
          var lineFunction = d3.svg.line()
                  .x(function(d) { return d.x; })
                  .y(function(d) { return d.y; })
                  .interpolate("linear");
          var lineGraph = svg.append("path")
                    .attr("d", lineFunction(lineData))
                    .datum(lineData)
                    .attr("class","line")
                    .style("stroke", "red")
                    .style("stroke-width", 3)
                    .style("stroke-opacity", 0.2)
                    .style("fill", "none");
          lineGraph.on("mouseover",handleHighlightMouseOver)
                   .on("mouseout",handleHighlightMouseOut);    
        }
      }
    }

  }
}

//drawPath renders the path between axis(maps)
function drawPath(fId, sId, source,reference,Marker){
  for(i= 0; i < Marker.length; i++){
    var fName = fId + "-" + Marker[i]['marker'];  
    var sName = sId + "-" + Marker[i]['marker'];
     //source is the middle x location
     //reference is the left or right x location
    var coordData = {"x": source, "y": yScaleM(Marker[i][fId]), "name":fName,"value": Marker[i][fId]};
   // console.log(Marker[i]['marker']);
    var coordData2 = {"x": reference,"y": yScale(Marker[i][sId]),"name":sName,"value": Marker[i][sId]};
    //coordData = JSON.parse(coordData);
    //lineData.push(coordData);
    //lineData.push(coordData2);  
    //console.log("TTTTTTTTTTT " + coordData.y);
   // lineData.push(coordData);
    // lineData.push(coordData2);

    lineData = [coordData,coordData2];

    //console.log(lineData);
    var lineFunction = d3.svg.line()
                  .x(function(d) { return d.x; })
                  .y(function(d) { return d.y; })
                  .interpolate("linear");

    var lineGraph = svg.append("path")
                   // .attr("id","testaaa")
                    .datum(lineData)
                    .attr("d", lineFunction(lineData))
                    .attr("class","axis")
                    .style("stroke", "blue")
                    .style("stroke-width", 1)
                    .style("stroke-opacity", 0.2)
                    .style("fill", "none");
                    //.on("mouseover",;
    //d3.selectAll("path")
   //     .on("mouseover", findValue)
   //     .on("mouseout",function(){return tooltip.style("visibility","hidden")});
     //lineGraph.on("mouseover",findValue)
      //        .on("mouseout",disValue);
   
   /*
    lineGraph.on("mouseover",function(d){
                    d3.select(this)
                    .style("stroke-width", 4)
                    .style("stroke-opacity", 1)
                    .style("stroke", "red");
                   // div.transition()        
                    //    .duration(200)      
                   //     .style("opacity", .9);  
                   // div .html(coordMarker[i][firstId] + " " + coordMarker[i][secId]);               
                })
               .on("mouseout",function(d) { 
                   d3.select(this)
                   .style("stroke-width", 1)
                   .style("stroke-opacity", 0.2)
                   .style("stroke","blue");
                   //div.transition()        
                   //   .duration(500)      
                   //   .style("opacity", 0); 
               });  
*/
  //console.log(coordMarker[0][firstId] + " 7777777777777777777");
  //var lineData = []    
    lineGraph.on("mouseover",handleMouseOver)
             .on("mouseout",handleMouseOut);    
    //console.log(lineGraph);
    //console.log(lineData[0].name + " " + lineData[0].x + " " + lineData[0].y);                  
  }
}


//drawZoomPath renders the path between axis (maps) when users zoom into a particular region of the reference map
//Called in the zoom in/out feature
function drawZoomPath(fId, sId, start, stop, source, reference, Marker){

  for(i= 0; i < Marker.length; i++){

    if(Marker[i][fId]<=stop && Marker[i][fId]>=start){
      var fName = fId + "-" + Marker[i]['marker'];  
      var sName = sId + "-" + Marker[i]['marker'];
      //source is the middle x location
      //reference is the left or right x location
      var coordData = {"x": source, "y": yScaleM(Marker[i][fId]), "name":fName,"value": Marker[i][fId]};
      // console.log(Marker[i]['marker']);
      var coordData2 = {"x": reference,"y": yScale(Marker[i][sId]),"name":sName,"value": Marker[i][sId]};
      //var coordData = {"x": source, "y": yScaleM(Marker[i][fId])};
      //var coordData2 = {"x": reference,"y": yScale(Marker[i][sId])};
      //coordData = JSON.parse(coordData);
      //lineData.push(coordData);
      //lineData.push(coordData2);  
      var lineData = [coordData,coordData2];
      var lineFunction = d3.svg.line()
                    .x(function(d) { return d.x; })
                    .y(function(d) { return d.y; })
                    .interpolate("linear");
      var lineGraph = svg.append("path")
                   //   .attr("id","testaaa")
                      .datum(lineData)
                      .attr("d", lineFunction(lineData))
                      .attr("class","axis")
                      .style("stroke", "blue")
                      .style("stroke-width", 1)
                      .style("stroke-opacity", 0.2)
                      .style("fill", "none");
      lineGraph.on("mouseover",handleMouseOver)
               .on("mouseout",handleMouseOut); 
    }
  }
}

//drawMap manages to add maps and create associated links/lines/pathes between maps in the main svg area
//Called in the draw map feature
function drawMap(){
   var x = document.getElementById("maps").value;
   var y = document.getElementById("mapset").value;
   var z = x + " " + y;
   if(maps.length >= 3) {
      alert("No more than three maps");
   } else {
      clicks += 1;
      if(old_map == null || old_mapset == null){
        old_map = x;
        old_mapset = y;
        maps.push(x);
        mapsets.push(y);
        dataJson = getJson(mapsets,maps,maps.length); //The first click
        //Draw the first chosen map.
        document.getElementById('drawMap').value = "Add";

        svg = d3.select("#example").append("svg")
        .attr("width", width)
        .attr("height", height)
        .call(zoom)
        .append("g");   

        mapStart = 0;
        mapStop = dataJson[0].stop;
        scaleStart = height-padding.top-padding.bottom;
        scaleStop = 0;
        position = width/2;

        defaultStart = Math.round(mapStop/2);
        defaultFlanking = Math.round(defaultStart/4);

        document.getElementById('zoomIn').innerHTML = "Zoom in to a particular region: &nbsp; <input id='region' type='number' min='0' max=" + mapStop + " value=" + defaultStart + "></input> &plusmn;  <input id='flanking' type='number' min='0' max=" + defaultStart + " value=" + defaultFlanking + "></input></td><td>&nbsp; <input type='button' id='zoom' value='Zoom' class='btn btn-primary' onclick='zoomMap()'></input>&nbsp;<input type='button' id='resetZoom' value='Reset' class='btn btn-danger' onclick='resetZoom()'></input>";
       
        document.getElementById('searchMarkers').innerHTML = 
        "<a href=javascript:hideshow(document.getElementById(\'adiv\'))>Search for markers</a><br /><br /><div id='adiv' style='display: none;' class='container'><table><tr><td><textarea rows='7' cols='10' id='markerBox'>IWB2, IWB3, IWB4, IWB5, IWB6</textarea></td><td>&nbsp;&nbsp;<input type='button' id='search' value='Search' class='btn btn-primary' onclick='searchForMarkers()'></input></td></tr></table></div>";
        yScaleM = d3.scale.linear()
                   .domain([mapStart,mapStop])
                   .range([scaleStart,scaleStop]);
        drawAxis();
        svg.append("text")
            .attr("y", height)
            .attr("x",position)
            .style("text-anchor", "middle")
            .style("font-size","12px")
            .style("fill","red")
            .text(z);

        delete dataJson[0].mapset;
        delete dataJson[0].links;
        delete dataJson[0].maporder;
        d3.select("#grid")
        .datum(dataJson)
        .call(grid)
        .selectAll(".row")
         .on({
           "click":function(d){
              var url = "http://dav127.it.csiro.au:1337/markers?name=";
              url += d.name;
              window.location = url;
            },
        });
      } else {
        if(old_map != x || old_mapset != y){
          //alert(x + " " + old_map + " " + y + " " + old_mapset);
          //Add new maps;
          maps.push(x);
          mapsets.push(y);
          old_map = x;
          old_mapset = y;
          dataJson = getJson(mapsets,maps,maps.length);

          var num;

          if(maps.length==2){
            num = 1;
            position = width/10;
            mapStop = dataJson[num].stop;

            coordMarker = getMarkerJson(dataJson);
            doubleCoordMarker = coordMarker;
            //console.log(coordMarker);
            var firstId = dataJson[0].id;
            var secId = dataJson[1].id; //Hard coded here first.
            
            drawAxis();
            svg.append("text")
                .attr("y", height)
                .attr("x",position)
                .style("text-anchor", "middle")
                .style("font-size","12px")
                .style("fill","red")
                .text(z);
            doubleYScale = yScale;
            drawPath(firstId, secId, middle, position, coordMarker);
          } else if(maps.length==3) { // max 3 maps only
            num = 2;
            position = width*9/10;
            mapStop = dataJson[num].stop;

            coordMarker = getMarkerJson(dataJson);
            tripleCoordMarker = coordMarker;
            //console.log(coordMarker);
            var firstId = dataJson[0].id;
            var secId = dataJson[2].id; //Hard coded here first.

            drawAxis();
            svg.append("text")
                .attr("y", height)
                .attr("x",position)
                .style("text-anchor", "middle")
                .style("font-size","12px")
                .style("fill","red")
                .text(z);
            tripleYScale = yScale;
            drawPath(firstId, secId, middle, position, coordMarker);
            
            //console.log(coordMarker[0][firstId] + " 7777777777777777777");   
            d3.select("#grid")
            .datum(dataJson)
            .call(grid)
            .selectAll(".row")
             .on({
               "click":function(d){
                  var url = "http://dav127.it.csiro.au:1337/markers?name=";
                  url += d.name;
                  window.location = url;
                },
                //"mouseover": function(d) { parcoords.highlight([d]) },
                //"mouseout": parcoords.unhighlight
            });

             //Test where to disable the drag (pan) behavior from zoom. 
             //Worked well. The idea is when we want to enable brush, the zoom function should be disabled
             //zoom.on("zoom",null);
             //zoom.on("zoom",zoomed);
             
          }
        } else if(old_map == x && old_mapset == y){
          clicks -= 1;
          alert("You cannot add the same map again.");
        }
      }
    }
}

//resetMap removes all the current maps and corresponding data displayed in the web page 
//Called in the reset feature
function resetMap(){
  clicks = 0;
  old_map = undefined;
  old_mapset = undefined;
  maps = [];
  mapsets = [];
  document.getElementById('drawMap').value = "Draw";
  document.getElementById('zoomIn').innerHTML = "";
  xAxis = undefined;
  yAxis = undefined;
  xScale = undefined;
  yScale = undefined;
  yScaleM = undefined;
  svg.selectAll("*").remove();
  d3.select("svg").remove();
  //zoom.on("zoom",zoomed);
 //d3.select("#grid").remove();
 document.getElementById('grid').innerHTML = "";
 document.getElementById('searchMarkers').innerHTML = "";
}

//resetZoom resets the zoomed maps to their default lookings
//Called in the reset zoom feature
function resetZoom(){

  svg.selectAll("*").remove();
  d3.select("svg").remove();
  svg = d3.select("#example").append("svg")
      .attr("width", width)
      .attr("height", height)
      .call(zoom)
      .append("g");   

  mapStart = 0;
  mapStop = dataJson[0].stop;
  scaleStart = height-padding.top-padding.bottom;
  scaleStop = 0;
  position = width/2;

  document.getElementById('zoomIn').innerHTML = "Zoom in to a particular region: &nbsp; <input id='region' type='number' min='0' max=" + mapStop + " value=" + defaultStart + "></input> &plusmn;  <input id='flanking' type='number' min='0' max=" + defaultStart + " value=" + defaultFlanking + "></input></td><td>&nbsp; <input type='button' id='zoom' value='Zoom' class='btn btn-primary' onclick='zoomMap()'></input>&nbsp;<input type='button' id='resetZoom' value='Reset' class='btn btn-danger' onclick='resetZoom()'></input>";
  //document.getElementById('showHideMarkers').innerHTML = "<div id='showHideMarkers' class='container' style='display:none'><input type='checkbox' id='showH'>&nbsp; Show Markers</input></div>";
  document.getElementById('showHideMarkers').style.display="none";
  yScaleM = d3.scale.linear()
             .domain([mapStart,mapStop])
             .range([scaleStart,scaleStop]);
  drawAxis();
  var z = maps[0] + " " + mapsets[0];
  svg.append("text")
                .attr("y", height)
                .attr("x",position)
                .style("text-anchor", "middle")
                .style("font-size","12px")
                .style("fill","red")
                .text(z);
  if(maps.length>=2){
    num = 1;
    position = width/10;
    //coordMarker = getMarkerJson(dataJson);
    //console.log(coordMarker)
    mapStop = dataJson[num].stop;
    
    var firstId = dataJson[0].id;
    var secId = dataJson[1].id; //Hard coded here first.
    var middle = width/2;
    z = maps[1] + " " + mapsets[1];
    drawAxis();
    svg.append("text")
                .attr("y", height)
                .attr("x",position)
                .style("text-anchor", "middle")
                .style("font-size","12px")
                .style("fill","red")
                .text(z);
    drawPath(firstId, secId, middle, position, doubleCoordMarker);

    if(maps.length==3) { // max 3 maps only
      num = 2;
      var thirdId = dataJson[2].id; //Hard coded here first.
      z = maps[2] + " " + mapsets[2];
      position = width*9/10;
      mapStop = dataJson[num].stop;
      //console.log(locStart + " " + locStop);

      drawAxis();
      svg.append("text")
                .attr("y", height)
                .attr("x", position)
                .style("text-anchor", "middle")
                .style("font-size","12px")
                .style("fill","red")
                .text(z);
      drawPath(firstId, thirdId, middle,position, tripleCoordMarker); 
    }                         
  }

}

function zoomMap(){
  // console.log("ALALA " + maps);
 // if(maps.length == 1){
  //   alert("Please choose a map first.");
    //forcus on the central map.
  var centre = Number(document.getElementById("region").value);
  var flanking = Number(document.getElementById("flanking").value);

  var start = centre-flanking;
  var stop = centre+flanking;
  mapStart = start;
  mapStop = stop;
  scaleStart = height - padding.top - padding.bottom;
  scaleStop = 10;
 
  //console.log("Zoom Map " + start + " " + stop);
  svg.selectAll("*").remove();
  d3.select("svg").remove();

  svg = d3.select("#example").append("svg")
      .attr("width", width)
      .attr("height", height)
      .call(zoom)
      .append("g");   
  //console.log(dataJson);
  //console.log("First Draw " + dataJson[0].stop);
  yScaleM = d3.scale.linear()
             .domain([start,stop])
             .range([height- padding.top - padding.bottom, 10]);
  position = middle;

  var z = maps[0] + " " + mapsets[0];
  drawAxis();
  svg.append("text")
      .attr("y", height)
      .attr("x",position)
      .style("text-anchor", "middle")
      .style("font-size","12px")
      .style("fill","red")
      .text(z);
 //document.getElementById('showMarkers').innerHTML = "<input type='checkbox' id='showH'>&nbsp; Show Markers</input>";
   document.getElementById('showHideMarkers').style.display="block";
  if(maps.length>=2){
    num = 1;
    position = width/10;
    //coordMarker = getMarkerJson(dataJson);
    //console.log(coordMarker);

    var firstId = dataJson[0].id;
    var secId = dataJson[1].id; //Hard coded here first.

    var locStart = Number.MAX_SAFE_INTEGER; // 9007199254740991
    var locStop = 0;
    
    //console.log(coordMarker[0][firstId] + " 7777777777777777777");
    for(i= 0; i < doubleCoordMarker.length; i++){
      if(doubleCoordMarker[i][firstId]<=stop && doubleCoordMarker[i][firstId]>=start){
          if(locStart>doubleCoordMarker[i][secId]){
            locStart = doubleCoordMarker[i][secId];
          }
          if(locStop < doubleCoordMarker[i][secId]){
            locStop = doubleCoordMarker[i][secId];
          }
      }
    }
    if(locStart <= 0.05){
      mapStart = locStart;
    } else {
      mapStart = locStart - 0.05;
    }
    mapStop = locStop+0.05;
    scaleStart = height- padding.top - padding.bottom;
    scaleStop =  10;
    //console.log(locStart + " " + locStop);
    
    z = maps[1]　+ " " + mapsets[1];
    drawAxis();
    svg.append("text")
        .attr("y", height)
        .attr("x",position)
        .style("text-anchor", "middle")
        .style("font-size","12px")
        .style("fill","red")
        .text(z);
    drawZoomPath(firstId, secId, start,stop,middle,position, doubleCoordMarker);
           
    if(maps.length==3) { // max 3 maps only
    
      var thirdId = dataJson[2].id; //Hard coded here first.
      z = maps[2] + " " + mapsets[2];
      position = width*9/10;

      locStart = Number.MAX_SAFE_INTEGER; // 9007199254740991
      console.log(locStart);
      locStop = 0;
    
      //console.log(coordMarker[0][firstId] + " 7777777777777777777");
      for(i= 0; i < tripleCoordMarker.length; i++){
        if(tripleCoordMarker[i][firstId]<=stop && tripleCoordMarker[i][firstId]>=start){
            if(locStart>tripleCoordMarker[i][thirdId]){
              locStart = tripleCoordMarker[i][thirdId];
            }
            if(locStop < tripleCoordMarker[i][thirdId]){
              locStop = tripleCoordMarker[i][thirdId];
            }
        }
      }
      //console.log(locStart + " " + locStop);
      if(locStart <= 0.05){
        mapStart = locStart;
      } else {
        mapStart = locStart - 0.05;
      }
      mapStop = locStop+0.05;
      scaleStart = height- padding.top - padding.bottom;
      scaleStop =  10;
      //console.log(locStart + " " + locStop);

      drawAxis();
      svg.append("text")
        .attr("y", height)
        .attr("x",position)
        .style("text-anchor", "middle")
        .style("font-size","12px")
        .style("fill","red")
        .text(z);
      drawZoomPath(firstId, thirdId, start,stop,middle,position, tripleCoordMarker); 
    }                         
  }

 //}
}

document.getElementById('showH').onclick = function(){
  if(this.checked){
    console.log("Good move");
  }
}

function isNormalInteger(str) {
  return /^\+?(0|[1-9]\d*)$/.test(str);
}

function checkFormats(marker){
  if(isNormalInteger(marker)){
    return 1;
  } else {
    return 0;
  }
}

function searchForMarkers(){
  var inputs = document.getElementById("markerBox").value;
  returnedMarkers = [];
  inputs = inputs.replace(/\s+/g, '');
  //alert(inputs);
  var markers = inputs.split(",");
  var checkedMarkers = [];
  for(i=0;i<markers.length;i++){
    if(markers[i] != ''){
      checkedMarkers.push(markers[i]);
      var format = checkFormats(markers[i]);
      var hMarker = getMarkers(markers[i],format);
      if(hMarker){
        //A marker json object 
        //console.log(hMarker);
        returnedMarkers.push(hMarker);
      }
    }
  }
  //console.log(returnedMarkers.length);
  
  if(doubleCoordMarker){ //Two or three maps
    if(tripleCoordMarker){ //Three maps
      //console.log(dataJson[0].id + " " + dataJson[1].id + " " + dataJson[2].id);
      highlightPath(dataJson,returnedMarkers,tripleCoordMarker);
      //for(doubleCoordMarker)
    } else {//Only Two maps
      //console.log(dataJson[0].id + " " + dataJson[1].id);
      highlightPath(dataJson,returnedMarkers,doubleCoordMarker);
    }
  } else {
    alert("Please add comparative map.");
  }
}

//enableBrush is a trigger function by clicking the brush button.
//enable or disable the brush function.
function enableBrush(){
  var brushValue = document.getElementById('brush').value;
  if(brushValue == 'Enable Brush'){
    alert("Brush function has been enabled. The drag&zoom function will be disabled.");
    document.getElementById('brush').value = "Disable Brush";
    document.getElementById('brush').style.backgroundColor="gray";
    document.getElementById('brush').style.borderColor="gray";
    //var brush = d3.svg.brush()
    //.on("brush",brushed);
    //Worked well. The idea is when we want to enable brush, the zoom function should be disabled
    if(document.getElementById('drawMap').value == 'Add'){
      resetZoom();
    } 
    zoom.on("zoom",null);
    //Brush Enabled.
    brushed = 1;
    
  } else {
    alert("Brush function has been disabled. The drag&zoom funciton will be enabled.");
    document.getElementById('brush').value = "Enable Brush";
    document.getElementById('brush').style.backgroundColor="green";
    document.getElementById('brush').style.borderColor="green";
    //var brush = d3.svg.brush()
    //.on("brush",brushed);
    //Worked well. The idea is when we want to enable brush, the zoom function should be disabled
    zoom.on("zoom",zoomed);
    brushed = 0;
  }
}


//brushMap is designed to facilitate the search marker process. 
//User can brush a particular region from the target (middle) map
// A list of markers will be chosen and it associated information will be displayed in a table.
function brushMap(){
  
}



//handleMouseover is a d3 event that displays map id and marker id when mouse over to a line/path
function handleHighlightMouseOver(d,i) {  // Add interactivity
  //console.log(lineData[0].name + " " + lineData[0].x + " " + lineData[0].y);
  d3.select(this)
    .style("stroke", "red")
    .style("stroke-width", 10)
    .style("stroke-opacity", 0.5)
    .style("fill", "none");    
  // Specify where to put label of text
  svg.append("text").attr({
     id: "t" + d[0].name + "-" + d[1].name,  // Create an id for text so we can select it later for removing on mouseout
      x: function() { return d[0].x; },
      y: function() { return d[0].y; }
  })
  .text(function() {
    return d[0].name;  // Value of the text
  });
 //console.log(d[0]+ " " + d[1]);
}

//handleMouseOut is a d3 event that removes the display created by handleMouseover event
function handleHighlightMouseOut(d, i) {
  d3.select(this)
    .style("stroke", "red")
    .style("stroke-width", 10)
    .style("stroke-opacity", 0.5)
    .style("fill", "none");
  // Select text by id and then remove
  d3.select("#t" + d[0].name + "-" + d[1].name).remove();  // Remove text location
}

//handleMouseover is a d3 event that display map id and marker id when mouse over to a line/path
function handleMouseOver(d,i) {  // Add interactivity
  //console.log(lineData[0].name + " " + lineData[0].x + " " + lineData[0].y);
  d3.select(this)
    .style("stroke-width", 4)
    .style("stroke-opacity", 1)
    .style("stroke", "red");        
  // Specify where to put label of text
  svg.append("text").attr({
     id: "t" + d[0].name + "-" + d[1].name,  // Create an id for text so we can select it later for removing on mouseout
      x: function() { return d[1].x; },
      y: function() { return d[1].y; }
  })
  .text(function() {
    return d[0].name;  // Value of the text
  });
 //console.log(d[0]+ " " + d[1]);
}

//handleMouseOut is a d3 event that removes the display created by handleMouseover event
function handleMouseOut(d, i) {
  d3.select(this)
   .style("stroke-width", 1)
   .style("stroke-opacity", 0.2)
   .style("stroke","blue");
  // Select text by id and then remove
  d3.select("#t" + d[0].name + "-" + d[1].name).remove();  // Remove text location
}