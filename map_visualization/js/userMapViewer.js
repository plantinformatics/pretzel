var serverURL = "http://dav127.it.csiro.au:1776/api/v1/";
var serverRoot = "http://dav127.it.csiro.au:1776";
var customMap = [];//Store user uploaded map information
var clicks = 0;
var old_map;
var old_mapset;
var maps = [];
var mapsets = [];
var svg;
var grid = d3.divgrid();
var width = 750;
var height = 600;

var xAxis;
var yAxis;
var xScale;
var yScale;
var yScaleM;
var padding = {left:30, right:30, top:20, bottom:20};
var doubleCoordMarker;
var tripleCoordMarker;
var maxLocation;
var doubleMaxLocation;
var tripleMaxLocation;
var mapStart;
var mapStop;
var scaleStart;
var scaleStop;
var position;
var left;
var right;

var customMapStart;
var customMapStop;
var defaultStart;
var defaultFlanking;

var middle = width/2;

var dataJson;
var margin = {top: -5, right: -5, bottom: -5, left: -5};

var zoom = d3.behavior.zoom()
    .scaleExtent([1, 10])
    .on("zoom", zoomed);

function zoomed() {
  container.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
}

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
function upload() {
  if(document.getElementById('uploadMap').value === "Completed!"){
    alert("Please refresh page if you want to upload a different file.");
  } else {

    var finput = document.getElementById("files");
    var editor = document.getElementById("list");

    var f = finput.files[0];
    var content;
    if (f) {
      var r = new FileReader();
      //console.log(e.target.result);
      r.onload = function(e) { 
        content = e.target.result;
        //2-D array, first is a json format meta information of the uploaded map, the size of the map.
        //the second is array include actual marker information and the locations in the uploaded map.
       
       //Add a spinner here?
       //Collect all the markers' location information from the database given the uploaded marker ids
       //In here we first ignore the possibility that a marker could have information across more than 100 maps.
        customMap = processData(content);
        customMapStop = customMap[0].maps[0].stop;
        defaultStart = Math.round(customMapStop/2);
        defaultFlanking = Math.round(defaultStart/4);
        //console.log("BBBBBBBBBBBBBBBBBBBBBB " + customMap[2][54411].markermaplocations[0].marker);
        document.getElementById('zoomIn').innerHTML = "Zoom in to a particular region: &nbsp; <input id='region' type='number' min='0' max=" + customMapStop + " value=" + defaultStart + "></input> &plusmn;  <input id='flanking' type='number' min='0' max=" + defaultStart + " value=" + defaultFlanking + "></input></td><td>&nbsp; <input type='button' id='zoom' value='Zoom' class='btn btn-primary' onclick='zoomMap()'></input>&nbsp;<input type='button' id='resetZoom' value='Reset' class='btn btn-danger' onclick='resetZoom()'></input>";

       //Stop here.

        svg = d3.select("#example").append("svg")
              .attr("width", width)
              .attr("height", height)
              .append("g");
             // .attr("transform", "translate(" + margin.left + "," + margin.right + ")");
              //.call(zoom);   
             
        //console.log("First Draw " + dataJson[0].stop);

        mapStart = 0;
        mapStop = customMap[0].maps[0].stop;
        scaleStart = height- padding.top - padding.bottom;
        scaleStop = 0;
        position = middle;

        yScaleM = d3.scale.linear()
                     .domain([0,customMap[0].maps[0].stop])
                     .range([height- padding.top - padding.bottom, 0]);
        drawAxis();

           
        //editor.innerHTML = htmlContent;
       // content = editor.innerHTML;
       // console.log(content);
      }
      r.readAsText(f);
      document.getElementById('uploadMap').value = "Completed!";
     
    } else { alert("Failed to load file.");}
    //console.log("CONONONO " + content);
  }
   
}
function processData(allText) {
  var allTextLines = allText.split(/\r\n|\n/);
  var headers = allTextLines[0].split(',');
  var lines = [];
  var max = 0;
  var size = headers.length;
  var customData = [];
  var markerJson = [];
  //console.log(headers);
  var customMapJson = {
                          "maps": [
                            {
                              "mapset": "Custom",
                              "id": "Custom",
                              "name": "Upload",
                              "start": 0,
                              "stop": 0,
                            }
                          ]
                      };
                 
  for (var i=0; i<allTextLines.length; i++) {
      var data = allTextLines[i].split(',');
      //console.log(data);
      if (data.length == size) {
          var tarr = [];
          for (var j=0; j<headers.length; j++) {
              tarr.push(Number(data[j]));
          }
          lines.push(tarr);
          //Get the map size.
          if(Number(max) < Number(data[size-1])) {
            max = data[size-1];
            //console.log(max);
            //console.log(data[size-1]);
          }
          //Get the marker information based on the index/name/some other id from database and store in an array.
          if(data[0] != 'id'){
            //Only one marker
           //markerJson.markers[0].links.markermaplocations : api/v1/markers/1/markermaplocations
            markerJson.push(getMarkers(data[0])); 
          }

      }
  }
 // dataArray = (lines + "").split(';');

  //alert(lines[0]); 
  customMapJson.maps[0].stop = Number(max);
  //console.log(customMapJson);      
  customData.push(customMapJson); //Map meta info
  customData.push(lines); //Original file in csv format
  customData.push(markerJson); //Matched Marker information from the database;
  return customData;
}

