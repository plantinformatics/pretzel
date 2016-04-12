d3.parcoords = function(config) {
  var __ = {
    data: [],
    highlighted: [],
    dimensions: [],
    dimensionTitles: {},
    dimensionTitleRotation: 0,
    types: {},
    brushed: false,
    width: 600,
    height: 300,
    margin: { top: 24, right: 0, bottom: 12, left: 0 },
    color: "#069",
    hideAxis : [],
    bundlingStrength: 0.5,
	bundleDimension: null,
	smoothness: 0.0,
	showControlPoints: false
  };

  extend(__, config);
var pc = function(selection, renderer) {
  selection = pc.selection = d3.select(selection);
  renderer = renderer || "canvas";

  __.width = selection[0][0].clientWidth;
  __.height = selection[0][0].clientHeight;

  // canvas data layers
  pc.renderType(renderer);  

  return pc;
};
//pc.render = function() {
//  // try to autodetect dimensions and create scales
//  if (!__.dimensions.length) pc.detectDimensions();
//  if (!(__.dimensions[0] in yscale)) pc.autoscale();
//
//  pc.render[__.mode]();
//
//  events.render.call(this);
//  return this;
//};
//
//pc.render['default'] = function() {
//  pc.clear('foreground');
//  pc.clear('highlight');
//  if (__.brushed) {
//    __.brushed.forEach(path_foreground);
//    __.highlighted.forEach(path_highlight);
//  } else {
//    __.data.forEach(path_foreground);
//    __.highlighted.forEach(path_highlight);
//  }
//};
//
//var rqueue = d3.renderQueue(path_foreground)
//  .rate(50)
//  .clear(function() {
//    pc.clear('foreground');
//    pc.clear('highlight');
//  });
//
//pc.render.queue = function() {
//  if (__.brushed) {
//    rqueue(__.brushed);
//    __.highlighted.forEach(path_highlight);
//  } else {
//    rqueue(__.data);
//    __.highlighted.forEach(path_highlight);
//  }
//};

var renderer = {
  types: {
    "None": {
      install: function(pc) {},           // Nothing to be done.
      clear: function(layer) {},
      uninstall: function(pc) {}		  // Nothing to be done.
    }
  },
  type: "None",
  currentRenderer: function() {
    return this.types[this.type];
  }
};

pc.renderTypes = function() {
  return Object.getOwnPropertyNames(renderer.types);
};

pc.renderType = function(type) {
  if (arguments.length === 0) {
    return renderer.type;
  }

  if (pc.renderTypes().indexOf(type) === -1) {
    throw "pc.renderer: Unsupported renderer: " + type;
  }

  // Make sure that we don't trigger unnecessary events by checking if the mode
  // actually changes.
  if (type !== renderer.type) {
    // When changing brush modes, the first thing we need to do is clearing any
    // brushes from the current mode, if any.
    if (renderer.type !== "None") {
      pc.resetRenderer();
    }

    // Next, we need to 'uninstall' the current brushMode.
    renderer.types[renderer.type].uninstall(pc);
    
    // remove axes and svg layer
    pc.selection.selectAll('svg').remove();
    
    // Finally, we can install the requested one.
    renderer.type = type;
    renderer.types[renderer.type].install();

    // for now, keep svg tick and brush layers the same
    // for all renderer
    pc.svg = pc.selection
      .append("svg")
        .attr("width", __.width)
        .attr("height", __.height)
      .append("svg:g")
        .attr("transform", "translate(" + __.margin.left + "," + __.margin.top + ")");
    
//    pc.createAxes();
 // axes, destroys old brushes.
    if (g) pc.createAxes();
    var bm = pc.brushMode();
    pc.brushMode("None").brushMode(bm);
    
  }

  return pc;
};

//render-mode: canvas

(function() {

	var config = {
			composite: "source-over",
			alpha: 0.7,
			mode: "default",
			rate: 20
	};

	var ctx = {};
	var layers = ["shadows", "marks", "foreground", "highlight"];

	// draw little dots on the axis line where data intersects
	function axisDots() {
//		var ctx = this.ctx.marks;
		ctx.marks.globalAlpha = d3.min([ 1 / Math.pow(__.data.length, 1 / 2), 1 ]);
		__.data.forEach(function(d) {
			__.dimensions.map(function(p, i) {
				ctx.marks.fillRect(position(p) - 0.75, yscale[p](d[p]) - 0.75, 1.5, 1.5);
			});
		});
		return this;
	};

	function clear(layer) {
		ctx[layer].clearRect(0,0,w()+2,h()+2);
		return this;
	};

	function install() {

		var e = d3.dispatch.apply(this, d3.keys(config))
		  .on("composite", function(d) { 
			  ctx.foreground.globalCompositeOperation = d.value; 
			  })
		  .on("alpha", function(d) { 
			  ctx.foreground.globalAlpha = d.value; 
			  })
		  .on("rate", function(d) { rqueue.rate(d.value); });

		// expose the state of the renderer
		pc.state.renderer = config;
		// create getter/setters
		getset(pc, config, e);
		// expose events
		d3.rebind(pc, e, "on");
		
		layers.forEach(function(layer) {
			canvas[layer] = pc.selection
			  .append("canvas")
			  .attr("class", layer)[0][0];
			ctx[layer] = canvas[layer].getContext("2d");
		});

		pc.shadows = shadows;
		pc.axisDots = axisDots;
		pc.render = render;
		pc.resetRenderer = resetRenderer;
		pc.clear = clear;
		
		resize();

	}

	function uninstall() {
		layers.forEach(function(layer) {
			delete ctx[layer];
			delete canvas[layer];
		});
		
		pc.selection.selectAll("canvas").remove();
		
	}

	function resize() {
		// canvas sizes
		pc.selection.selectAll("canvas")
		.style("margin-top", __.margin.top + "px")
		.style("margin-left", __.margin.left + "px")
		.attr("width", w()+2)
		.attr("height", h()+2);

		// default styles, needs to be set when canvas width changes
		ctx.foreground.strokeStyle = __.color;
		ctx.foreground.lineWidth = 1.4;
		ctx.foreground.globalCompositeOperation = config.composite;
		ctx.foreground.globalAlpha = config.alpha;
		ctx.highlight.lineWidth = 3;
		ctx.shadows.strokeStyle = "#dadada";

	}

	// draw single cubic bezier curve
	function single_curve(d, ctx) {

		var centroids = compute_centroids(d);
		var cps = compute_control_points(centroids);

		ctx.moveTo(cps[0].e(1), cps[0].e(2));
		for (var i = 1; i < cps.length; i += 3) {
			if (__.showControlPoints) {
				for (var j = 0; j < 3; j++) {
					ctx.fillRect(cps[i+j].e(1), cps[i+j].e(2), 2, 2);
				}
			}
			ctx.bezierCurveTo(cps[i].e(1), cps[i].e(2), cps[i+1].e(1), cps[i+1].e(2), cps[i+2].e(1), cps[i+2].e(2));
		}
	};

	// draw single polyline
	function color_path(d, i, ctx) {
		ctx.strokeStyle = d3.functor(__.color)(d, i);
		ctx.beginPath();
		if ((__.bundleDimension !== null && __.bundlingStrength > 0) || __.smoothness > 0) {
			single_curve(d, ctx);
		} else {
			single_path(d, ctx);
		}
		ctx.stroke();
	};

	// draw many polylines of the same color
	function paths(data, ctx) {
		ctx.clearRect(-1, -1, w() + 2, h() + 2);
		ctx.beginPath();
		data.forEach(function(d) {
			if ((__.bundleDimension !== null && __.bundlingStrength > 0) || __.smoothness > 0) {
				single_curve(d, ctx);
			} else {
				single_path(d, ctx);
			}
		});
		ctx.stroke();
	};

	function single_path(d, ctx) {
		__.dimensions.map(function(p, i) {
			if (i == 0) {
				ctx.moveTo(position(p), yscale[p](d[p]));
			} else {
				ctx.lineTo(position(p), yscale[p](d[p]));
			}
		});
	}

	function path_foreground(d, i) {
		return color_path(d, i, ctx.foreground);
	};

	function path_highlight(d, i) {
		return color_path(d, i, ctx.highlight);
	};

	function render() {
		// try to autodetect dimensions and create scales
		if (!__.dimensions.length) pc.detectDimensions();
		if (!(__.dimensions[0] in yscale)) pc.autoscale();

		render[config.mode]();

		events.render.call(this);
		return this;
	}

	render['default'] = function() {
		clear('foreground');
		clear('highlight');
		if (__.brushed) {
			__.brushed.forEach(path_foreground);
			__.highlighted.forEach(path_highlight);
		} else {
			__.data.forEach(path_foreground);
			__.highlighted.forEach(path_highlight);
		}
	};

	var rqueue = d3.renderQueue(path_foreground)
	.rate(50)
	.clear(function() {
		clear('foreground');
		clear('highlight');
	});

	render.queue = function() {
		if (__.brushed) {
			rqueue(__.brushed);
			__.highlighted.forEach(path_highlight);
		} else {
			rqueue(__.data);
			__.highlighted.forEach(path_highlight);
		}
	};

	function resetRenderer() {
		
	}

	function shadows() {
		flags.shadows = true;
		if (__.data.length > 0) {
			paths(__.data, ctx.shadows);
		}
		return this;
	}

	renderer.types["canvas"] = {
			install: install,
			resize: resize,
			uninstall: uninstall
	}

})();//renderGL.js

(function() {

	var config = {
			alpha: 0.7,
			normalize: false,
			variance: 0.001,
			mode: "default",
			composite: "source-over"
	};
	
	var shaders = {},
	lineShader = null,
	splatShader = null,
	fboShader = null,
	encodeShader = null,
	linePositionBufferObject,
	linePositions,
	lineColors,
	lineColorBufferObject,
	firstIndex = {},
	numItems = {},
	mvpMatrixHandle,
	mvpMatrix = null,
	projectionMatrix = null,
	modelMatrix = null,
	densityParameters,
	densityParameterBufferObject,
	framebufferPositions,
	framebufferTexCoords,
	layers = ["foreground"],
	gl = null;

	var ctx = {};
	var rttFramebuffer, outputFramebuffer;
	var rttTexture, outputTexture;
	var outputStorage;
	var outputConverted;
	
	function logGLCall(functionName, args) {   
		console.log("gl." + functionName + "(" + 
				WebGLDebugUtils.glFunctionArgsToString(functionName, args) + ")");   
	} 

	function install() {
		if (typeof mat4 === 'undefined') {
			throw "please include gl-matrix.js";
		}

		layers.forEach(function(layer) {
			canvas[layer] = pc.selection
			.append("canvas")
			.attr("class", layer)[0][0];
			ctx[layer] = canvas[layer].getContext("experimental-webgl", {alpha: false}) || 
			canvas[layer].getContext("webgl", {alpha: false});
		});

//		gl = ctx["foreground"] = WebGLDebugUtils.makeDebugContext(canvas["foreground"].getContext("experimental-webgl", {alpha: false}), undefined, logGLCall);
		gl = ctx["foreground"];

		if (!gl.getExtension('OES_texture_float')) {
			throw new Error('This demo requires the OES_texture_float extension');
		}
		
		var e = d3.dispatch.apply(this, d3.keys(config));

		// expose the state of the renderer
		pc.state.renderer = config;
		// create getter/setters
		getset(pc, config, e);
		// expose events
		d3.rebind(pc, e, "on");

		setupShaders();
		initTextureFramebuffers();

		pc.render = render;
		pc.clear = clear;
		
//		uploadData(__.data);
//		side_effects.on("data", function(d) {
//			uploadData(d.value);
//		});
		
		resize();

	}

	function uninstall() {
		layers.forEach(function(layer) {
			delete ctx[layer];
			delete canvas[layer];
		});
		
		pc.selection.selectAll("canvas").remove();
	}
	
	function initTextureFramebuffers() {
		if (w() <= 0 || h() <= 0) return;

		rttFramebuffer = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, rttFramebuffer);
		rttFramebuffer.width = w();
		rttFramebuffer.height = h();

		rttTexture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, rttTexture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); //Prevents s-coordinate wrapping (repeating).
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); //Prevents t-coordinate wrapping (repeating).

		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, rttFramebuffer.width, rttFramebuffer.height, 0, gl.RGBA, gl.FLOAT, null);

		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, rttTexture, 0);

		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);

		// setup fbo coordinates
		var fboCoords = [
		                 1,  1,
		                 -1,  1,
		                 -1, -1,
		                 1,  1,
		                 -1, -1,
		                 1, -1
		                 ];

		framebufferPositions = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, framebufferPositions);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(fboCoords), gl.STATIC_DRAW);
		framebufferPositions.itemSize = 2;
		framebufferPositions.numItems = fboCoords.length / framebufferPositions.itemSize;

		outputFramebuffer = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, outputFramebuffer);
		outputFramebuffer.width = rttFramebuffer.width;
		outputFramebuffer.height = rttFramebuffer.height;

		// outputTexture used to encode floats
		outputTexture = gl.createTexture();
		outputTexture.width = rttFramebuffer.width;
		outputTexture.height = rttFramebuffer.height;
		gl.bindTexture(gl.TEXTURE_2D, outputTexture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); //Prevents s-coordinate wrapping (repeating).
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); //Prevents t-coordinate wrapping (repeating).

		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, rttFramebuffer.width, rttFramebuffer.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, outputTexture, 0);

		outputStorage = new Uint8Array(outputTexture.width * outputTexture.height * 4);
		outputConverted = new Float32Array(outputTexture.width * outputTexture.height);

		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}

	function clear(layer) {
		gl.clearColor(1, 1, 1, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
	};

	var glqueue = d3.renderQueue(function(chunk) {
		drawSplats(chunk);
	})
	.rate(50)
	.clear(function() { pc.clear('foreground'); });

//	pc.render.queueGL = function() {
//
//		pc.clear('foreground');
//
//		gl.viewport(0, 0, w(), h());
//
//		gl.enable(gl.BLEND);
//		gl.disable(gl.DEPTH_TEST);
//
//		projectionMatrix = mat4.create();
//		modelMatrix = mat4.create();
//		mat4.ortho(0, w(), h()+2, 1, -1.0, 1.0, projectionMatrix);
//		mat4.identity(modelMatrix);
//
////		gl.useProgram(splatShader);
//
//		if (__.brushed) {
//			glqueue(__.brushed);
//		} else {
//			glqueue(__.data);
//		}
//	}

	function render() {
		// try to autodetect dimensions and create scales
		if (!__.dimensions.length) pc.detectDimensions();
		if (!(__.dimensions[0] in yscale)) pc.autoscale();

		render[config.mode]();

		events.render.call(this);
		return this;
	}
	
	render['default'] = function() {
		
		// try to autodetect dimensions and create scales
		if (!__.dimensions.length) pc.detectDimensions();
		if (!(__.dimensions[0] in yscale)) pc.autoscale();
		
		if (config.normalize) {
			gl.bindFramebuffer(gl.FRAMEBUFFER, rttFramebuffer);
			gl.viewport(0, 0, rttFramebuffer.width, rttFramebuffer.height);
			// set background to black for normalization to work properly
			gl.clearColor(0, 0, 0, 1); 
		} else {
			gl.clearColor(1, 1, 1, 1);	// white by default
			gl.viewport(0, 0, w(), h());
		}

		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.enable(gl.BLEND);
		gl.disable(gl.DEPTH_TEST);

		switch(__.renderer.composite) {
		case "source-over": gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		break;
		case "lighter": gl.blendFunc(gl.ONE, gl.ONE);	// additive blending
		break;
		default: gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		}

		projectionMatrix = mat4.create();
		modelMatrix = mat4.create();
		mat4.ortho(projectionMatrix, 0, w(), h()+2, 1, -1.0, 1.0);
		mat4.identity(modelMatrix);

		var draw = drawSplats;

		if (__.renderer.variance <= 0.001) {	
			draw = drawLines;
		} else {
			draw = drawSplats;
		}

		if (__.brushed) {
			draw(__.brushed);
		} else {
			draw(__.data);
		}

		if (__.renderer.normalize) {
			// RENDER TO encode floats as unsigned byte
			gl.bindFramebuffer(gl.FRAMEBUFFER, outputFramebuffer);
			gl.clearColor(0, 0, 0, 1); // black
			gl.clear(gl.COLOR_BUFFER_BIT);
//			pc.clear('foreground');

			gl.useProgram(encodeShader);

			gl.viewport(0, 0, outputFramebuffer.width, outputFramebuffer.height);
			gl.disable(gl.BLEND);

			gl.enableVertexAttribArray(encodeShader.vertex);
			gl.bindBuffer(gl.ARRAY_BUFFER, framebufferPositions);
			gl.vertexAttribPointer(encodeShader.vertex, framebufferPositions.itemSize, gl.FLOAT, false, 0, 0);

			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, rttTexture);
			gl.uniform1i(encodeShader.texture, 0);

			gl.drawArrays(gl.TRIANGLES, 0, framebufferPositions.numItems);

			// read back to CPU
			gl.readPixels(0, 0, outputTexture.width, outputTexture.height, gl.RGBA, gl.UNSIGNED_BYTE, outputStorage);
			outputConverted = new Float32Array(outputStorage.buffer);

			var min = 1000000, max = 0;
			for (var i = 0; i < outputConverted.length; ++i) {
				if (outputConverted[i] < min) {
					min = outputConverted[i];
				}
				if (outputConverted[i] > max) {
					max = outputConverted[i];
				}
			}

			//console.log("min: " + min + ", max:" + max);

			gl.bindFramebuffer(gl.FRAMEBUFFER, null);

//			gl.clear(gl.COLOR_BUFFER_BIT);
			pc.clear('foreground');

			gl.useProgram(fboShader);

			gl.viewport(0, 0, w(), h());

			gl.enableVertexAttribArray(fboShader.vertex);
			gl.bindBuffer(gl.ARRAY_BUFFER, framebufferPositions);
			gl.vertexAttribPointer(fboShader.vertex, framebufferPositions.itemSize, gl.FLOAT, false, 0, 0);

			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, rttTexture);
			gl.uniform1i(fboShader.texture, 0);

			gl.uniform1f(fboShader.min, min);
			gl.uniform1f(fboShader.max, max);

			gl.drawArrays(gl.TRIANGLES, 0, framebufferPositions.numItems);

		}

	}

	function resize() {
		// canvas sizes
		pc.selection.selectAll("canvas")
		.style("margin-top", __.margin.top + "px")
		.style("margin-left", __.margin.left + "px")
		.attr("width", w()+2)
		.attr("height", h()+2);
	}
	
	function drawLines(data) {
		// upload data and color to the GPU
		// NOTE: this should only be done once, not on every redraw
		uploadData(data);
//		uploadColors(data);

		gl.useProgram(lineShader);

		// Pass in the position information
		gl.enableVertexAttribArray(lineShader.positionAttribute);
		gl.bindBuffer(gl.ARRAY_BUFFER, linePositionBufferObject);
		gl.vertexAttribPointer(lineShader.positionAttribute, linePositionBufferObject.itemSize, gl.FLOAT, false, 0, 0);

		// Pass in the color information
		gl.enableVertexAttribArray(lineShader.colorAttribute);
		gl.bindBuffer(gl.ARRAY_BUFFER, lineColorBufferObject);
		gl.vertexAttribPointer(lineShader.colorAttribute, lineColorBufferObject.itemSize, gl.FLOAT, false, 0, 0);

		mvpMatrix = mat4.create();
		// This multiplies the modelview matrix by the projection matrix, and stores the result in the MVP matrix
		// (which now contains model * view * projection).
		mat4.multiply(mvpMatrix, projectionMatrix, modelMatrix);

		var dimCount = __.dimensions.length;
		gl.uniformMatrix4fv(lineShader.mvpMatrixUniform, false, mvpMatrix);
//		data.map(function(d, i) {
		gl.drawArrays(gl.LINE_STRIP, 0, linePositionBufferObject.numItems);
//		});

	}

