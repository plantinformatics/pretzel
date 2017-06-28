# Promises / Render and backend-frontend API

These 2 topics are interconnected by requirements and design considerations.

overview of scope :
. backend processing as an alternative to front-end calculation of routes / paths between adjacent APs.
. also how to update the APs without changing the route so the addition of an AP or the deletion of an AP
  will not cause a re-render, will only re-render the particular AP.

## Promises / Render 

When the URL is interpreted it causes a re-render because of the refreshModel flags being true for
the map and chromosome in the configuration.
The re-render is desired, so that works.  Change would be in that
currently the pull-down menu has linkTos
and also the chromosome-Delete has a linkTo,
so those, instead of being URLs which would cause a re-render,
should be ember-concurrency requests to
get the extra data and then just do the calculations for that data and render that data.
Currently the flow collateStacks() calculation works for all 
APs in one go; it needs to be able to operate for just a single new AP
assuming that all the others are still there, so ... it's collateData() - that applies to collateData.
For collateStacks(), it applies when there is a new adjacency,
which there will be if there is a new AP.
Possibly either split out those functions so they can handle just one new AP
or 1 new adjacency
or as they are calculating, check to see if that calculation has been done before by
seeing if the corresponding hash member has been defined.
At the moment 
that lookup would be just based on the AP id but in future
we would also want to split it based on a range of locations;
that's both for the collateData() and collateStacks();
for collateStacks() it would be for a range of locations on both
the adjacent APs

in terms of the rendering (and) transition
the component which is requested needs to be a separate group (SVG <g>)
so we already have a group per-AP,
so would also need a group per APxAP,
that is the adjacencies between AP A and B would need to named (the group would be named) "A_B".

looking forward ... if we are requesting multiple pages, i.e. use the progressive interleave e.g.,
then those pages would need to be part of the group name also.

## backend-frontend API

looking on the backend,
we want to be able to replicate the adjacency calculation on the back-end, preferably using mongo search capabilities where possible.
The types of searches would be :
. all adjacencies between AP A & B,
with the possibility to define a range of locations on both A & B
. the adjacency might also be via the aliases of A & B
. and may be restricted to only unique aliases

Back-end can also work out syntenic blocks.
Synteny is a relationship between 2 APs, so when synteny is requested between A & B,
the back-end would, if it hasn't already cached that value, calculate it, cache it and
return it.

Synteny would also be possibly constrained by range of locations on A & B.
Check whether synteny is via the gene/marker name or via its aliases,
or possibly via either.
The result is the syntenic blocks, which is a much smaller adjacency that the full list of paths
connecting the two.
The range specified in requesting adjacency between A & B
may also indicate the range via the syntenic block on each of those APs.

Factors affecting whether to get from the back-end or calculate on the front-end :
. the richness of connections adjacency;
for example there may be very few interconnections between 2 APs,
or there may be a large number, which would favour calculation on the front-end.
[. bandwidth / CPU]

The grouping of adjacency results by syntenic block or by location range,
and also by a pair of adjacent APs, would be by classes rather than ID,
and each of those could be a separate class with a prefix to indicate its type,
the type being e.g. syntenic block id range or pair, location range pair, AP id pair;
the syntenic block and location range are relative to an AP id.
So the front end will have a representation of what is currently visible,
so the list of APs and for each AP the range of locations or a syntenic block,
also the order of the APs, which will indicate the adjacency,
the order can include stacks.  This is essentially the URL.
That determines the range of data which is displayed;
i.e. what is passed to the d3 data function.
So the group element is a hierarchy of ranges,
and then the data function for each range will calculate the list of data values.

The complexity of this will impact on when it should be done because it adds to the
usability of the application rather than the functionality.
Received data can be displayed in a transition whose length (of time) is determined
by the time interval between 
the previous 2 responses received.
The initial transition [time] can be just an estimate or 0.


The most beneficial application of calculating adjacencies on the backend would be the
unique alias calculation, so that is the best place to start.
That would be for the whole AP, i.e. requesting all (unique or non-unique) alias adjacencies between APs A & B,
no sub-ranges or syntenic blocks.

The syntenic block calculation is also a good one, but there is
significant work on the front-end to represent those syntenic blocks.

## Syntenic Blocks Representation / GUI

A block could be represented by a pair of paths, i.e. 2 connections between the 2 adjacent APs,
which uses the existing software on the front-end, doesn't require any new rendering capability.

On the front-end these pairs can be flagged as groups,
i.e. the start and end of the syntenic block can be grouped together so that it can be coloured
differently to the other blocks.
The syntenic block calculation doesn't seem to be something which can be done with mongo search facilities;
it would have to be a JavaScript algorithm.
The synteny calculation would have counters for the number of contiguous exceptions
the number of total allowed exceptions,
within 1 block.

On the front-end the selection of whether to display syntenic blocks or paths,
be they direct or aliases or unique aliases etc,
is currently slightly controlled at the graph level,
but [it] could be valuable to control it at []
per adjacent pair of APs.
[It] could also be automatic that when a new AP is added,
initially just the syntenic blocks are shown and then, per user request or when the user zooms in,
the next level of detail is shown automatically,
i.e. the actual paths.

Also want to be able to zoom in by mouse scroll-wheel - have to think about how to implement that,
but also to zoom in via syntenic block [selection].  the user ...  does this mean via the syntenic block 
at both ends of the adjacency, i.e. both APs.
Otherwise you would have a single syntenic block on one end and then the whole AP / the whole chromosome on the other end;
there wouldn't be much value in that because all the lines outside of the syntenic block on the other end would not be connected.
So we need some representation of the syntenic block which the user can hover over [to ... access a menu ] 
possibly a rectangle on the axis.
The block could be represented by a parallelogram, which would be a change of implementation.
but would offer a good hover ability, and colouration.

Possibly split up the foreground [<g>] into multiple groups, 1 per adjacency;
have to check on the impact on clipping;
also this means that
groups will be replicated in multiple foreground sections,
although it is not necessary for all the groups to be moved into those [foreground] sections;
the sub-sections / the adjacency foreground groups could be used simply for
catching click actions for a hover/pop-up menu which controlled the level of detail for that adjacency
e.g. syntenic blocks / aliases / directs etc.
But considering a stack of 2 [APs] to a stack of 3, there is nowhere  ...
where would you click to select the adjacency between 1 AP and another ?
So instead have the ability to select APs and the [adjacency of the] most recent 2 APs selected ..
in the status can be displayed and set;
status being the level of detail displayed, whether it be syntenic blocks / etc.
The adjacency of a syntenic block
may have an inversion,
so selecting that would be difficult because of the bow-tie appearance,
so it is better to select the syntenic block by the rectangle representation at either end.
[Display of] the hover menu can
highlight the other end of the syntenic block
to indicate that both ends are affected by the hover menu actions.
Considered having a wedge shape at the edge of the axis
representing the synteny block, which could be selected,
but [the] same problem arises with stacks,
e.g. if you have got a 2 x 3 stack and you trying to
select the synteny blocks they'll overlap, so the
wedge idea could have been used to select adjacent axis pairs,
but that doesn't seem to work, so simply
as before select the 2 axes, and the most recent 2 axes selected are displayed
in the bottom section;
similarly for synteny blocks, and there the status is displayed and can be changed.


alternative representations for synteny blocks :
spline example, insert image.
selecting AP : perhaps a rectangular region projecting into the foreground section, like synteny blocks.
synteny blocks : just short rectangular pieces, open ended, thick inside edge and no outside edge / border.