function getMarkers(markerID){ //Get the markermaplocation info for each marker
  var xmlHttp = new XMLHttpRequest();
  var url = serverURL + "markermaplocations?marker=" + markerID; //Could be id=, idx=, or name=
  //console.log(url);
  xmlHttp.open("GET",url,false);
  xmlHttp.send();
  var mJson = JSON.parse(xmlHttp.responseText);
  //alert("check " + markerJson.markers[0].name + " Finished check.");
  //var mapsetId = mapsetJson.mapsets[0].id;

  //xmlHttp = new XMLHttpRequest();
  //var url = serverURL + "mapsets/" + mapsetId + "/maps?name=" + maps[i];
  //xmlHttp.open("GET",url,false);
  //xmlHttp.send();
  //var mapJson = JSON.parse(xmlHttp.responseText);
  //mapObj.push(mapJson.maps[0]);
  return mJson;
}

function format(c) { document.execCommand(c, false, false); }

/*
From JavaScript and Forms Tutorial at dyn-web.com
Find information and updates at http://www.dyn-web.com/tutorials/forms/
*/

// removes all option elements in select list 
// removeGrp (optional) boolean to remove optgroups

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
            opts = addOptions(obj[labels[i]]);
            group.appendChild(opts);
        }
    }
    sel.appendChild(f);
}
// anonymous function assigned to onchange event of controlling select list
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
    alert("check " + mapsetJson.mapsets[0].name + " Finished check.");
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