//	Draws splats from the given vertex data.
	function drawSplats(data) {

		uploadData(data);
//		uploadColors(data);

		gl.useProgram(splatShader);

		// Pass in the position information
		gl.enableVertexAttribArray(splatShader.positionAttribute);
		gl.bindBuffer(gl.ARRAY_BUFFER, linePositionBufferObject);
		gl.vertexAttribPointer(splatShader.positionAttribute, linePositionBufferObject.itemSize, gl.FLOAT, false, 0, 0);

		// Pass in the color information
		gl.enableVertexAttribArray(splatShader.colorAttribute);
		gl.bindBuffer(gl.ARRAY_BUFFER, lineColorBufferObject);
		gl.vertexAttribPointer(splatShader.colorAttribute, lineColorBufferObject.itemSize, gl.FLOAT, false, 0, 0);

		// Pass in the density parameter information
		gl.enableVertexAttribArray(splatShader.densityAttribute);
		gl.bindBuffer(gl.ARRAY_BUFFER, densityParameterBufferObject);
		gl.vertexAttribPointer(splatShader.densityAttribute, densityParameterBufferObject.itemSize, gl.FLOAT, false, 0, 0);

		mvpMatrix = mat4.create();
		// This multiplies the modelview matrix by the projection matrix, and stores the result in the MVP matrix
		// (which now contains model * view * projection).
		mat4.multiply(mvpMatrix, projectionMatrix, modelMatrix);

		gl.uniformMatrix4fv(splatShader.mvpMatrixUniform, false, mvpMatrix);
		gl.uniform1f(splatShader.variance, __.renderer.variance);
		gl.uniform1i(splatShader.normalize, __.renderer.normalize ? 1 : 0);

		gl.drawArrays(gl.TRIANGLES, 0, linePositionBufferObject.numItems);
	}


	function uploadData(data) {

		// try to autodetect dimensions and create scales
		if (!__.dimensions.length) pc.detectDimensions();
		if (!(__.dimensions[0] in yscale)) pc.autoscale();

		// shortcut
		var p = difference(__.dimensions, __.hideAxis);

		var sampleCount = data.length;
		var dimCount = p.length;
		var lineCount = (dimCount - 1) * sampleCount;

		var vertexCount = 0;
		var j = 0;

		// LINES
		if (__.renderer.variance <= 0.001) {

			vertexCount = dimCount * sampleCount;

			// two values per vertex (x,y)
			linePositions = new Float32Array(vertexCount * 2);

			for (var s = 0; s < sampleCount; s++) {
				// vertices
				if (!(s % 2)) {	// left to right
					for (var d = 0; d < dimCount; d++) {
						var ip = yscale[p[d]](data[s][p[d]]);

						linePositions[j + 0] = position(p[d]);
						linePositions[j + 1] = ip;

						j += 2;
					}
				} else {		// right to left
					for (var d = dimCount - 1; d >= 0; d--) {
						var ip = yscale[p[d]](data[s][p[d]]);

						linePositions[j + 0] = position(p[d]);
						linePositions[j + 1] = ip;

						j += 2;
					}
				}
				
			}

			lineColors = new Float32Array(vertexCount * 4);

			// color
			j = 0;
			data.forEach(function(x) {
				var color = d3.rgb(d3.functor(__.color)(x));
				for (var d = 0; d < dimCount; d++) {
					lineColors.set([color.r/255.0, color.g/255.0, color.b/255.0, config.alpha], j);
					j += 4;
				}
			});

			// SPLATS
		} else {

			// WebGL doesn't support QUADS, use two triangles instead
			var triangleCount = lineCount * 2;
			vertexCount = triangleCount * 3;

//			var offset = uncertainty / 2;
			linePositions = new Float32Array(vertexCount * 2);
			// two values per vertex (x,y)
			for (var s = 0; s < sampleCount; s++) {
				for (var d = 0; d < dimCount - 1; d++) {

					var lefttop = h();
					var leftbottom = 0;
					var righttop = h();
					var rightbottom = 0;

					// compute vertices of two triangles to get a single quad
					// tl
					linePositions[j + 0] = position(p[d]);
					linePositions[j + 1] = lefttop;
					// tr
					linePositions[j + 2] = position(p[d + 1]);
					linePositions[j + 3] = righttop;
					// br
					linePositions[j + 4] = position(p[d + 1]);
					linePositions[j + 5] = rightbottom;
					// br
					linePositions[j + 6] = linePositions[j + 4];
					linePositions[j + 7] = linePositions[j + 5];
					// bl
					linePositions[j + 8] = position(p[d]);
					linePositions[j + 9] = leftbottom;
					// tl
					linePositions[j + 10] = linePositions[j + 0];
					linePositions[j + 11] = linePositions[j + 1];

					j += 12;
				}
			}

			// Compute splat density parameters
			// REMARK: might be more memory efficient using index buffers, as densityParameters can
			// only take values of 1 and 0.
			densityParameterBufferObject = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, densityParameterBufferObject);
			densityParameterBufferObject.itemSize = 3;
			densityParameterBufferObject.numItems = vertexCount;
			densityParameters = new Float32Array(densityParameterBufferObject.numItems * densityParameterBufferObject.itemSize);

			// two values per vertex (a,b)
			var j = 0;
			for (var s = 0; s < sampleCount; s++) {
				for (var d = 0; d < dimCount - 1; d++) {
					var leftip = yscale[p[d]](data[s][p[d]]) / h();
					var rightip = yscale[p[d + 1]](data[s][p[d + 1]]) / h();

					// tl
					densityParameters[j + 0] = 0;
					densityParameters[j + 1] = 1;
					densityParameters[j + 2] = leftip;

					// tr
					densityParameters[j + 3] = 1;
					densityParameters[j + 4] = 1;
					densityParameters[j + 5] = rightip;

					// br
					densityParameters[j + 6] = 1;
					densityParameters[j + 7] = 0;
					densityParameters[j + 8] = rightip;

					// br
					densityParameters[j + 9] = 1;
					densityParameters[j + 10] = 0;
					densityParameters[j + 11] = rightip;

					// bl
					densityParameters[j + 12] = 0;
					densityParameters[j + 13] = 0;
					densityParameters[j + 14] = leftip;

					// tl
					densityParameters[j + 15] = 0;
					densityParameters[j + 16] = 1;
					densityParameters[j + 17] = leftip;

					j += 18;
				}
			}

			gl.bufferData(gl.ARRAY_BUFFER, densityParameters, gl.STATIC_DRAW);

			lineColors = new Float32Array(vertexCount * 4);

			// color
			j = 0;
			for (var x = 0; x < data.length; ++x) {
				var color = d3.rgb(d3.functor(__.color)(data[x]));
				for (var d = 0; d < dimCount - 1; d++) {
					for (var vertex = 0; vertex < 6; vertex++) {
						lineColors.set([color.r/255.0, color.g/255.0, color.b/255.0, config.alpha], j);
						j += 4;
					}
				}
			}
		}

		// Create buffers in OpenGL's working memory.
		linePositionBufferObject = gl.createBuffer();
		linePositionBufferObject.itemSize = 2;
		linePositionBufferObject.numItems = vertexCount;
		linePositionBufferObject.dimCount = dimCount;
		gl.bindBuffer(gl.ARRAY_BUFFER, linePositionBufferObject);
		gl.bufferData(gl.ARRAY_BUFFER, linePositions, gl.STATIC_DRAW);

		lineColorBufferObject = gl.createBuffer();
		lineColorBufferObject.itemSize = 4;
		lineColorBufferObject.numItems = vertexCount;
		gl.bindBuffer(gl.ARRAY_BUFFER, lineColorBufferObject);
		gl.bufferData(gl.ARRAY_BUFFER, lineColors, gl.STATIC_DRAW);

	}


	function uploadColors(data) {

		// try to autodetect dimensions and create scales
		if (!__.dimensions.length) pc.detectDimensions();
		if (!(__.dimensions[0] in yscale)) pc.autoscale();

		// shortcut
		var p = difference(__.dimensions, __.hideAxis);

		var sampleCount = data.length;
		var dimCount = p.length;
		var vertexCount = dimCount * sampleCount;

		lineColors = new Float32Array(vertexCount * 4);

		// color
		j = 0;
		data.forEach(function(x) {
			var color = d3.rgb(d3.functor(__.color)(x));
			for (var d = 0; d < dimCount; d++) {
				lineColors.set([color.r/255.0, color.g/255.0, color.b/255.0, 1.0], j);
				j += 4;
			}
		});

		lineColorBufferObject = gl.createBuffer();
		lineColorBufferObject.itemSize = 4;
		lineColorBufferObject.numItems = vertexCount;
		gl.bindBuffer(gl.ARRAY_BUFFER, lineColorBufferObject);
		gl.bufferData(gl.ARRAY_BUFFER, lineColors, gl.STATIC_DRAW);

	}

	function index(row, col) {
		return row * __.dimensions.length + col;
	}

	function checkError() {
		var error = gl.getError();

		if (error) {
			throw ("GLerror: " + error);
		}
	}

