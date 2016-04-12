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

function configurePCA() {
	var data = pc.data(),
		schema = data.schema,
		select;

	function updateNumberOfComponentsSelect(variables) {
		// PCA can return a maximum of N components, where N is the minimum of the
		// number of variables used for pca and the number of rows. (I.e. if you have
		// 6 variables but only 2 rows, you will get only 2 principal components).
		maxNumberOfComponents = Math.min(variables.length, data.length);

		var select = $('#pca-number-of-components');
		select.empty();
		for (var i = 1; i <= maxNumberOfComponents; i++) {
			select.append($("<option></option>")
				.attr("value", i).text(i));
		}
	}

	select = $('#pca-variables');
	select.empty();
	select.change(function() {
		var variables = [];
		$('#pca-variables option:selected').each(function() {
      variables.push($(this).text());
    });
		updateNumberOfComponentsSelect(variables);
	});

	var variables = [];
	Object.getOwnPropertyNames(schema).forEach(function(variable) {
		if (schema[variable] === "numeric") {
			variables.push(variable);
			select.append($("<option></option>")
				.attr("value", variable).text(variable));
		}
	});
	$('#pca-variables').prop('size', Math.min(variables.length, 8))
	$('#pca-variables option').prop('selected', 'selected');

	updateNumberOfComponentsSelect(variables);
	$('#pcaDialog').modal();
}

