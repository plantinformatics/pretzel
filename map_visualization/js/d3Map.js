var grid;
var dataView;
var gridData;
//var data = [];
var dataView = {};
var pc;
var fileAPI = true;
var gui;
//var globalData;
var globalDimensions;
var colorMap = {};
var brushColor = '#000000';

var currentFilter = {
		searchString: "",
		brushed: false
};

function without(arr, item) {
	return arr.filter(function(elem) { return item.indexOf(elem) === -1; })
};

function log10(x) {
	return Math.log(x) / Math.LN10;
}

var color = function(d) { return colorMap[d.id]; };
var createColormap = function(data, color) {
	color = (typeof color === 'undefined') ? "#000000" : color;
	data.forEach(function(d) {
		colorMap[d.id] = d3.rgb(0,0,0).toString();
	});
};

function setBrushColor(color) {
	brushColor = color;
	d3.select("#brush-color")
	  .selectAll("button")
	  .style("background-color", color);
}

var applyBrush = function() {
	var brushed = pc.brushed();
	if (brushed) {
		brushed.forEach(function(b) {
			colorMap[b.id] = brushColor;
		});
		pc.color(color)
		  .render();
	}
//	pc.brushReset();
};

// Correct url below for local testing
//ocpu.seturl("//localhost/ocpu/user/bertjan/library/pacode/R");

// This url should be used for the live demo. Note, make sure to push changes to
// to https://github.com/bbroeksema/pacode, before pushing depending features to
// https://github.com/julianheinrich/parallelcoordinates.de
ocpu.seturl("//public.opencpu.org/ocpu/github/bbroeksema/pacode/R");

function processPCAResults(results) {
	var data = pc.data(),
		fields = Object.getOwnPropertyNames(data.schema),
		newFields = Object.getOwnPropertyNames(results[0]),
		dims = pc.dimensions();

	fields = fields.filter(function (field) {
		return field.lastIndexOf("paco.PC", 0) === 0;
	});

	// Only return original data dimensions
	dims = dims.filter(function (dim) {
		return fields.indexOf(dim) === -1;
	});

	data.forEach(function (datum, i) {
		fields.forEach(function(field) {
			delete datum[field];
		});

		var currentPcs = results[i];
		newFields.forEach(function (field) {
			datum[field] = currentPcs[field];
		});
	});
	dims = dims.concat(newFields);
	pc
		.detectDimensions()
		.autoscale()
		.hideAxis(["id"])
		.render()
		.createAxes()
		.reorderable()
		.brushMode("None")
		.brushMode("1D-axes-multi");
}

function performPCA() {
	$('#pcaDialog').modal('hide');
	$('#configure-pca').attr('disabled', 'disabled');

	// Extract variables on which we're going to perform pca.
	var numberOfPrincipalComponents =  $('#pca-number-of-components').val();
	var variables = [];
	var pcaData = [];
	$('#pca-variables option:selected').each(function() {
		variables.push($(this).text());
	});
	// Extract variable on which pca is to be performed.
	pc.data().forEach(function(datum) {
		var pcaDatum = {};
		variables.forEach(function(variable) {
			pcaDatum[variable] = datum[variable];
		});
		pcaData.push(pcaDatum);
	});

	var req = ocpu.call("pacode.pca", {X: pcaData, pcs: numberOfPrincipalComponents}, function(session){
		//retrieve session console (async)
		session.getObject(processPCAResults);

		//enable the pca button
		$('#configure-pca').removeAttr('disabled');
	}).fail(function(){
		alert("Error: " + req.responseText);
		$('#configure-pca').removeAttr('disabled');
	});
}

function getNumericVariables() {
	var variables = [],
		schema = pc.data().schema;
	Object.getOwnPropertyNames(schema).forEach(function(variable) {
		if (schema[variable] === "numeric") {
			variables.push(variable);
		}
	});
	return variables;
}