//	convert color in hex (#RRGGBB) to an array with alpha = 1 ([R,G,B,1]),
//	where each color is in [0,1]
	function hexToRgb(hex) {
		var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		return result ? [parseInt(result[1], 16) / 255.0, parseInt(result[2], 16) / 255.0, parseInt(result[3], 16) / 255.0, 1.0] : null;
	}

	function difference(arr, others) {
		return arr.filter(function(elem) { return others.indexOf(elem) === -1; })
	};

	function setupShaders() {
		/* Configure shaders */

		var vertexShader = loadShader(shaders.LINES_VS, gl.VERTEX_SHADER);
		var fragmentShader = loadShader(shaders.LINES_FS, gl.FRAGMENT_SHADER);

		// Create a program object and store the handle to it.
		lineShader = linkProgram(vertexShader, fragmentShader);

		lineShader.positionAttribute = gl.getAttribLocation(lineShader, "vertex");
		lineShader.colorAttribute = gl.getAttribLocation(lineShader, "color");
		lineShader.mvpMatrixUniform = gl.getUniformLocation(lineShader, "uMVPMatrix");

		vertexShader = loadShader(shaders.SPLATS_VS, gl.VERTEX_SHADER);
		fragmentShader = loadShader(shaders.SPLATS_FS, gl.FRAGMENT_SHADER);

		// Create a program object and store the handle to it.
		splatShader = linkProgram(vertexShader, fragmentShader);

		splatShader.positionAttribute = gl.getAttribLocation(splatShader, "vertex");
		splatShader.colorAttribute = gl.getAttribLocation(splatShader, "color");
		splatShader.densityAttribute = gl.getAttribLocation(splatShader, "v_texture");	
		splatShader.mvpMatrixUniform = gl.getUniformLocation(splatShader, "uMVPMatrix");
		splatShader.variance = gl.getUniformLocation(splatShader, "var");
		splatShader.normalize = gl.getUniformLocation(splatShader, "normalize");

		// FBO Shader
		vertexShader = loadShader(shaders.FBO_VS, gl.VERTEX_SHADER);
		fragmentShader = loadShader(shaders.FBO_FS, gl.FRAGMENT_SHADER);

		fboShader = linkProgram(vertexShader, fragmentShader);

		fboShader.vertex = gl.getAttribLocation(fboShader, "vertex");
		fboShader.texture = gl.getUniformLocation(fboShader, "texture");
		fboShader.min = gl.getUniformLocation(fboShader, "min");
		fboShader.max = gl.getUniformLocation(fboShader, "max");

		vertexShader = loadShader(shaders.FBO_VS, gl.VERTEX_SHADER);
		fragmentShader = loadShader(shaders.ENCODE_FS, gl.FRAGMENT_SHADER);

		encodeShader = linkProgram(vertexShader, fragmentShader);
		encodeShader.vertex = gl.getAttribLocation(encodeShader, "vertex");	
		encodeShader.texture = gl.getUniformLocation(encodeShader, "texture");	
	}