function getMarkerJson(maps,customLoc){
    var synMarkers = [];
    var coordMarker;
    var mapID;
    maxLocation = 0;
    if(maps.length == 1) {
      mapID = maps[0].id;
    } else if(maps.length ==2){
      mapID = maps[1].id;
    }
    // customMap[2][54411].markermaplocations[0].marker);
    for(i=0;i<customLoc[2].length;i++){
      //customLoc stores user map meta info, csv data and corresponding map locations from the central database given the provided marker ID.
      for(j=0;j<customLoc[2][i].markermaplocations.length;j++){
        if(customLoc[2][i].markermaplocations[j].map == mapID){
            var line = customLoc[1][i];
          //console.log("aaaaaaaa" + customLoc[2][i].markermaplocations[j].marker + " " + line[1] + " " + mapID + " " + customLoc[2][i].markermaplocations[j].location)
            coordMarker = {["marker"]: customLoc[2][i].markermaplocations[j].marker, ["customMap"]:line[1], [mapID]: customLoc[2][i].markermaplocations[j].location};
            synMarkers.push(coordMarker);

           //Get the max location
            if(maxLocation < customLoc[2][i].markermaplocations[j].location){
              maxLocation = customLoc[2][i].markermaplocations[j].location;
            }
        }
      }
    }
    return synMarkers;
}
function drawPath(fId, sId, source,reference,Marker){
  for(i= 0; i < Marker.length; i++){
    var coordData = {"x": source, "y": yScaleM(Marker[i][fId]), "name":"Map","value": Marker[i][fId]};
    var coordData2 = {"x": reference,"y": yScale(Marker[i][sId]),"name":"Map2","value": Marker[i][sId]};
    //coordData = JSON.parse(coordData);
    //lineData.push(coordData);
    //lineData.push(coordData2);  
    //console.log("TTTTTTTTTTT " + coordData.y);
   // lineData.push(coordData);
    // lineData.push(coordData2);
    
    var lineData = [coordData,coordData2];
   //} 
   //console.log(lineData);
    var lineFunction = d3.svg.line()
                  .x(function(d) { return d.x; })
                  .y(function(d) { return d.y; })
                  .interpolate("linear");

    var lineGraph = svg.append("path")
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
  //console.log(coordMarker[0][firstId] + " 7777777777777777777");
  //var lineData = []                           
  }
}

