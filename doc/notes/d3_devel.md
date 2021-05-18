# debugging techniques for d3

## Web Inspector : Console, Elements tab, Ember Inspector

- nodes(), node(), data(), .__data__

- click in Elements tab to select an element, then in console can inspect the element details with 
 $0, $0.__data__

- d3 stores .data(), .datum() on element.__data__, so $0.__data__ shows the d3 datum

- in console, selection .node() shows the element as it appears in the Elements panel;
right-click on this -> view in Elements panel

- when single-stepping through d3 attribute changes, note that in a transition the change won't take place until later, so commenting out the .transition().duration() line makes it easy to observe element changes while stepping through code

- Elements panel highlights attribute changes for about 1 second, so have this displayed and continue (eg. to the next breakpoint)

- use ember inspector to get component handle, from there get element and datum

- d3 selection in console : can be used to inspect the app at any time - no need to breakpoint the app

- Chrome and Firefox Web Inspector are similar, each has at least 1 thing which the other doesn't do or isn't as easy to use

- more :
https://developers.google.com/web/tools/chrome-devtools/console/utilities
http://anti-code.com/devtools-cheatsheet/