//	Helper function to link a program
	function linkProgram(vertexShader, fragmentShader) {
		// Create a program object and store the handle to it.
		var programHandle = gl.createProgram();

		if (programHandle != 0) {
			// Bind the vertex shader to the program.
			gl.attachShader(programHandle, vertexShader);

			// Bind the fragment shader to the program.
			gl.attachShader(programHandle, fragmentShader);

			// Link the two shaders together into a program.
			gl.linkProgram(programHandle);

			// Get the link status.
			var linked = gl.getProgramParameter(programHandle, gl.LINK_STATUS);

			// If the link failed, delete the program.
			if (!linked) {
				gl.deleteProgram(programHandle);
				programHandle = 0;
			}
		}

		if (programHandle == 0) {
			throw ("Error creating program.");
		}

		return programHandle;
	}

//	Helper function to load a shader
	function loadShader(shaderSource, type) {
		var shaderHandle = gl.createShader(type);
		var error;

		if (shaderHandle != 0) {

			if (!shaderSource) {
				throw ("Error: shader script not found");
			}

			// Pass in the shader source.
			gl.shaderSource(shaderHandle, shaderSource);

			// Compile the shader.
			gl.compileShader(shaderHandle);

			// Get the compilation status.
			var compiled = gl.getShaderParameter(shaderHandle, gl.COMPILE_STATUS);

			// If the compilation failed, delete the shader.
			if (!compiled) {
				error = gl.getShaderInfoLog(shaderHandle);
				gl.deleteShader(shaderHandle);
				shaderHandle = 0;
			}
		}

		if (shaderHandle == 0) {
			throw ("Error creating shader: " + error);
		}

		return shaderHandle;
	}

	shaders.SPLATS_VS = '\n\
		precision highp float;\n\
		\n\
		attribute vec4 vertex;\n\
		attribute vec3 v_texture;\n\
		attribute vec4 color;\n\
		\n\
		uniform mat4 uMVPMatrix;\n\
		\n\
		varying vec3 f_texture;\n\
		varying vec4 f_color;\n\
		\n\
		void main(void) {\n\
		gl_Position = uMVPMatrix * vec4(vertex.xy, 0.0, 1.0);\n\
		f_texture = v_texture;\n\
		f_color = color;\n\
		}';

	shaders.SPLATS_FS = '\n\
		precision highp float;\n\
		const float pi = 3.14159265;\n\
		uniform float var;\n\
		uniform int normalize;\n\
		varying vec3 f_texture;\n\
		varying vec4 f_color;\n\
		\n\
		void main(void)	{\n\
		float a = f_texture.x;\n\
		float b = f_texture.y;\n\
		float mu = f_texture.z;\n\
		float sd = var * var;\n\
		float sigma = pow(1.0 - a, 2.0) * sd + pow(a, 2.0) * sd;\n\
		float density = 1.0/sqrt(2.0*pi*sigma) * exp(-pow(b-mu,2.0)/(2.0*sigma));\n\
		if (normalize == 0) {\n\
		density = density * f_color.a;\n\
		gl_FragColor = vec4(f_color.r, f_color.g, f_color.b, density);\n\
		} else {\n\
		gl_FragColor = vec4(density);// * density;\n\
		}\n\
		//gl_FragColor = f_color.rgba;\n\
		}';

	shaders.LINES_VS = '\n\
		precision mediump float;\n\
		\n\
		attribute vec4 vertex;\n\
		attribute vec4 color;\n\
		varying vec4 f_color;\n\
		uniform mat4 uMVPMatrix;\n\
		\n\
		void main(void) {\n\
		gl_Position = uMVPMatrix * vec4(vertex.xy, 0.0, 1.0);\n\
		f_color = color;\n\
		}';

	shaders.LINES_FS = '\n\
		precision mediump float;\n\
		varying vec4 f_color;\n\
		\n\
		void main(void)	{\n\
		gl_FragColor = f_color.rgba;\n\
		}';

	shaders.FBO_VS = '\n\
		precision highp float;\n\
		attribute vec4 vertex;\n\
		varying vec2 coord;\n\
		void main() {\n\
		coord = vertex.xy * 0.5 + 0.5;\n\
		gl_Position = vec4(vertex.xyz, 1.0);\n\
		}';

	shaders.FBO_FS = '\n\
		precision highp float;\n\
		varying vec2 coord;\n\
		uniform sampler2D texture;\n\
		uniform float min;\n\
		uniform float max;\n\
		\n\
		void main(void)	{\n\
		vec4 data = texture2D(texture, coord);\n\
		gl_FragColor = vec4( 1.0 - (data.r-min)/(max-min) );\n\
		}';

//	inspired by: http://concord-consortium.github.io/lab/experiments/webgl-gpgpu/script.js
	shaders.ENCODE_FS = '\
		precision highp float;\n\
		uniform sampler2D texture;\
		varying vec2 coord;\
		float shift_right(float v, float amt) {\
		v = floor(v) + 0.5;\
		return floor(v / exp2(amt));\
		}\
		float shift_left(float v, float amt) {\
		return floor(v * exp2(amt) + 0.5);\
		}\
		\
		float mask_last(float v, float bits) {\
		return mod(v, shift_left(1.0, bits));\
		}\
		float extract_bits(float num, float from, float to) {\
		from = floor(from + 0.5);\
		to = floor(to + 0.5);\
		return mask_last(shift_right(num, from), to - from);\
		}\
		vec4 encode_float(float val) {\
		if (val == 0.0)\
		return vec4(0, 0, 0, 0);\
		float sign = val > 0.0 ? 0.0 : 1.0;\
		val = abs(val);\
		float exponent = floor(log2(val));\
		float biased_exponent = exponent + 127.0;\
		float fraction = ((val / exp2(exponent)) - 1.0) * 8388608.0;\
		\
		float t = biased_exponent / 2.0;\
		float last_bit_of_biased_exponent = fract(t) * 2.0;\
		float remaining_bits_of_biased_exponent = floor(t);\
		\
		float byte4 = extract_bits(fraction, 0.0, 8.0) / 255.0;\
		float byte3 = extract_bits(fraction, 8.0, 16.0) / 255.0;\
		float byte2 = (last_bit_of_biased_exponent * 128.0 + extract_bits(fraction, 16.0, 23.0)) / 255.0;\
		float byte1 = (sign * 128.0 + remaining_bits_of_biased_exponent) / 255.0;\
		return vec4(byte4, byte3, byte2, byte1);\
		}\
		void main() {\
		vec4 data = texture2D(texture, coord);\
		gl_FragColor = encode_float(data.r);\
		}\
		';

	renderer.types["webgl"] = {
			install: install,
			resize: resize,
			uninstall: uninstall
	}

})();var events = d3.dispatch.apply(this,["render", "resize", "highlight", "brush", "brushend", "axesreorder"].concat(d3.keys(__))),
    w = function() { return __.width - __.margin.right - __.margin.left; },
    h = function() { return __.height - __.margin.top - __.margin.bottom; },
    flags = {
      brushable: false,
      reorderable: false,
      axes: false,
      interactive: false,
      shadows: false,
      debug: false,
      gl: false
    },
    xscale = d3.scale.ordinal(),
    yscale = {},
    dragging = {},
    line = d3.svg.line(),
    axis = d3.svg.axis().orient("left").ticks(5),
    g, // groups for axes, brushes
    canvas = {},
    clusterCentroids = [];

