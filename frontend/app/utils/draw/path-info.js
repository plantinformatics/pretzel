import {
  once,
  later,
  debounce,
  bind,
} from '@ember/runloop';

import curry from 'lodash/curry';

import $ from 'jquery';

//------------------------------------------------------------------------------

/* global d3 */

//------------------------------------------------------------------------------

import {
  Stack,
} from '../stacks';

import { PathDataUtils } from './path-data';
import { PathClasses } from './path-classes';

//------------------------------------------------------------------------------


const dLog = console.debug;

//------------------------------------------------------------------------------

/** toolTip could be in a component; there is only 1 because user has 1 cursor,
 * so global variable in a library is ok,
 * transition to a local singleton variable in place of oa.toolTip
 */

let toolTipHovered = false;


function PathInfo(oa) {

  const pathDataUtils = oa && PathDataUtils(oa);

  const result = {
    toolTip : oa.toolTip,
    setupToolTip,
    setupMouseHover, 
    toolTipMouseOver, 
    toolTipMouseOut, 
    closeToolTip, 
    setupToolTipMouseHover, 
    handleMouseOver, 
    hidePathHoverToolTip, 
    handleMouseOut,     
  };

  function setupToolTip() {
    const
    svgRoot = oa.svgRoot;
    // Setup the path hover tool tip.
    let toolTipCreated = ! oa.toolTip;
    let toolTip = oa.toolTip || (oa.toolTip = this.toolTip =
      d3.tip()
        .attr("class", "toolTip d3-tip")
        .attr("id","toolTip")
    );
    if (toolTipCreated)
    {
      const me = oa.eventBus;
      me.ensureValue("toolTipCreated", /*toolTipCreated*/ true);
    }
    toolTip.offset([-15,0]);
    svgRoot.call(toolTip);
  }

  //d3.selectAll(".foreground > g > g").selectAll("path")
  /* (Don, 2017Mar03) my reading of handleMouse{Over,Out}() is that they are
   * intended only for the paths connecting features in adjacent Axes, not
   * e.g. the path in the y axis. So I have narrowed the selector to exclude
   * the axis path.  More exactly, these are the paths to include and exclude,
   * respectively :
   *   svgContainer > g.foreground > g.flowName > g.<featureName> >  path
   *   svgContainer > g.stack > g.axis-outer > g.axis#<axisEltId(axisName)> > path    (axisEltId() prepends "a"))
   * (axisName is e.g. 58b504ef5230723e534cd35c_MyChr).
   * This matters because axis path does not have data (observed issue : a
   * call to handleMouseOver() with d===null; reproduced by brushing a region
   * on an axis then moving cursor over that axis).
   */
  setupMouseHover(
    d3.selectAll(".foreground > g > g > path")
  );

  /** Setup the functions handleMouse{Over,Out}() on events mouse{over,out}
   * on elements in the given selection.
   * The selected path elements are assumed to have __data__ which is either
   * sLine (svg line text) which identifies the hover text, or ffaa data
   * which enables hover text to be calculated.
   * @param pathSelection	<path> elements
   */
  function setupMouseHover(pathSelection)
  {
    pathSelection
      .on("mouseover", curry(handleMouseOver)(this))
      .on("mouseout", curry(handleMouseOut)(this));
  }

  function toolTipMouseOver()
  {
    console.log("toolTipMouseOver", toolTipHovered);
    if (! toolTipHovered)
      toolTipHovered = true;
  }
  /**
   * @param this is PathInfo
   */
  function toolTipMouseOut()
  {
    console.log("toolTipMouseOut", toolTipHovered);
    if (toolTipHovered)
      toolTipHovered = false;
    this.hidePathHoverToolTip();
  }
  /**
   * @param this is PathInfo
   */
  function closeToolTip() 
  {
    console.log("draw-map closeToolTip");
    toolTipHovered = false;
    this.hidePathHoverToolTip();
  }
  /**
   * @param this is PathInfo
   */
  function setupToolTipMouseHover()
  {
    // may need to set toolTipHovered if toolTip already contains cursor when it is shown - will toolTipMouseOver() occur ?.
    // toolTipHovered = true;

    d3.select("div.toolTip.d3-tip#toolTip")
      .on("mouseover", toolTipMouseOver)
      .on("mouseout", toolTipMouseOut.apply(this));

    $("div.toolTip.d3-tip#toolTip button#toolTipClose")
      .on("click", closeToolTip.apply(this));
  }


  /**
   * @param d   SVG path data string of path
   * @param this  path element
   */
  function handleMouseOver(pathInfo, d, i){
    const fnName = 'handleMouseOver';
    let sLine, pathFeaturesHash;
    let pathFeatures = oa.pathFeatures;
    let hoverFeatures;
    /** d is either sLine (pathDataIsLine===true) or array ffaa. */
    let pathDataIsLine = typeof(d) === "string";
    // don't interrupt dragging with pathHover
    if (Stack.currentDrag || ! oa.drawOptions.showPathHover)
      return;
    if (pathDataIsLine)
    {
      pathFeaturesHash = pathFeatures[d];
      hoverFeatures = Object.keys(pathFeaturesHash);
      console.log("hoverFeatures 1", hoverFeatures);
    }
    else
    {
      sLine = this.getAttribute("d");
      pathFeaturesHash = pathFeatures[sLine];
      if ((pathFeaturesHash === undefined) && ! pathDataIsLine)
      {
        let ffaa = pathDataUtils.dataOfPath(this),
            syntenyEvidence = ffaa[Symbol.for('syntenyEvidence')];
        if (syntenyEvidence) {
          /** show path-data syntenyEvidence in console when mouse hover.
           * Enable this via drawOptions : showPathHover : true
           */
          console.log(fnName, 'syntenyEvidence', syntenyEvidence);
          // return;
        }
        let
        featureNames, features;
        if (Array.isArray(ffaa)) {
          const [feature0, feature1, a0, a1] = ffaa;
          [featureNames[0], featureNames[1]] = [feature0, feature1];
          let z = oa.z;
          [features[0], features[1]] = [z[a0.axisName][feature0], z[a1.axisName][feature1]];
        } else {
          features = ffaa.alignment.mapBy('repeats.features.0');
          featureNames = features.mapBy('name');
        }
        let direction, aliasGroupName;
        if (ffaa.length == 6)
        {
          direction = ffaa[4];
          aliasGroupName = ffaa[5];
        }
        pathDataUtils.pathFeatureStore(sLine, featureNames[0], featureNames[1], features[0], features[1], aliasGroupName);
        pathFeaturesHash = pathFeatures[sLine];
      }
      // can also append the list of aliases of the 2 features
      hoverFeatures = Object.keys(pathFeaturesHash)
        .reduce(function(all, a){
          // console.log(all, a, a.split(','));
          return  all.concat(a.split(","));
        }, []);
      console.log("hoverFeatures 2,3", hoverFeatures);
    }
    const pathClasses = PathClasses(oa);
    /** pathClasses uses this datum instead of d.  */
    let classSet = pathClasses.pathClasses(this, d), classSetText;
    if (classSet)
    {
      if (typeof classSet == "string")
      {
        console.log(this, d, classSet, classSetText);
        classSetText = "<br />" + classSet;
      }
      else if (classSet.size && classSet.size > 0)
      {
        classSet.forEach(function (className) {
          console.log(className);
          classSetText = "<br />" + className;
        });
      }
    }

    // console.log(d, featureNameOfData(d), sLine, pathFeaturesHash);
    let listFeatures  = "";
    // stroke attributes of this are changed via css rule for path.hovered
    d3.select(this)
      .classed("hovered", true);
    Object.keys(pathFeaturesHash).map(function(a){
      let hoverExtraText = pathFeaturesHash[a];
      if (hoverExtraText === 1) hoverExtraText = "";
      else if (classSetText) hoverExtraText += classSetText;
      listFeatures = listFeatures + a + hoverExtraText + "<br />";
    });

    let hoveredPath = this;
    const toolTip = pathInfo.toolTip;
    toolTip.offset(function() {
      return [hoveredPath.getBBox().height / 2, 0];
    });

    /** If path-hover currently exists in toolTip, avoid insert error by detaching it while updating html of parent toolTip */
    let
      pt=$('.toolTip.d3-tip#toolTip'),
    ph = pt.find('.pathHover');
    console.log(pt[0], "pathHover:", ph[0] || ph.length);
    if (ph.length)
    {
      console.log("pathHover detaching");
    }
    let
      ph1=ph.detach();

    listFeatures += '\n<button id="toolTipClose">&#x2573;</button>\n'; // ╳
    toolTip.html(listFeatures);

    toolTip.show(d, i);

    let ph2=ph1.appendTo(pt);
    const me = oa.eventBus;
    once(function() {
      let ph3= $('.pathHover');
      console.log(".pathHover", ph2[0] || ph2.length, ph3[0] || ph3.length);
      me.set("hoverFeatures", hoverFeatures);
      // me.ensureValue("pathHovered", true);
      me.trigger("pathHovered", true, hoverFeatures);
    });
    later(pathInfo, pathInfo.setupToolTipMouseHover, 1000);
  }

  /**
   * @param this is PathInfo
   */
  function hidePathHoverToolTip() {
    console.log("hidePathHoverToolTip", toolTipHovered);
    debounce(this, function () {
    if (! toolTipHovered)
    {
      this.toolTip.hide();
      const me = oa.eventBus;
      // me.ensureValue("pathHovered", false);
      me.trigger("pathHovered", false);
    }
    }, 1000);
  }

  /**
   * @param this  path element
   */
  function handleMouseOut(pathInfo, d){
    // stroke attributes of this revert to default, as hover ends
    d3.select(this)
      .classed("hovered", false);
    debounce(pathInfo, hidePathHoverToolTip, 2000);
  }

  return result;
}

//------------------------------------------------------------------------------

export {
  PathInfo,
};