function drawMap(){
  var x = document.getElementById("maps").value;
  var y = document.getElementById("mapset").value;
  
  var z = x + " " + y;
  if(document.getElementById('uploadMap').value === "Upload"){
    alert("Please upload your map data first.");
  } else {
     console.log(x + " " + y + " " + old_map + " " + old_mapset);
     if(maps.length >= 2) {
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

          var coordMarker = getMarkerJson(dataJson,customMap);
          doubleCoordMarker = coordMarker;

          mapStart = 0;
          mapStop = maxLocation;
          doubleMaxLocation = maxLocation;
          position = width/10;
          
          drawAxis();
          svg.append("text")
            //.attr("transform", "translate(" + width/10 + "," + (height - padding.bottom) +")")
            .attr("y", height)
            .attr("x",width/10)
            //.attr("dy", "1em")
            .style("text-anchor", "middle")
            .style("font-size","12px")
            .style("fill","red")
            .text(z);
          //console.log(coordMarker[0]["customMap"]);

          var firstId = "customMap";
          var secId = dataJson[0].id; //the first chosne map id
          drawPath(firstId, secId, middle, position, coordMarker);
        } else {
          if(old_map != x || old_mapset != y){
            //alert(x + " " + old_map + " " + y + " " + old_mapset);
            //Add new maps;
            maps.push(x);
            mapsets.push(y);
            old_map = x;
            old_mapset = y;
            dataJson = getJson(mapsets,maps,maps.length);

            if(maps.length==2){
              var coordMarker = getMarkerJson(dataJson,customMap);
              tripleCoordMarker = coordMarker;

              var lineData = [];
              var firstId = "customMap";
              var secId = dataJson[1].id; //Hard coded here first.

              mapStart = 0;
              mapStop = maxLocation;
              tripleMaxLocation = maxLocation;
              position = width*9/10;
          
              drawAxis();
              svg.append("text")
                //.attr("transform", "translate(" + width/10 + "," + (height - padding.bottom) +")")
                .attr("y", height)
                .attr("x",width*9/10)
                //.attr("dy", "1em")
                .style("text-anchor", "middle")
                .style("font-size","12px")
                .style("fill","red")
                .text(z);
              drawPath(firstId, secId, middle, position, coordMarker);
            }
              
          } else if(old_map == x && old_mapset == y){
            clicks -= 1;
            alert("You cannot add the same map again.");
          }
        
      }
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
 
  svg.selectAll("*").remove();
  d3.select("svg").remove();

  svg = d3.select("#example").append("svg")
      .attr("width", width)
      .attr("height", height)
      .append("g");
      //.call(zoom);   
  //console.log(dataJson);
  //console.log("First Draw " + dataJson[0].stop);
  yScaleM = d3.scale.linear()
             .domain([start,stop])
             .range([height- padding.top - padding.bottom, 10]);
  position = middle;

  drawAxis();

  if(maps.length>=1){
    num = 1;
    position = width/10;
    //coordMarker = getMarkerJson(dataJson);
    //console.log(coordMarker);

    var firstId = "customMap";
    var secId = dataJson[0].id;
    //var firstId = dataJson[0].id;
    //var secId = dataJson[1].id; //Hard coded here first.

    var locStart = Number.MAX_SAFE_INTEGER;
    var locStop = 0;
    var z = maps[0] + " " + mapsets[0];
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

    drawAxis();
    svg.append("text")
            //.attr("transform", "translate(" + width/10 + "," + (height - padding.bottom) +")")
            .attr("y", height)
            .attr("x",width/10)
            //.attr("dy", "1em")
            .style("text-anchor", "middle")
            .style("font-size","12px")
            .style("fill","red")
            .text(z);
    drawZoomPath(firstId, secId, start,stop,middle,position, doubleCoordMarker);
           
    if(maps.length==2) { // max 3 maps only
    
      var thirdId = dataJson[1].id; //Hard coded here first.
      position = width*9/10;

      locStart = Number.MAX_SAFE_INTEGER;
      locStop = 0;
      z = maps[1] + " " + mapsets[1];
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
            //.attr("transform", "translate(" + width/10 + "," + (height - padding.bottom) +")")
            .attr("y", height)
            .attr("x",width*9/10)
            //.attr("dy", "1em")
            .style("text-anchor", "middle")
            .style("font-size","12px")
            .style("fill","red")
            .text(z);
      drawZoomPath(firstId, thirdId, start,stop,middle,position, tripleCoordMarker); 
    }                         
  }

 //}
}

function drawZoomPath(fId, sId, start, stop, source, reference, Marker){
  for(i= 0; i < Marker.length; i++){
    if(Marker[i][fId]<=stop && Marker[i][fId]>=start){
      var coordData = {"x": source, "y": yScaleM(Marker[i][fId])};
      var coordData2 = {"x": reference,"y": yScale(Marker[i][sId])};
      //coordData = JSON.parse(coordData);
      //lineData.push(coordData);
      //lineData.push(coordData2);  
      var lineData = [coordData,coordData2];
      var lineFunction = d3.svg.line()
                    .x(function(d) { return d.x; })
                    .y(function(d) { return d.y; })
                    .interpolate("linear");

      var lineGraph = svg.append("path")
                      .attr("d", lineFunction(lineData))
                      .attr("class","axis")
                      .style("stroke", "blue")
                      .style("stroke-width", 1)
                      .style("stroke-opacity", 0.2)
                      .style("fill", "none");

      lineGraph.on("mouseover",function(){
                      d3.select(this)
                      .style("stroke-width", 4)
                      .style("stroke-opacity", 1)
                      .style("stroke", "red");
                   })
                 .on("mouseout",function() { 
                     d3.select(this)
                     .style("stroke-width", 1)
                     .style("stroke-opacity", 0.2)
                     .style("stroke","blue");
                 });   
    }
  }
}

function resetZoom(){
   document.getElementById('zoomIn').innerHTML = "Zoom in to a particular region: &nbsp; <input id='region' type='number' min='0' max=" + customMapStop + " value=" + defaultStart + "></input> &plusmn;  <input id='flanking' type='number' min='0' max=" + defaultStart + " value=" + defaultFlanking + "></input></td><td>&nbsp; <input type='button' id='zoom' value='Zoom' class='btn btn-primary' onclick='zoomMap()'></input>&nbsp;<input type='button' id='resetZoom' value='Reset' class='btn btn-danger' onclick='resetZoom()'></input>";
  svg.selectAll("*").remove();
  d3.select("svg").remove();
  svg = d3.select("#example").append("svg")
      .attr("width", width)
      .attr("height", height)
      .append("g");
      //.call(zoom);   

  mapStart = 0;
  mapStop = customMap[0].maps[0].stop;
  scaleStart = height- padding.top - padding.bottom;
  scaleStop = 0;
  position = middle;

  yScaleM = d3.scale.linear()
             .domain([mapStart,mapStop])
             .range([scaleStart,scaleStop]);
  drawAxis();


  
  if(maps.length>=1){
    num = 0;
    position = width/10;
    //coordMarker = getMarkerJson(dataJson);
    //console.log(coordMarker)
    mapStop = doubleMaxLocation;
    
    var firstId = "customMap";
    var secId = dataJson[num].id;
    var z = maps[0] + " " + mapsets[0];
    drawAxis();
    svg.append("text")
            //.attr("transform", "translate(" + width/10 + "," + (height - padding.bottom) +")")
            .attr("y", height)
            .attr("x",width/10)
            //.attr("dy", "1em")
            .style("text-anchor", "middle")
            .style("font-size","12px")
            .style("fill","red")
            .text(z);
    drawPath(firstId, secId, middle, position, doubleCoordMarker);

    if(maps.length==2) { // max 3 maps only
      num = 1;
      var thirdId = dataJson[num].id; //Hard coded here first.
      position = width*9/10;
      mapStop = tripleMaxLocation;
      //console.log(locStart + " " + locStop);
      z = maps[1] + " " + mapsets[1];
      drawAxis();
      svg.append("text")
            //.attr("transform", "translate(" + width/10 + "," + (height - padding.bottom) +")")
            .attr("y", height)
            .attr("x",width*9/10)
            //.attr("dy", "1em")
            .style("text-anchor", "middle")
            .style("font-size","12px")
            .style("fill","red")
            .text(z);
      drawPath(firstId, thirdId, middle,position, tripleCoordMarker); 
    }                         
  }
}

function resetMap(){
  clicks = 0;
  old_map = undefined;
  old_mapset = undefined;
  maps = [];
  mapsets = [];
  //document.getElementById('zoomIn').innerHTML = "";
  xAxis = undefined;
  yAxis = undefined;
  xScale = undefined;
  yScale = undefined;
  yScaleM = undefined;
  svg.selectAll("*").remove();
  d3.select("svg").remove();
 //d3.select("#grid").remove();
 //document.getElementById('grid').innerHTML = '';

  svg = d3.select("#example").append("svg")
              .attr("width", width)
              .attr("height", height)
              .append("g");
              //.call(zoom);   
             
        //console.log("First Draw " + dataJson[0].stop);

  document.getElementById('zoomIn').innerHTML = "Zoom in to a particular region: &nbsp; <input id='region' type='number' min='0' max=" + customMapStop + " value=" + defaultStart + "></input> &plusmn;  <input id='flanking' type='number' min='0' max=" + defaultStart + " value=" + defaultFlanking + "></input></td><td>&nbsp; <input type='button' id='zoom' value='Zoom' class='btn btn-primary' onclick='zoomMap()'></input>&nbsp;<input type='button' id='resetZoom' value='Reset' class='btn btn-danger' onclick='resetZoom()'></input>";

  mapStart = 0;
  mapStop = customMap[0].maps[0].stop;
  scaleStart = height- padding.top - padding.bottom;
  scaleStop = 0;
  position = middle;

  //console.log(position," + ", middle);

  yScaleM = d3.scale.linear()
               .domain([mapStart,mapStop])
               .range([scaleStart, scaleStop]);
  drawAxis();

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