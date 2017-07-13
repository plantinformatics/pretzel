
# GUI ideas

## Adding and using Data Sources

* top menu : Add Data Source : enter URL, account credentials, Add.
* when the Add is successful, the result is an added colour square shown top-left above the graph.
* square has hover highlight to indicate it is an active/sensitive element.
* click on data source sq : displays pulldown list of maps (possibly a tree with collapsed nodes if many),
like the current maps pull-down.

## Progressive Render

high level is like thumbnail (can be cached by backend), % of data or synteny blocks,

separation of URL from display : not synchronised, URL drives data requests,
rendering the data as it arrives,
single stream of data, don't need multi-thread, (? except perhaps separate threads to render and respond to user input)

## Multi-layer axis

select on axis : different data sets depending on toggle buttons which enable them
or axes are shown parallel and able to select on the axis with the data of interest
the toggles could control not only the visibility of the data, but also the visibility of its axis.

matrix view (of SNPs) :
~300 lines, ~100s of bp, name of line, some attributes, CGAT or unknown.

possibly : zoom in, and when at a certain threshold, show the matrix view,
or side-by-side views, map acts like a navigator for the detail view,
but may also navigate from detail to gm view.

path drag transition : just show a % of paths


# GUI issues

It doesn't make sense to over-polish the GUI because additions are being made to the GUI and functionality.
But it is worth recording any noted issues so they are not lost.

So this is a start ...

* list of maps is getting long - can be difficult to access lower in the list
* the chr name in the pull-down list is greyed after it is added - change the colours (currently black/grey) to emphasize that distinction.
addressed by commit : [feature/render-promises cc2569e]
* the chr delete operation could be on a submenu reached from the chr axis
* add new map : add a context menu accessed from graph background to add map etc.
* axis dragging : not obvious to grab on the axis ticks; add a hover highlight; make titles a drag handle also.
* add a sustain to the hover tooltip on paths, because path is narrow and mouse jitter causes tooltip flicker
* path hover tooltip : currently just a block of text, layout so that structure is clear, e.g. aliases in columns under marker name;
   marker / alias names / position can be sensitive, hover highlight the marker / position, click to colour.
* ... etc
* issues & suggestions welcome ...