// side effects for setters
var side_effects = d3.dispatch.apply(this,d3.keys(__))
  .on("width", function(d) { pc.resize(); })
  .on("height", function(d) { pc.resize(); })
  .on("margin", function(d) { pc.resize(); })
  .on("data", function(d) {
    if (flags.shadows){pc.shadows();}
  })
  .on("dimensions", function(d) {
    xscale.domain(__.dimensions);
    if (flags.interactive){pc.render().updateAxes();}
  })
  .on("hideAxis", function(d) {
	  if (!__.dimensions.length) pc.detectDimensions();
	  pc.dimensions(without(__.dimensions, d.value));
  })
  .on("bundleDimension", function(d) {
	if (!__.dimensions.length) pc.detectDimensions();
	if (!(__.dimensions[0] in yscale)) pc.autoscale();
	if (typeof d.value === "number") {
		if (d.value < __.dimensions.length) {
			__.bundleDimension = __.dimensions[d.value];
		} else if (d.value < __.hideAxis.length) {
			__.bundleDimension = __.hideAxis[d.value];
		}
	} else {
		__.bundleDimension = d.value;
	}

	__.clusterCentroids = compute_cluster_centroids(__.bundleDimension);
  });

// expose the state of the chart
pc.state = __;
pc.flags = flags;

// create getter/setters
getset(pc, __, events, side_effects);

// expose events
d3.rebind(pc, events, "on");

// getter/setter with event firing
function getset(obj,state,events, side_effects)  {
  d3.keys(state).forEach(function(key) {
    obj[key] = function(x) {
      if (!arguments.length) {
		return state[key];
      }
      var old = state[key];
      state[key] = x;
      if (side_effects !== undefined) {
    	  side_effects[key].call(pc,{"value": x, "previous": old});
      }
      if (events !== undefined) {
    	  events[key].call(pc,{"value": x, "previous": old});
      }
      return obj;
    };
  });
};

function extend(target, source) {
  for (key in source) {
    target[key] = source[key];
  }
  return target;
};

function without(arr, item) {
  return arr.filter(function(elem) { return item.indexOf(elem) === -1; })
};
pc.autoscale = function() {
  // yscale
  var defaultScales = {
    "date": function(k) {
      var extent = d3.extent(__.data, function(d) {
        return d[k] ? d[k].getTime() : null;
      });

      // special case if single value
      if (extent[0] === extent[1]) {
        return d3.scale.ordinal()
          .domain([extent[0]])
          .rangePoints([h()+1, 1]);
      }

      return d3.time.scale()
        .domain(extent)
        .range([h()+1, 1]);
    },
    "number": function(k) {
      var extent = d3.extent(__.data, function(d) { return +d[k]; });

      // special case if single value
      if (extent[0] === extent[1]) {
        return d3.scale.ordinal()
          .domain([extent[0]])
          .rangePoints([h()+1, 1]);
      }

      return d3.scale.linear()
        .domain(extent)
        .range([h()+1, 1]);
    },
    "string": function(k) {
      var counts = {},
          domain = [];

      // Let's get the count for each value so that we can sort the domain based
      // on the number of items for each value.
      __.data.map(function(p) {
        if (counts[p[k]] === undefined) {
          counts[p[k]] = 1;
        } else {
          counts[p[k]] = counts[p[k]] + 1;
        }
      });

      domain = Object.getOwnPropertyNames(counts).sort(function(a, b) {
        return counts[a] - counts[b];
      });

      return d3.scale.ordinal()
        .domain(domain)
        .rangePoints([h()+1, 1]);
    }
  };

  __.dimensions.forEach(function(k) {
    yscale[k] = defaultScales[__.types[k]](k);
  });

  __.hideAxis.forEach(function(k) {
    yscale[k] = defaultScales[__.types[k]](k);
  });

  // xscale
  xscale.rangePoints([0, w()], 1);

  renderer.currentRenderer().resize();
  
  return this;
};

pc.scale = function(d, domain) {
	yscale[d].domain(domain);

	return this;
};

pc.flip = function(d) {
	//yscale[d].domain().reverse();					// does not work
	yscale[d].domain(yscale[d].domain().reverse()); // works

	return this;
};

pc.commonScale = function(global, type) {
	var t = type || "number";
	if (typeof global === 'undefined') {
		global = true;
	}

	// scales of the same type
	var scales = __.dimensions.concat(__.hideAxis).filter(function(p) {
		return __.types[p] == t;
	});

	if (global) {
		var extent = d3.extent(scales.map(function(p,i) {
				return yscale[p].domain();
			}).reduce(function(a,b) {
				return a.concat(b);
			}));

		scales.forEach(function(d) {
			yscale[d].domain(extent);
		});

	} else {
		scales.forEach(function(k) {
			yscale[k].domain(d3.extent(__.data, function(d) { return +d[k]; }));
		});
	}

	// update centroids
	if (__.bundleDimension !== null) {
		pc.bundleDimension(__.bundleDimension);
	}

	return this;
};
pc.detectDimensions = function() {
  pc.types(pc.detectDimensionTypes(__.data));
  pc.dimensions(d3.keys(pc.types()));
  return this;
};

// a better "typeof" from this post: http://stackoverflow.com/questions/7390426/better-way-to-get-type-of-a-javascript-variable
pc.toType = function(v) {
  return ({}).toString.call(v).match(/\s([a-zA-Z]+)/)[1].toLowerCase();
};

// try to coerce to number before returning type
pc.toTypeCoerceNumbers = function(v) {
  if ((parseFloat(v) == v) && (v != null)) {
	return "number";
}
  return pc.toType(v);
};

// attempt to determine types of each dimension based on first row of data
pc.detectDimensionTypes = function(data) {
  var types = {};
  d3.keys(data[0])
    .forEach(function(col) {
      types[col] = pc.toTypeCoerceNumbers(data[0][col]);
    });
  return types;
};
function compute_cluster_centroids(d) {

	var clusterCentroids = d3.map();
	var clusterCounts = d3.map();
	// determine clusterCounts
	__.data.forEach(function(row) {
		var scaled = yscale[d](row[d]);
		if (!clusterCounts.has(scaled)) {
			clusterCounts.set(scaled, 0);
		}
		var count = clusterCounts.get(scaled);
		clusterCounts.set(scaled, count + 1);
	});

	__.data.forEach(function(row) {
		__.dimensions.map(function(p, i) {
			var scaled = yscale[d](row[d]);
			if (!clusterCentroids.has(scaled)) {
				var map = d3.map();
				clusterCentroids.set(scaled, map);
			}
			if (!clusterCentroids.get(scaled).has(p)) {
				clusterCentroids.get(scaled).set(p, 0);
			}
			var value = clusterCentroids.get(scaled).get(p);
			value += yscale[p](row[p]) / clusterCounts.get(scaled);
			clusterCentroids.get(scaled).set(p, value);
		});
	});

	return clusterCentroids;

}

function compute_centroids(row) {
	var centroids = [];

	var p = __.dimensions;
	var cols = p.length;
	var a = 0.5;			// center between axes
	for (var i = 0; i < cols; ++i) {
		// centroids on 'real' axes
		var x = position(p[i]);
		var y = yscale[p[i]](row[p[i]]);
		centroids.push($V([x, y]));

		// centroids on 'virtual' axes
		if (i < cols - 1) {
			var cx = x + a * (position(p[i+1]) - x);
			var cy = y + a * (yscale[p[i+1]](row[p[i+1]]) - y);
			if (__.bundleDimension !== null) {
				var leftCentroid = __.clusterCentroids.get(yscale[__.bundleDimension](row[__.bundleDimension])).get(p[i]);
				var rightCentroid = __.clusterCentroids.get(yscale[__.bundleDimension](row[__.bundleDimension])).get(p[i+1]);
				var centroid = 0.5 * (leftCentroid + rightCentroid);
				cy = centroid + (1 - __.bundlingStrength) * (cy - centroid);
			}
			centroids.push($V([cx, cy]));
		}
	}

	return centroids;
}

function compute_control_points(centroids) {

	var cols = centroids.length;
	var a = __.smoothness;
	var cps = [];

	cps.push(centroids[0]);
	cps.push($V([centroids[0].e(1) + a*2*(centroids[1].e(1)-centroids[0].e(1)), centroids[0].e(2)]));
	for (var col = 1; col < cols - 1; ++col) {
		var mid = centroids[col];
		var left = centroids[col - 1];
		var right = centroids[col + 1];

		var diff = left.subtract(right);
		cps.push(mid.add(diff.x(a)));
		cps.push(mid);
		cps.push(mid.subtract(diff.x(a)));
	}
	cps.push($V([centroids[cols-1].e(1) + a*2*(centroids[cols-2].e(1)-centroids[cols-1].e(1)), centroids[cols-1].e(2)]));
	cps.push(centroids[cols - 1]);

	return cps;

};

pc.clear = function(layer) {
  return pc.renderer().clear(layer);
};
d3.rebind(pc, axis, "ticks", "orient", "tickValues", "tickSubdivide", "tickSize", "tickPadding", "tickFormat");

