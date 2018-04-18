
;;------------------------------------------------------------------------------

;; Change variable names marker -> feature in draw-maps.js and the files being split out of draw-map.js
;; also rename ap -> axis  (may some cases should be axes)
;; ag -> aliasGroup
;; expand abbreviated names - see input_list below

;; The intention is that this function, marker_feature_rename, can be used to
;; map between commits before and after this renaming.  In practice, although
;; this function accounts for almost all of the differences in the renaming
;; commit, there are some exceptions and manual edits :
;; . m is not mapped to f in drawPromisedChr() and dataObserver(), because there it stands for map not marker
;;
;; . some minor edits were done during testing : import axisRedrawText from utils/stacks.js, move x() to utils/stacks.js

;; ap is renamed to axis, except the DOM element class .ap which is renamed to
;; .axis-outer.

;;------------------------------------------------------------------------------
;; The following commands were used to apply this edit to the source files, and
;; after some manual editing, a fresh worktree was checked out and processed
;; again to check that marker_feature_rename accounted for all the edits which
;; could be automated.
;; 
;; function dm_edit_each() {
;; for i in $*; do echo $i;   emacs --batch --load $pA/tools/marker_feature_rename.el --file $i  --funcall marker_feature_rename -f  save-buffer; done
;; }
;; function dm_edit_each_p() {
;; dm_edit_each  $* |& perl -0777 -pe 'undef $/; s/Mark set\nReplaced ([0-9]+) occurrences?\n/\1 /msg;'
;; }
;; 
;; export dm_files="
;; components/draw-map.js
;; utils/domCalcs.js
;; utils/domElements.js
;; utils/draw/axis.js
;; utils/draw/viewport.js
;; utils/log-selection.js
;; utils/stacks.js
;; 
;; styles/app.css  
;; 
;; controllers/mapview.js
;; components/in-axis.js
;; components/axis-tracks.js
;; components/axis-chart.js
;; 
;; components/axis-2d.js
;; components/axis-ld.js
;; components/axis-table.js
;; components/goto-ensembl.js
;; components/goto-marker.js
;; components/marker-detail.js
;; components/marker-name.js
;; components/selected-markers.js
;; components/table-brushed.js
;; templates/components/axis-2d.hbs
;; templates/components/axis-table.hbs
;; templates/components/goto-ensembl.hbs
;; templates/components/goto-marker.hbs
;; templates/components/marker-name.hbs
;; templates/components/path-hover.hbs
;; components/contain-change.js
;; templates/components/contain-change.hbs
;; frontend/app/routes/mapview.js
;; templates/components/selected-markers.hbs"
;; 
;; cd frontend/app; 
;; git checkout         $dm_files
;; dm_edit_each_p  $dm_files
;; # compare against the other work-tree using diff -r 
;;
;;------------------------------------------------------------------------------


;; similar : shell_filter_regexps, in $pA/tools/shell_filter_regexp.el