function processClusteringResults(clustering) {
	var data = pc.data();

	clustering.forEach(function(d, i) {
		data[i]["kmeans"] = d;
	})

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

function performClustering() {
	$('#clusterDialog').modal('hide');
	$('#configure-clustering').attr('disabled', 'disabled');

	// Extract variables on which we're going to perform pca.
	var numberOfClusters =  $('#cluster-count').val();
	var variables = [];

	$('#cluster-variables option:selected').each(function() {
		variables.push($(this).text());
	});

	// Extract variable on which pca is to be performed.
	var clusterData = [];
	pc.data().forEach(function(datum) {
		var clusterDatum = {};
		variables.forEach(function(variable) {
			clusterDatum[variable] = datum[variable];
		});
		clusterData.push(clusterDatum);
	});

	var req = ocpu.call("pacode.kmeans", {X: clusterData, k: numberOfClusters}, function(session){
		//retrieve session console (async)
		session.getObject(processClusteringResults);

		//enable the pca button
		$('#configure-clustering').removeAttr('disabled');
	}).fail(function(){
		alert("Error: " + req.responseText);
		$('#configure-clustering').removeAttr('disabled');
	});
}

function configureClustering() {
	$('#cluster-count').attr('min', 2);
	$('#cluster-count').attr('max', Math.floor(Math.sqrt(pc.data().length)));

	select = $('#cluster-variables');
	select.empty();
	getNumericVariables().forEach(function(variable) {
		select
			.append($("<option></option>")
			.attr("value", variable).text(variable));
	});

	$('#clusterDialog').modal();
}

$(document).ready( function() {

	/*
	 * Setup the UI
	 */

	// http://codereview.stackexchange.com/questions/66363/toggle-item-inside-a-bootstrap-dropdown-menu
	$('#brushing-menu a').click(function(e) {
		if(/strums/.test(this.id)) {
			$('#brushing-menu').addClass('strums');
		} else {
			$('#brushing-menu').removeClass('strums');
		}
		$('#brushing-text').text($(this).text());
	});

	$('#brushing-1D').click(function(e) {
		pc.brushMode('1D-axes-multi');
	});

	$('#brushing-2D').click(function(e) {
		pc.brushMode('2D-strums');
	});

	$('#clear-brush').click(function(e) {
		pc.brushReset();
	});

	$('#configure-pca').click(configurePCA);
	$('#perform-pca').on('click', performPCA);

	$('#configure-clustering').click(configureClustering);
	$('#perform-clustering').on('click', performClustering);
	$('#cluster-count').on('change', function() {
		$('#cluster-count-label').html($(this).val());
	});

	$('#brush-color-button').click(function(e) {
		applyBrush();
	});

//	$(".pick-a-color").pickAColor({
//        showSpectrum          : false,
//        showSavedColors       : false,
//        saveColorsPerElement  : false,
//        fadeMenuToggle        : false,
//        showAdvanced          : false,
//        showBasicColors       : false,
//        showHexInput          : false,
//        allowBlank            : false
//	});

	$('[data-toggle="tooltip"]').tooltip({
		placement: 'bottom',
		delay: {show: 1000, hide: 0},
		container: 'body'
	});

	// buttons are still 'focused' after being pressed in bootstrap.
	// this makes them behave as expected
	$(".btn").mouseup(function(){
	    $(this).blur();
	})

	d3.select("#brush-color-menu")
	  .selectAll("li")
	    .data(colorbrewer['Set2'][8])
	  .enter().append("li").append("a")
	    .attr("href", "#")
	    .style("background-color", function(d) { return d; })
	    .on("click", function(d) {
	    	setBrushColor(d);
	    })
	  .append("span")
	    .attr("class", "swatch");

	setBrushColor(colorbrewer['Set2'][8][1]);

	/*
		DENSITY UI
	*/

	// var alphaSlider = $("#alpha-slider").slider({
	// 	formatter: function(value) {
	// 		return 'Current value: ' + value;
	// 	}
	// }).on('slide', function(slider) {
	// 	pc.alpha(slider.value/100.0).render();
	// });

	var varianceSlider = $("#variance-slider").slider({
		formatter: function(value) {
			return 'Current value: ' + value;
		}
	}).on('slide', function(slider) {
		pc.variance(slider.value/1000.0).render();
	});

	$('#density-button').click(function(e) {
		if (pc.normalize()) {
			pc.composite("source-over");
			pc.normalize(false);
		} else {
			pc.composite("lighter");
			pc.normalize(true);
			if (varianceSlider.slider('getValue') <= 1) {
				varianceSlider.slider('setValue', 2);
				pc.variance(2/1000);
			}

		}
		pc.render();
	});

	// not tested
	if (!window.File) {
		alert('The File API is not supported by your browser. File upload disabled.');
		fileAPI = false;
	}

	var canvas = document.createElement("canvas");

	if (canvas.getContext("webgl") === null) {
		$("#density-group").css("display", "none");
		pc = new d3.parcoords()("#pc_section")
			.margin({ top: 20, left: 50, bottom: 12, right: 0 });
	} else {
		pc = new d3.parcoords()("#pc_section", "webgl")
			.margin({ top: 20, left: 50, bottom: 12, right: 0 });
	}

	d3.csv('data/mtcars.csv', function(d) {
		loadData(d);
	});

	// setup file upload
	var obj = $("#pc_section");
	obj.on('dragenter', function (e) {
		e.stopPropagation();
		e.preventDefault();
		//$(this).css('border', '2px solid #0B85A1');
	});
	obj.on('dragover', function (e) {
		e.stopPropagation();
		e.preventDefault();
	});
	obj.on('drop', function (e) {
		//$(this).css('border', '2px dotted #0B85A1');
		e.preventDefault();
		var files = e.originalEvent.dataTransfer.files;

		// load data
		loadFiles(files);
	});
	$(document).on('dragenter', function (e) {
		e.stopPropagation();
		e.preventDefault();
	});
	$(document).on('dragover', function (e) {
		e.stopPropagation();
		e.preventDefault();
		//obj.css('border', '2px dotted #0B85A1');
	});
	$(document).on('drop', function (e) {
		e.stopPropagation();
		e.preventDefault();
	});

	var layout = function() {
		pc
		.width($("#pc_section").width())
		.height($("#pc_section").height())
		.render();
	};

	$(window).resize(layout);


});

function createSchema(data) {
	// To get some basic R functionality working through OpenCPU, we'll need to
	// know what kind of data types we're dealing with and transform the data
	// accordingly.
	data.schema = data.shift();
	Object.getOwnPropertyNames(data.schema).forEach(function(varName) {
		var type = data.schema[varName].toLowerCase();
		switch (type) {
			case "factor":
			case "numeric":
				break;
			default:
				throw varName + " has invalid type: " + type + " (expected: factor or numeric)";
		}
	});
}

function convertNumeric(data) {
	// d3.csv loads all fields as strings, so we need some meta data (the schema)
	// and manual processing afterwards to make sure that numeric vars are actually
	// stored as numerics.
	var schema = data.schema,
		varNames = Object.getOwnPropertyNames(data.schema);

	data.forEach(function(datum) {
		varNames.forEach(function(varName) {
			var type = data.schema[varName].toLowerCase();
			switch (type) {
				case "factor":
					break;
				case "numeric":
					datum[varName] = +datum[varName];
					break;
			}
		});
	});
}

function loadData(data) {
//	globalData = data;
	createSchema(data);
	convertNumeric(data);
	createIDs(data);
	createColormap(data);
	pc
		.data(data)
		.color(color)
		.detectDimensions()
		.autoscale()
		.hideAxis(["id"])
		.alpha(1.0)
		.render()
		.createAxes()
		.brushMode("1D-axes-multi")
		//.shadows()
		.reorderable();

	// setupGrid(data);

	// remove previous dimensions before assigning
	// new ones

	globalDimensions = pc.dimensions();

	setupVisibility();
}

function loadFiles(files) {
	if (files.length > 0) {
		var reader = new FileReader();
		var file = files[0];
		reader.onload = (function(file) { return function(e) {
			var data = (reader.result.indexOf("\t") < 0 ? d3.csv : d3.tsv).parse(reader.result);
			if (data.length > 0) {
				loadData(data);
			} else {
				alert("no data or not in csv format!");
			}
		};})(file);
		reader.readAsText(file);
		$("#status_filename").text(file.name);
	}
}

setupVisibility = function() {

	globalDimensions.forEach(function(dim) {
		pc[dim] = true;
//		gui.add(pc, dim).onChange(toggleVisibility);
	});
	// pc["id"] = false;
}

var toggleVisibility = function(value) {
	var hidden = globalDimensions.filter(function(dim) {
		return pc[dim] === false;
	});
	hidden.push("id");
	pc
	.data(globalData)
	.detectDimensions()
	.hideAxis(hidden)
	.render()
	.createAxes()
	.reorderable()


};

function createIDs(data) {
	if (data.length && typeof data[0].id === "undefined") {
		for (var i = 0; i < data.length; ++i) {
			data[i].id = i;
		}
	}
}