function flipAxisAndUpdatePCP(dimension) {
  var g = pc.svg.selectAll(".dimension");

  pc.flip(dimension);

  d3.select(this.parentElement)
    .transition()
      .duration(1100)
      .call(axis.scale(yscale[dimension]));

  pc.render();
  if (flags.shadows) pc.shadows();
}

function rotateLabels() {
  var delta = d3.event.deltaY;
  delta = delta < 0 ? -5 : delta;
  delta = delta > 0 ? 5 : delta;

  __.dimensionTitleRotation += delta;
  pc.svg.selectAll("text.label")
    .attr("transform", "translate(0,-5) rotate(" + __.dimensionTitleRotation + ")");
  d3.event.preventDefault();
}

function dimensionLabels(d) {
  return d in __.dimensionTitles ? __.dimensionTitles[d] : d;  // dimension display names
}

pc.createAxes = function() {
  if (g) pc.removeAxes();

  // Add a group element for each dimension.
  g = pc.svg.selectAll(".dimension")
      .data(__.dimensions, function(d) { return d; })
    .enter().append("svg:g")
      .attr("class", "dimension")
      .attr("transform", function(d) { return "translate(" + xscale(d) + ")"; });

  // Add an axis and title.
  g.append("svg:g")
      .attr("class", "axis")
      .attr("transform", "translate(0,0)")
      .each(function(d) { d3.select(this).call(axis.scale(yscale[d])); })
    .append("svg:text")
      .attr({
        "text-anchor": "middle",
        "y": 0,
        "transform": "translate(0,-5) rotate(" + __.dimensionTitleRotation + ")",
        "x": 0,
        "class": "label"
      })
      .text(dimensionLabels)
      .on("dblclick", flipAxisAndUpdatePCP)
      .on("wheel", rotateLabels);

  flags.axes= true;
  return this;
};

pc.removeAxes = function() {
  g.remove();
  return this;
};

pc.updateAxes = function() {
  var g_data = pc.svg.selectAll(".dimension").data(__.dimensions);

  // Enter
  g_data.enter().append("svg:g")
      .attr("class", "dimension")
      .attr("transform", function(p) { return "translate(" + position(p) + ")"; })
      .style("opacity", 0)
    .append("svg:g")
      .attr("class", "axis")
      .attr("transform", "translate(0,0)")
      .each(function(d) { d3.select(this).call(axis.scale(yscale[d])); })
    .append("svg:text")
      .attr({
        "text-anchor": "middle",
        "y": 0,
        "transform": "translate(0,-5) rotate(" + __.dimensionTitleRotation + ")",
        "x": 0,
        "class": "label"
      })
      .text(dimensionLabels)
      .on("dblclick", flipAxisAndUpdatePCP)
      .on("wheel", rotateLabels);

  // Update
  g_data.attr("opacity", 0);
  g_data.select(".axis")
    .transition()
      .duration(1100)
      .each(function(d) {
        d3.select(this).call(axis.scale(yscale[d]));
      });
  g_data.select(".label")
    .transition()
      .duration(1100)
      .text(dimensionLabels)
      .attr("transform", "translate(0,-5) rotate(" + __.dimensionTitleRotation + ")");

  // Exit
  g_data.exit().remove();

  g = pc.svg.selectAll(".dimension");
  g.transition().duration(1100)
    .attr("transform", function(p) { return "translate(" + position(p) + ")"; })
    .style("opacity", 1);

  pc.svg.selectAll(".axis")
    .transition()
      .duration(1100)
      .each(function(d) { d3.select(this).call(axis.scale(yscale[d])); });

  if (flags.shadows) pc.shadows();
  if (flags.brushable) pc.brushable();
  if (flags.reorderable) pc.reorderable();
  if (pc.brushMode() !== "None") {
    var mode = pc.brushMode();
    pc.brushMode("None");
    pc.brushMode(mode);
  }
  return this;
};

// Jason Davies, http://bl.ocks.org/1341281
pc.reorderable = function() {
  if (!g) pc.createAxes();

  g.style("cursor", "move")
    .call(d3.behavior.drag()
      .on("dragstart", function(d) {
        dragging[d] = this.__origin__ = xscale(d);
      })
      .on("drag", function(d) {
        dragging[d] = Math.min(w(), Math.max(0, this.__origin__ += d3.event.dx));
        __.dimensions.sort(function(a, b) { return position(a) - position(b); });
        xscale.domain(__.dimensions);
        pc.render();
        g.attr("transform", function(d) { return "translate(" + position(d) + ")"; });
      })
      .on("dragend", function(d) {
        // Let's see if the order has changed and send out an event if so.
        var i = 0,
            j = __.dimensions.indexOf(d),
            elem = this,
            parent = this.parentElement;

        while((elem = elem.previousElementSibling) != null) ++i;
        if (i !== j) {
          events.axesreorder.call(pc, __.dimensions);
          // We now also want to reorder the actual dom elements that represent
          // the axes. That is, the g.dimension elements. If we don't do this,
          // we get a weird and confusing transition when updateAxes is called.
          // This is due to the fact that, initially the nth g.dimension element
          // represents the nth axis. However, after a manual reordering,
          // without reordering the dom elements, the nth dom elements no longer
          // necessarily represents the nth axis.
          //
          // i is the original index of the dom element
          // j is the new index of the dom element
          if (i > j) { // Element moved left
            parent.insertBefore(this, parent.children[j - 1]);
          } else {     // Element moved right
            if ((j + 1) < parent.children.length) {
              parent.insertBefore(this, parent.children[j + 1]);
            } else {
              parent.appendChild(this);
            }
          }
        }

        delete this.__origin__;
        delete dragging[d];
        d3.select(this).transition().attr("transform", "translate(" + xscale(d) + ")");
        pc.render();
        if (flags.shadows) pc.shadows();
      }));
  flags.reorderable = true;
  return this;
};

// Reorder dimensions, such that the highest value (visually) is on the left and
// the lowest on the right. Visual values are determined by the data values in
// the given row.
pc.reorder = function(rowdata) {
  var dims = __.dimensions.slice(0);
  __.dimensions.sort(function(a, b) {
    return yscale[a](rowdata[a]) - yscale[b](rowdata[b]);
  });

  // NOTE: this is relatively cheap given that:
  // number of dimensions < number of data items
  // Thus we check equality of order to prevent rerendering when this is the case.
  var reordered = false;
  dims.some(function(val, index) {
    reordered = val !== __.dimensions[index];
    return reordered;
  });

  if (reordered) {
    xscale.domain(__.dimensions);
    var highlighted = __.highlighted.slice(0);
    pc.unhighlight();

    g.transition()
      .duration(1500)
      .attr("transform", function(d) {
        return "translate(" + xscale(d) + ")";
      });
    pc.render();

    // pc.highlight() does not check whether highlighted is length zero, so we do that here.
    if (highlighted.length !== 0) {
      pc.highlight(highlighted);
    }
  }
}

// pairs of adjacent dimensions
pc.adjacent_pairs = function(arr) {
  var ret = [];
  for (var i = 0; i < arr.length-1; i++) {
    ret.push([arr[i],arr[i+1]]);
  };
  return ret;
};

var brush = {
  modes: {
    "None": {
      install: function(pc) {},           // Nothing to be done.
      uninstall: function(pc) {},         // Nothing to be done.
      selected: function() { return []; } // Nothing to return
    }
  },
  mode: "None",
  predicate: "AND",
  currentMode: function() {
    return this.modes[this.mode];
  }
};

// This function can be used for 'live' updates of brushes. That is, during the
// specification of a brush, this method can be called to update the view.
//
// @param newSelection - The new set of data items that is currently contained
//                       by the brushes
function brushUpdated(newSelection) {
  __.brushed = newSelection;
  events.brush.call(pc,__.brushed);
  pc.render();
}

function brushPredicate(predicate) {
  if (!arguments.length) { return brush.predicate; }

  predicate = String(predicate).toUpperCase();
  if (predicate !== "AND" && predicate !== "OR") {
    throw "Invalid predicate " + predicate;
  }

  brush.predicate = predicate;
  __.brushed = brush.currentMode().selected();
  pc.render();
  return pc;
}

pc.brushModes = function() {
  return Object.getOwnPropertyNames(brush.modes);
};

pc.brushMode = function(mode) {
  if (arguments.length === 0) {
    return brush.mode;
  }

  if (pc.brushModes().indexOf(mode) === -1) {
    throw "pc.brushmode: Unsupported brush mode: " + mode;
  }

  // Make sure that we don't trigger unnecessary events by checking if the mode
  // actually changes.
  if (mode !== brush.mode) {
    // When changing brush modes, the first thing we need to do is clearing any
    // brushes from the current mode, if any.
    if (brush.mode !== "None") {
      pc.brushReset();
    }

    // Next, we need to 'uninstall' the current brushMode.
    brush.modes[brush.mode].uninstall(pc);
    // Finally, we can install the requested one.
    brush.mode = mode;
    brush.modes[brush.mode].install();
    if (mode === "None") {
      delete pc.brushPredicate;
    } else {
      pc.brushPredicate = brushPredicate;
    }
  }

  return pc;
};

// brush mode: 1D-Axes