;; based on $pA/tools/map_ap_rename.el, without "discard the Function column"
;; Convert the name pair list into replace-regexps to perform the rename with :
;; (replace-regexp "\\(.+\\)	\\(.+\\)" "(goto-char buffer-edit-start)\t(replace-regexp \"\\\\\\\\<\\1\\\\\\\\>\" \"\\2\")")
;;
;; Leading upper-case in pattern/replacement will cause upper case in function calls;  change to lower case :
;; < (Goto-Char Buffer-Edit-Start)	(Replace-Regexp ...
;; > (goto-char buffer-edit-start)	(replace-regexp ...
;;
;; input list  
(if nil (setq "input_list" "
axes	axes2d
oa.axes	oa.axes2d
apS	axisS


adjAPs	adjAxes
markerAPs	markerAxisSet
apIDs	axisIDs

APs	Axes
apName	axisName
aps	axes
agName	aliasGroupName
ag	aliasGroup
pathAg	pathAliasGroup
amag	axisFeatureAliasGroups

am_	af_
am	featureToAxis
aa	featureAliasToAxis
aam	axisFeatureAliasToFeature
maga	featureAliasGroupAxes
agClasses	aliasGroupClasses
maN	featureAxesp
agam	aliasGroupAxisFeatures
pu	pathsUnique
oa.xs	oa.xScaleExtend
oa.aps	oa.axes

deleteAPfromapIDs	deleteAxisfromAxisIDs
apIDFind	axisIDFind
markerName	featureName
marker	feature

aama	aafa 
agama	agafa

amC	afC
ams	afs


im	ib
m	f
;; in draw-map.js: drawPromisedChr() and dataObserver(), rename m to block instead of f

m_	f_
m0	f0 
m1	f1 
M1	f1 
m2	f2 
m3	f3 
ma	fa 
mA	fA 
ma0	fa0
ma1	fa1
maa	faa

mai	fai
mai_	fai_

maNj	faNj

mAPs	fAPs 
mAPs0	fAPs0
mAPs1	fAPs1

mas	fas

mi	fi

m_k	f_k
m_k1	f_k1
ml	fl
mmaa	ffaa
mmNm	ffNf
mN		fName

smi	sfi

(without word boundary)
\"AP\"	\"axis-outer\"
\"ap\"	\"axis-outer\"

g.ap	g.axis-outer
^\.ap	.axis-outer

^\\.ap\\>	.axis-outer
\"\\.ap\\>	\".axis-outer
> .ap\\>	> .axis-outer


apID
APid
mapChr2AP
APid2Name
apName2Chr
removedGAp
apChangeGroupElt
apTransformO
AP	axis
ap	axis
apIDAdd
brushedApID
apShowExtend
tracedApScale

anApName	anAxisName
removedAp	removedAxis
apSelectionHeight	axisSelectionHeight
apNameHeight	axisNameHeight
removedGApNode	removedGAxisNode
apElt	axisElt
apIndex	axisIndex
apStackIndex2	axisStackIndex2
targetApName	targetAxisName
selectedAps	selectedAxes
apid	axisId

mapChrName2AP	mapChrName2Axis
zoomAp	zoomAxis
refreshAp	refreshAxis
deleteAp	deleteAxis
apG	axisG
removeAP	removeAxis
removeAPmaybeStack	removeAxisMaybeStack
ap0	axis0
ap1	axis1
AP1	Axis1
fAPs0	fAxis_s0
fAPs1 	fAxis_s1 
log_adjAPsa	log_adjAxes_a
collateAdjacentAPs	collateAdjacentAxes
apName1	axisName1
apY	axisY
apRedrawText	axisRedrawText
apTransform	axisTransform
configureAPtitleMenu	configureAxisTitleMenu
removeAPmaybeStack	removeAxisMaybeStack
apStack	axisStack
apStackIndexAll	axisStackIndexAll

selectedFeatures_removeAp	selectedFeatures_removeAxis
apStackIndex	axisStackIndex	   
fAPs	fAxis_s	   
fAPs1	fAxis_s1	   
ap2	axis2	   
featureStackAPs	featureStackAxes	   
collateApPositions	collateAxisPositions	   
addAp	addAxis	   

getAp	getAxis

apsP	axesParents
uniqueAps	uniqueAxes

;; These apply after marker -> feature; a few special cases in goto-marker.hbs, table-brushed.js
;; Remove the leading word boundary match (//<) on the first 2 and last 2.
  gene / feature	  gene / marker
  gene / marker	  feature (gene / marker)
Feature/Gene	Marker/Gene
Feature / Gene	Marker / Gene
\"Marker/Gene	\"Feature  - Marker/Gene
'Marker / Gene	'Feature : Marker / Gene

highlightMarker	highlightFeature

"))

(defun marker_feature_rename ()
  (interactive)
  (set-variable 'buffer-edit-start  (point) t)

  (save-excursion
    (goto-char buffer-edit-start)

;; alternative : map axes -> axes2d in draw-map.{js,hbs} outside of comments, i.e. recognise comment start-of-line /**, //, * , in that context map axes -> AaxesA, then map axes -> axes2d, then revert AaxesA -> axes.
(goto-char buffer-edit-start)	(replace-regexp "\\<axes :" "axes2d :")
(goto-char buffer-edit-start)	(replace-regexp "\\<oa\\.axes\\>" "oa.axes2d")
(goto-char buffer-edit-start)	(replace-regexp "\\<let axes\\>" "let axes2d")
(goto-char buffer-edit-start)	(replace-regexp "'axes'" "'axes2d'")
(goto-char buffer-edit-start)	(replace-regexp "\"axes\"" "\"axes2d\"")
(goto-char buffer-edit-start)	(replace-regexp ", axes)" ", axes2d)")
(goto-char buffer-edit-start)	(replace-regexp "\\<axes.findBy\\>" "axes2d.findBy")
(goto-char buffer-edit-start)	(replace-regexp "\\<axes.pushObject\\>" "axes2d.pushObject")
(goto-char buffer-edit-start)	(replace-regexp "\\<div>axes : {{axes\\>" "div>axes2d : {{axes2d")
(goto-char buffer-edit-start)	(replace-regexp "\\<each axes\\>" "each axes2d")
(goto-char buffer-edit-start)	(replace-regexp "\\<apS\\>" "axisS")


(goto-char buffer-edit-start)	(replace-regexp "\\<adjAPs\\>" "adjAxes")
(goto-char buffer-edit-start)	(replace-regexp "\\<markerAPs\\>" "markerAxisSets")
(goto-char buffer-edit-start)	(replace-regexp "\\<apIDs\\>" "axisIDs")

(goto-char buffer-edit-start)	(replace-regexp "\\<APs\\>" "Axes")
(goto-char buffer-edit-start)	(replace-regexp "\\<apName\\>" "axisName")
(goto-char buffer-edit-start)	(replace-regexp "\\<aps\\>" "axes")
(goto-char buffer-edit-start)	(replace-regexp "\\<agName\\>" "aliasGroupName")
(goto-char buffer-edit-start)	(replace-regexp "\\<ag\\>" "aliasGroup")
(goto-char buffer-edit-start)	(replace-regexp "\\<pathAg\\>" "pathAliasGroup")
(goto-char buffer-edit-start)	(replace-regexp "\\<amag\\>" "axisFeatureAliasGroups")

(goto-char buffer-edit-start)	(replace-regexp "\\<am_\\>" "af_")

(goto-char buffer-edit-start)	(replace-regexp "\\<am\\>" "featureToAxis")
(goto-char buffer-edit-start)	(replace-regexp "\\<aa\\>" "featureAliasToAxis")
(goto-char buffer-edit-start)	(replace-regexp "\\<aam\\>" "axisFeatureAliasToFeature")
(goto-char buffer-edit-start)	(replace-regexp "\\<maga\\>" "featureAliasGroupAxes")
(goto-char buffer-edit-start)	(replace-regexp "\\<agClasses\\>" "aliasGroupClasses")
(goto-char buffer-edit-start)	(replace-regexp "\\<maN\\>" "featureAxes")
(goto-char buffer-edit-start)	(replace-regexp "\\<agam\\>" "aliasGroupAxisFeatures")
(goto-char buffer-edit-start)	(replace-regexp "\\<pu\\>" "pathsUnique")
(goto-char buffer-edit-start)	(replace-regexp "\\<oa.xs\\>" "oa.xScaleExtend")
(goto-char buffer-edit-start)	(replace-regexp "\\<oa.aps\\>" "oa.axes")


(goto-char buffer-edit-start)	(replace-regexp "\\<deleteAPfromapIDs\\>" "deleteAxisfromAxisIDs")
(goto-char buffer-edit-start)	(replace-regexp "\\<apIDFind\\>" "axisIDFind")
(goto-char buffer-edit-start)	(replace-regexp "\\<markerName\\>" "featureName")
(goto-char buffer-edit-start)	(replace-regexp "marker" "feature")


(goto-char buffer-edit-start)	(replace-regexp "\\<aama\\>" "aafa ")
(goto-char buffer-edit-start)	(replace-regexp "\\<agama\\>" "agafa")

(goto-char buffer-edit-start)	(replace-regexp "\\<amC\\>" "afC")
(goto-char buffer-edit-start)	(replace-regexp "\\<ams\\>" "afs")


(goto-char buffer-edit-start)	(replace-regexp "\\<im\\>" "ib")
(goto-char buffer-edit-start)	(replace-regexp "\\<m\\>" "f")

(goto-char buffer-edit-start)	(replace-regexp "\\<m_\\>" "f_")
(goto-char buffer-edit-start)	(replace-regexp "\\<m0\\>" "f0 ")
(goto-char buffer-edit-start)	(replace-regexp "\\<m1\\>" "f1 ")
(goto-char buffer-edit-start)	(replace-regexp "\\<M1\\>" "f1 ")
(goto-char buffer-edit-start)	(replace-regexp "\\<m2\\>" "f2 ")
(goto-char buffer-edit-start)	(replace-regexp "\\<m3\\>" "f3 ")
(goto-char buffer-edit-start)	(replace-regexp "\\<ma\\>" "fa ")
(goto-char buffer-edit-start)	(replace-regexp "\\<mA\\>" "fA ")
(goto-char buffer-edit-start)	(replace-regexp "\\<ma0\\>" "fa0")
(goto-char buffer-edit-start)	(replace-regexp "\\<ma1\\>" "fa1")
(goto-char buffer-edit-start)	(replace-regexp "\\<maa\\>" "faa")

(goto-char buffer-edit-start)	(replace-regexp "\\<mai\\>" "fai")
(goto-char buffer-edit-start)	(replace-regexp "\\<mai_\\>" "fai_")

(goto-char buffer-edit-start)	(replace-regexp "\\<maNj\\>" "faNj")

(goto-char buffer-edit-start)	(replace-regexp "\\<mAPs\\>" "fAPs ")
(goto-char buffer-edit-start)	(replace-regexp "\\<mAPs0\\>" "fAPs0")
(goto-char buffer-edit-start)	(replace-regexp "\\<mAPs1\\>" "fAPs1")

(goto-char buffer-edit-start)	(replace-regexp "\\<mas\\>" "fas")

(goto-char buffer-edit-start)	(replace-regexp "\\<mi\\>" "fi")

(goto-char buffer-edit-start)	(replace-regexp "\\<m_k\\>" "f_k")
(goto-char buffer-edit-start)	(replace-regexp "\\<m_k1\\>" "f_k1")
(goto-char buffer-edit-start)	(replace-regexp "\\<ml\\>" "fl")
(goto-char buffer-edit-start)	(replace-regexp "\\<mmaa\\>" "ffaa")
(goto-char buffer-edit-start)	(replace-regexp "\\<mmNm\\>" "ffNf")
(goto-char buffer-edit-start)	(replace-regexp "\\<mN\\>" "fName")

(goto-char buffer-edit-start)	(replace-regexp "\\<smi\\>" "sfi")

(goto-char buffer-edit-start)	(replace-regexp "\"AP\"" "\"axis-outer\"")
(goto-char buffer-edit-start)	(replace-regexp "\"ap\"" "\"axis-outer\"")
(goto-char buffer-edit-start)	(replace-regexp "\\<g.ap\\>" "g.axis-outer")
(goto-char buffer-edit-start)	(replace-regexp "^\\.ap\\>" ".axis-outer")	;; works on the .css
(goto-char buffer-edit-start)	(replace-regexp "\"\\.ap\\>" "\".axis-outer")	;; works on .ap"
(goto-char buffer-edit-start)	(replace-regexp "> .ap\\>" "> .axis-outer")	;; remaining selector


(goto-char buffer-edit-start)	(replace-regexp "\\<apID\\>" "axisID")
(goto-char buffer-edit-start)	(replace-regexp "\\<APid\\>" "axisID")
(goto-char buffer-edit-start)	(replace-regexp "\\<mapChr2AP\\>" "mapChr2Axis")
(goto-char buffer-edit-start)	(replace-regexp "\\<APid2Name\\>" "axisId2Name")
(goto-char buffer-edit-start)	(replace-regexp "\\<apName2Chr\\>" "axisName2Chr")
(goto-char buffer-edit-start)	(replace-regexp "\\<removedGAp\\>" "removedGAxis")
(goto-char buffer-edit-start)	(replace-regexp "\\<apChangeGroupElt\\>" "axisChangeGroupElt")
(goto-char buffer-edit-start)	(replace-regexp "\\<apTransformO\\>" "axisTransformO")
(goto-char buffer-edit-start)	(replace-regexp "\\<AP\\>" "axis")
(goto-char buffer-edit-start)	(replace-regexp "\\<ap\\>" "axis")
(goto-char buffer-edit-start)	(replace-regexp "\\<apIDAdd\\>" "axisIDAdd")
(goto-char buffer-edit-start)	(replace-regexp "\\<brushedApID\\>" "brushedAxisID")
(goto-char buffer-edit-start)	(replace-regexp "\\<apShowExtend\\>" "axisShowExtend")
(goto-char buffer-edit-start)	(replace-regexp "\\<tracedApScale\\>" "tracedAxisScale")


(goto-char buffer-edit-start)	(replace-regexp "\\<anApName\\>" "anAxisName")
(goto-char buffer-edit-start)	(replace-regexp "\\<removedAp\\>" "removedAxis")
(goto-char buffer-edit-start)	(replace-regexp "\\<apSelectionHeight\\>" "axisSelectionHeight")
(goto-char buffer-edit-start)	(replace-regexp "\\<apNameHeight\\>" "axisNameHeight")
(goto-char buffer-edit-start)	(replace-regexp "\\<removedGApNode\\>" "removedGAxisNode")
(goto-char buffer-edit-start)	(replace-regexp "\\<apElt\\>" "axisElt")
(goto-char buffer-edit-start)	(replace-regexp "\\<apIndex\\>" "axisIndex")
(goto-char buffer-edit-start)	(replace-regexp "\\<apStackIndex2\\>" "axisStackIndex2")
(goto-char buffer-edit-start)	(replace-regexp "\\<targetApName\\>" "targetAxisName")
(goto-char buffer-edit-start)	(replace-regexp "\\<selectedAps\\>" "selectedAxes")
(goto-char buffer-edit-start)	(replace-regexp "\\<apid\\>" "axisId")


(goto-char buffer-edit-start)	(replace-regexp "\\<mapChrName2AP\\>" "mapChrName2Axis")
(goto-char buffer-edit-start)	(replace-regexp "\\<zoomAp\\>" "zoomAxis")
(goto-char buffer-edit-start)	(replace-regexp "\\<refreshAp\\>" "refreshAxis")
(goto-char buffer-edit-start)	(replace-regexp "\\<deleteAp\\>" "deleteAxis")
(goto-char buffer-edit-start)	(replace-regexp "\\<apG\\>" "axisG")
(goto-char buffer-edit-start)	(replace-regexp "\\<removeAP\\>" "removeAxis")
(goto-char buffer-edit-start)	(replace-regexp "\\<removeAPmaybeStack\\>" "removeAxisMaybeStack")
(goto-char buffer-edit-start)	(replace-regexp "\\<ap0\\>" "axis0")
(goto-char buffer-edit-start)	(replace-regexp "\\<ap1\\>" "axis1")
(goto-char buffer-edit-start)	(replace-regexp "\\<AP1\\>" "Axis1")
(goto-char buffer-edit-start)	(replace-regexp "\\<fAPs0\\>" "fAxis_s0")
(goto-char buffer-edit-start)	(replace-regexp "\\<fAPs1 \\>" "fAxis_s1 ")
(goto-char buffer-edit-start)	(replace-regexp "\\<log_adjAPsa\\>" "log_adjAxes_a")
(goto-char buffer-edit-start)	(replace-regexp "\\<collateAdjacentAPs\\>" "collateAdjacentAxes")
(goto-char buffer-edit-start)	(replace-regexp "\\<apName1\\>" "axisName1")
(goto-char buffer-edit-start)	(replace-regexp "\\<apY\\>" "axisY")
(goto-char buffer-edit-start)	(replace-regexp "\\<apRedrawText\\>" "axisRedrawText")
(goto-char buffer-edit-start)	(replace-regexp "\\<apTransform\\>" "axisTransform")
(goto-char buffer-edit-start)	(replace-regexp "\\<configureAPtitleMenu\\>" "configureAxisTitleMenu")
(goto-char buffer-edit-start)	(replace-regexp "\\<removeAPmaybeStack\\>" "removeAxisMaybeStack")
(goto-char buffer-edit-start)	(replace-regexp "\\<apStack\\>" "axisStack")
(goto-char buffer-edit-start)	(replace-regexp "\\<apStackIndexAll\\>" "axisStackIndexAll")

(goto-char buffer-edit-start)	(replace-regexp "\\<selectedFeatures_removeAp\\>" "selectedFeatures_removeAxis")
(goto-char buffer-edit-start)	(replace-regexp "\\<apStackIndex\\>" "axisStackIndex")
(goto-char buffer-edit-start)	(replace-regexp "\\<fAPs\\>" "fAxis_s")
(goto-char buffer-edit-start)	(replace-regexp "\\<fAPs1\\>" "fAxis_s1")
(goto-char buffer-edit-start)	(replace-regexp "\\<ap2\\>" "axis2")
(goto-char buffer-edit-start)	(replace-regexp "\\<featureStackAPs\\>" "featureStackAxes")
(goto-char buffer-edit-start)	(replace-regexp "\\<collateApPositions\\>" "collateAxisPositions")
(goto-char buffer-edit-start)	(replace-regexp "\\<addAp\\>" "addAxis")

(goto-char buffer-edit-start)	(replace-regexp "\\<getAp\\>" "getAxis")

(goto-char buffer-edit-start)	(replace-regexp "\\<apsP\\>" "axesParents")
(goto-char buffer-edit-start)	(replace-regexp "\\<uniqueAps\\>" "uniqueAxes")

(goto-char buffer-edit-start)	(replace-regexp "gene / feature\\>" "gene / marker")
(goto-char buffer-edit-start)	(replace-regexp "  gene / marker\\>" "  feature (gene / marker)")
(goto-char buffer-edit-start)	(replace-regexp "\\<Feature/Gene\\>" "Marker/Gene")
(goto-char buffer-edit-start)	(replace-regexp "\\<Feature / Gene\\>" "Marker / Gene")
(goto-char buffer-edit-start)	(replace-regexp "\"Marker/Gene\\>" "\"Feature  - Marker/Gene")
(goto-char buffer-edit-start)	(replace-regexp "'Marker / Gene\\>" "'Feature : Marker / Gene")

(goto-char buffer-edit-start)	(replace-regexp "\\<highlightMarker\\>" "highlightFeature")

    )
  )

;;------------------------------------------------------------------------------

;; do this after (marker_feature_rename), in drawPromisedChr() and dataObserver() :
;; (replace-regexp "\\<f\\>" "block")

;;------------------------------------------------------------------------------