(function() {
  var brushes = {};

  function is_brushed(p) {
    return !brushes[p].empty();
  }

  // data within extents
  function selected() {
    var actives = __.dimensions.filter(is_brushed),
        extents = actives.map(function(p) { return brushes[p].extent(); });

    // We don't want to return the full data set when there are no axes brushed.
    // Actually, when there are no axes brushed, by definition, no items are
    // selected. So, let's avoid the filtering and just return false.
    //if (actives.length === 0) return false;

    // Resolves broken examples for now. They expect to get the full dataset back from empty brushes
    if (actives.length === 0) return __.data;

    // test if within range
    var within = {
      "date": function(d,p,dimension) {
        return extents[dimension][0] <= d[p] && d[p] <= extents[dimension][1]
      },
      "number": function(d,p,dimension) {
        return extents[dimension][0] <= d[p] && d[p] <= extents[dimension][1]
      },
      "string": function(d,p,dimension) {
        return extents[dimension][0] <= yscale[p](d[p]) && yscale[p](d[p]) <= extents[dimension][1]
      }
    };

    return __.data
      .filter(function(d) {
        switch(brush.predicate) {
        case "AND":
          return actives.every(function(p, dimension) {
            return within[__.types[p]](d,p,dimension);
          });
        case "OR":
          return actives.some(function(p, dimension) {
            return within[__.types[p]](d,p,dimension);
          });
        default:
          throw "Unknown brush predicate " + __.brushPredicate;
        }
      });
  };

  function brushExtents() {
    var extents = {};
    __.dimensions.forEach(function(d) {
      var brush = brushes[d];
      if (!brush.empty()) {
        var extent = brush.extent();
        extent.sort(d3.ascending);
        extents[d] = extent;
      }
    });
    return extents;
  }

  function brushFor(axis) {
    var brush = d3.svg.brush();

    brush
      .y(yscale[axis])
      .on("brushstart", function() { d3.event.sourceEvent.stopPropagation() })
      .on("brush", function() {
        brushUpdated(selected());
      })
      .on("brushend", function() {
        events.brushend.call(pc, __.brushed);
      });

    brushes[axis] = brush;
    return brush;
  }

  function brushReset(dimension) {
    __.brushed = false;
    if (g) {
      g.selectAll('.brush')
        .each(function(d) {
          d3.select(this).call(
            brushes[d].clear()
          );
        });
      pc.render();
    }
    return this;
  };

  function install() {
    if (!g) pc.createAxes();

    // Add and store a brush for each axis.
    g.append("svg:g")
      .attr("class", "brush")
      .each(function(d) {
        d3.select(this).call(brushFor(d));
      })
      .selectAll("rect")
        .style("visibility", null)
        .attr("x", -15)
        .attr("width", 30);

    pc.brushExtents = brushExtents;
    pc.brushReset = brushReset;
    return pc;
  }

  brush.modes["1D-axes"] = {
    install: install,
    uninstall: function() {
      g.selectAll(".brush").remove();
      brushes = {};
      delete pc.brushExtents;
      delete pc.brushReset;
    },
    selected: selected
  }
})();
// brush mode: 2D-strums
// bl.ocks.org/syntagmatic/5441022

(function() {
  var strums = {},
      strumRect;

  function drawStrum(strum, activePoint) {
    var svg = pc.selection.select("svg").select("g#strums"),
        id = strum.dims.i,
        points = [strum.p1, strum.p2],
        line = svg.selectAll("line#strum-" + id).data([strum]),
        circles = svg.selectAll("circle#strum-" + id).data(points),
        drag = d3.behavior.drag();

    line.enter()
      .append("line")
      .attr("id", "strum-" + id)
      .attr("class", "strum");

    line
      .attr("x1", function(d) { return d.p1[0]; })
      .attr("y1", function(d) { return d.p1[1]; })
      .attr("x2", function(d) { return d.p2[0]; })
      .attr("y2", function(d) { return d.p2[1]; })
      .attr("stroke", "black")
      .attr("stroke-width", 2);

    drag
      .on("drag", function(d, i) { 
        var ev = d3.event;
        i = i + 1;
        strum["p" + i][0] = Math.min(Math.max(strum.minX + 1, ev.x), strum.maxX);
        strum["p" + i][1] = Math.min(Math.max(strum.minY, ev.y), strum.maxY);
        drawStrum(strum, i - 1);
      })
      .on("dragend", onDragEnd());

    circles.enter()
      .append("circle")
      .attr("id", "strum-" + id)
      .attr("class", "strum");

    circles
      .attr("cx", function(d) { return d[0]; })
      .attr("cy", function(d) { return d[1]; })
      .attr("r", 5)
      .style("opacity", function(d, i) {
        return (activePoint !== undefined && i === activePoint) ? 0.8 : 0;
      })
      .on("mouseover", function() {
        d3.select(this).style("opacity", 0.8);
      })
      .on("mouseout", function() {
        d3.select(this).style("opacity", 0);
      })
      .call(drag);
  }

  function dimensionsForPoint(p) {
    var dims = { i: -1, left: undefined, right: undefined };
    __.dimensions.some(function(dim, i) {
      if (xscale(dim) < p[0]) {
        var next = __.dimensions[i + 1];
        dims.i = i;
        dims.left = dim;
        dims.right = next;
        return false;
      }
      return true;
    });

    if (dims.left === undefined) {
      // Event on the left side of the first axis.
      dims.i = 0;
      dims.left = __.dimensions[0];
      dims.right = __.dimensions[1];
    } else if (dims.right === undefined) {
      // Event on the right side of the last axis
      dims.i = __.dimensions.length - 1;
      dims.right = dims.left;
      dims.left = __.dimensions[__.dimensions.length - 2];
    }

    return dims;
  }

  function onDragStart() {
    // First we need to determine between which two axes the sturm was started.
    // This will determine the freedom of movement, because a strum can
    // logically only happen between two axes, so no movement outside these axes
    // should be allowed.
    return function() {
      var p = d3.mouse(strumRect[0][0]),
          dims,
          strum;

      p[0] = p[0] - __.margin.left;
      p[1] = p[1] - __.margin.top;

      dims = dimensionsForPoint(p),
      strum = {
        p1: p,
        dims: dims,
        minX: xscale(dims.left),
        maxX: xscale(dims.right),
        minY: 0,
        maxY: h()
      };

      strums[dims.i] = strum;
      strums.active = dims.i;

      // Make sure that the point is within the bounds
      strum.p1[0] = Math.min(Math.max(strum.minX, p[0]), strum.maxX);
      strum.p2 = strum.p1.slice();
    };
  }

  function onDrag() {
    return function() {
      var ev = d3.event,
          strum = strums[strums.active];

      // Make sure that the point is within the bounds
      strum.p2[0] = Math.min(Math.max(strum.minX + 1, ev.x - __.margin.left), strum.maxX);
      strum.p2[1] = Math.min(Math.max(strum.minY, ev.y - __.margin.top), strum.maxY);
      drawStrum(strum, 1);
    };
  }

  function containmentTest(strum, width) {
    var p1 = [strum.p1[0] - strum.minX, strum.p1[1] - strum.minX],
        p2 = [strum.p2[0] - strum.minX, strum.p2[1] - strum.minX],
        m1 = 1 - width / p1[0],
        b1 = p1[1] * (1 - m1),
        m2 = 1 - width / p2[0],
        b2 = p2[1] * (1 - m2);

    // test if point falls between lines
    return function(p) {
      var x = p[0],
          y = p[1],
          y1 = m1 * x + b1,
          y2 = m2 * x + b2;

      if (y > Math.min(y1, y2) && y < Math.max(y1, y2)) {
        return true;
      }

      return false;
    };
  }

  function selected() {
    var ids = Object.getOwnPropertyNames(strums),
        brushed = __.data;

    // Get the ids of the currently active strums.
    ids = ids.filter(function(d) {
      return !isNaN(d);
    });

    function crossesStrum(d, id) {
      var strum = strums[id],
          test = containmentTest(strum, strums.width(id)),
          d1 = strum.dims.left,
          d2 = strum.dims.right,
          y1 = yscale[d1],
          y2 = yscale[d2],
          point = [y1(d[d1]) - strum.minX, y2(d[d2]) - strum.minX];
      return test(point);
    }

    if (ids.length === 0) { return brushed; }

    return brushed.filter(function(d) {
      switch(brush.predicate) {
      case "AND":
        return ids.every(function(id) { return crossesStrum(d, id); });
      case "OR":
        return ids.some(function(id) { return crossesStrum(d, id); });
      default:
        throw "Unknown brush predicate " + __.brushPredicate;
      }
    });
  }

  function removeStrum() {
    var strum = strums[strums.active],
        svg = pc.selection.select("svg").select("g#strums");

    delete strums[strums.active];
    strums.active = undefined;
    svg.selectAll("line#strum-" + strum.dims.i).remove();
    svg.selectAll("circle#strum-" + strum.dims.i).remove();
  }

  function onDragEnd() {
    return function() {
      var brushed = __.data,
          strum = strums[strums.active];

      // Okay, somewhat unexpected, but not totally unsurprising, a mousclick is
      // considered a drag without move. So we have to deal with that case
      if (strum && strum.p1[0] === strum.p2[0] && strum.p1[1] === strum.p2[1]) {
        removeStrum(strums);
      }

      brushed = selected(strums);
      strums.active = undefined;
      __.brushed = brushed;
      pc.render();
      events.brushend.call(pc, __.brushed);
    };
  }

  function brushReset(strums) {
    return function() {
      var ids = Object.getOwnPropertyNames(strums).filter(function(d) {
        return !isNaN(d);
      });

      ids.forEach(function(d) {
        strums.active = d;
        removeStrum(strums);
      });
      onDragEnd(strums)();
    };
  }

  function install() {
    var drag = d3.behavior.drag();

    // Map of current strums. Strums are stored per segment of the PC. A segment,
    // being the area between two axes. The left most area is indexed at 0.
    strums.active = undefined;
    // Returns the width of the PC segment where currently a strum is being
    // placed. NOTE: even though they are evenly spaced in our current
    // implementation, we keep for when non-even spaced segments are supported as
    // well.
    strums.width = function(id) {
      var strum = strums[id];

      if (strum === undefined) {
        return undefined;
      }

      return strum.maxX - strum.minX;
    };

//    pc.on("axesreorder.strums", function() {
//      var ids = Object.getOwnPropertyNames(strums).filter(function(d) {
//        return !isNaN(d);
//      });
//
//      // Checks if the first dimension is directly left of the second dimension.
//      function consecutive(first, second) {
//        var length = __.dimensions.length;
//        return __.dimensions.some(function(d, i) {
//          return (d === first)
//            ? i + i < length && __.dimensions[i + 1] === second
//            : false;
//        });
//      }
//
//      if (ids.length > 0) { // We have some strums, which might need to be removed.
//        ids.forEach(function(d) {
//          var dims = strums[d].dims;
//          strums.active = d;
//          // If the two dimensions of the current strum are not next to each other
//          // any more, than we'll need to remove the strum. Otherwise we keep it.
//          if (!consecutive(dims.left, dims.right)) {
//            removeStrum(strums);
//          }
//        });
//        onDragEnd(strums)();
//      }
//    });

    // Add a new svg group in which we draw the strums.
    pc.selection.select("svg").append("g")
      .attr("id", "strums")
      .attr("transform", "translate(" + __.margin.left + "," + __.margin.top + ")");

    // Install the required brushReset function
    pc.brushReset = brushReset(strums);

    drag
      .on("dragstart", onDragStart(strums))
      .on("drag", onDrag(strums))
      .on("dragend", onDragEnd(strums));

    // NOTE: The styling needs to be done here and not in the css. This is because
    //       for 1D brushing, the canvas layers should not listen to
    //       pointer-events.
    strumRect = pc.selection.select("svg").insert("rect", "g#strums")
      .attr("id", "strum-events")
      .attr("x", __.margin.left)
      .attr("y", __.margin.top)
      .attr("width", w())
      .attr("height", h() + 2)
      .style("opacity", 0)
      .call(drag);
  }

  brush.modes["2D-strums"] = {
    install: install,
    uninstall: function() {
      pc.selection.select("svg").select("g#strums").remove();
      pc.selection.select("svg").select("rect#strum-events").remove();
      pc.on("axesreorder.strums", undefined);
      delete pc.brushReset;

      strumRect = undefined;
    },
    selected: selected
  };

}());

// brush mode: 1D-Axes with multiple extents
// requires d3.svg.multibrush

(function() {
  if (typeof d3.svg.multibrush !== 'function') {
	  return;
  }
  var brushes = {};

  function is_brushed(p) {
    return !brushes[p].empty();
  }

  // data within extents
  function selected() {
    var actives = __.dimensions.filter(is_brushed),
        extents = actives.map(function(p) { return brushes[p].extent(); });

    // We don't want to return the full data set when there are no axes brushed.
    // Actually, when there are no axes brushed, by definition, no items are
    // selected. So, let's avoid the filtering and just return false.
    //if (actives.length === 0) return false;

    // Resolves broken examples for now. They expect to get the full dataset back from empty brushes
    if (actives.length === 0) return __.data;

    // test if within range
    var within = {
      "date": function(d,p,dimension,b) {
        return b[0] <= d[p] && d[p] <= b[1]
      },
      "number": function(d,p,dimension,b) {
        return b[0] <= d[p] && d[p] <= b[1]
      },
      "string": function(d,p,dimension,b) {
        return b[0] <= yscale[p](d[p]) && yscale[p](d[p]) <= b[1]
      }
    };

    return __.data
    .filter(function(d) {
      switch(brush.predicate) {
      case "AND":
        return actives.every(function(p, dimension) {
          return extents[dimension].some(function(b) {
          	return within[__.types[p]](d,p,dimension,b);
          });
        });
      case "OR":
        return actives.some(function(p, dimension) {
      	  return extents[dimension].some(function(b) {
            	return within[__.types[p]](d,p,dimension,b);
            });
        });
      default:
        throw "Unknown brush predicate " + __.brushPredicate;
      }
    });
  };

  function brushExtents() {
    var extents = {};
    __.dimensions.forEach(function(d) {
      var brush = brushes[d];
      if (!brush.empty()) {
        var extent = brush.extent();
        extents[d] = extent;
      }
    });
    return extents;
  }

  function brushFor(axis) {
    var brush = d3.svg.multibrush();

    brush
      .y(yscale[axis])
      .on("brushstart", function() { d3.event.sourceEvent.stopPropagation() })
      .on("brush", function() {
        brushUpdated(selected());
      })
      .on("brushend", function() {
    	// d3.svg.multibrush clears extents just before calling 'brushend'
    	// so we have to update here again.
    	// This fixes issue #103 for now, but should be changed in d3.svg.multibrush
    	// to avoid unnecessary computation.
    	brushUpdated(selected());
        events.brushend.call(pc, __.brushed);
      })
      .extentAdaption(function(selection) {
    	  selection
    	  .style("visibility", null)
          .attr("x", -15)
          .attr("width", 30);
      })
      .resizeAdaption(function(selection) {
    	 selection
    	   .selectAll("rect")
    	   .attr("x", -15)
    	   .attr("width", 30);
      });

    brushes[axis] = brush;
    return brush;
  }

  function brushReset(dimension) {
    __.brushed = false;
    if (g) {
      g.selectAll('.brush')
        .each(function(d) {
          d3.select(this).call(
            brushes[d].clear()
          );
        });
      pc.render();
    }
    return this;
  };

  function install() {
    if (!g) pc.createAxes();

    // Add and store a brush for each axis.
    g.append("svg:g")
      .attr("class", "brush")
      .each(function(d) {
        d3.select(this).call(brushFor(d));
      })
      .selectAll("rect")
        .style("visibility", null)
        .attr("x", -15)
        .attr("width", 30);

    pc.brushExtents = brushExtents;
    pc.brushReset = brushReset;
    return pc;
  }

  brush.modes["1D-axes-multi"] = {
    install: install,
    uninstall: function() {
      g.selectAll(".brush").remove();
      brushes = {};
      delete pc.brushExtents;
      delete pc.brushReset;
    },
    selected: selected
  }
})();
pc.interactive = function() {
  flags.interactive = true;
  return this;
};

// expose a few objects
pc.xscale = xscale;
pc.yscale = yscale;
//pc.ctx = ctx;
pc.canvas = canvas;
pc.g = function() { return g; };

// rescale for height, width and margins
// TODO currently assumes chart is brushable, and destroys old brushes
pc.resize = function() {
  // selection size
  pc.selection.select("svg")
    .attr("width", __.width)
    .attr("height", __.height)
  pc.svg.attr("transform", "translate(" + __.margin.left + "," + __.margin.top + ")");

  // FIXME: the current brush state should pass through
  if (flags.brushable) pc.brushReset();

  // scales
  pc.autoscale();

  // axes, destroys old brushes.
  if (g) pc.createAxes();
  if (flags.shadows) pc.shadows();
  if (flags.brushable) pc.brushable();
  if (flags.reorderable) pc.reorderable();

  events.resize.call(this, {width: __.width, height: __.height, margin: __.margin});
  return this;
};

// highlight an array of data
pc.highlight = function(data) {
  if (arguments.length === 0) {
    return __.highlighted;
  }

  __.highlighted = data;
  pc.clear("highlight");
  d3.select(canvas.foreground).classed("faded", true);
  data.forEach(path_highlight);
  events.highlight.call(this, data);
  return this;
};

// clear highlighting
pc.unhighlight = function() {
  __.highlighted = [];
  pc.clear("highlight");
  d3.select(canvas.foreground).classed("faded", false);
  return this;
};

// calculate 2d intersection of line a->b with line c->d
// points are objects with x and y properties
pc.intersection =  function(a, b, c, d) {
  return {
    x: ((a.x * b.y - a.y * b.x) * (c.x - d.x) - (a.x - b.x) * (c.x * d.y - c.y * d.x)) / ((a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x)),
    y: ((a.x * b.y - a.y * b.x) * (c.y - d.y) - (a.y - b.y) * (c.x * d.y - c.y * d.x)) / ((a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x))
  };
};

function position(d) {
  var v = dragging[d];
  return v == null ? xscale(d) : v;
}
pc.version = "0.6.0";
  // this descriptive text should live with other introspective methods
  pc.toString = function() { return "Parallel Coordinates: " + __.dimensions.length + " dimensions (" + d3.keys(__.data[0]).length + " total) , " + __.data.length + " rows"; };

  return pc;
};

d3.renderQueue = (function(func) {
  var _queue = [],                  // data to be rendered
      _rate = 10,                   // number of calls per frame
      _clear = function() {},       // clearing function
      _i = 0;                       // current iteration

  var rq = function(data) {
    if (data) rq.data(data);
    rq.invalidate();
    _clear();
    rq.render();
  };

  rq.render = function() {
    _i = 0;
    var valid = true;
    rq.invalidate = function() { valid = false; };

    function doFrame() {
      if (!valid) return true;
      if (_i > _queue.length) return true;

      // Typical d3 behavior is to pass a data item *and* its index. As the
      // render queue splits the original data set, we'll have to be slightly
      // more carefull about passing the correct index with the data item.
      var end = Math.min(_i + _rate, _queue.length);
      for (var i = _i; i < end; i++) {
        func(_queue[i], i);
      }
      _i += _rate;
    }

    d3.timer(doFrame);
  };

  rq.data = function(data) {
    rq.invalidate();
    _queue = data.slice(0);
    return rq;
  };

  rq.rate = function(value) {
    if (!arguments.length) return _rate;
    _rate = value;
    return rq;
  };

  rq.remaining = function() {
    return _queue.length - _i;
  };

  // clear the canvas
  rq.clear = function(func) {
    if (!arguments.length) {
      _clear();
      return rq;
    }
    _clear = func;
    return rq;
  };

  rq.invalidate = function() {};

  return rq;
});
