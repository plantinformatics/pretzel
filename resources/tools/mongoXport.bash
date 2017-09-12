#!/bin/bash

#-------------------------------------------------------------------------------
#	Scripts relating to mongoDB import/export format
#
#  see : mongodb-manual : 
#   MONGOIMPORT(1)                                                                                              
#   MONGOEXPORT(1)
#-------------------------------------------------------------------------------

# Usage : source resources/tools/mongoXport.bash

#-------------------------------------------------------------------------------

# Select documents out of a mongoexport using a pattern,
# fold the output for further processing.
# To prepare the output for re-import via mongoimport, pipe through: (tr -d '\n'; echo)
#
# Usage e.g. : 
#   docHead "IRGSP 3"  < 2017Aug15 > IRGSP_3.fold
#   docHead CS5B 2017Aug15 > CS5B.fold
#
# @param pattern	match the document name; this pattern is (currently) wrapped with \"\" in the regexp by this function
# @param source file(s)	remaining params are used as source, if none then stdin is read
#
# @see docHead()
function docFold()
{
    pattern="$1";
    shift;
    fgrep "\"$pattern\"" $* | sed "s/},/},\n/g"
}

#-------------------------------------------------------------------------------


# Usage e.g. : 
#
# docHead "IRGSP 3" IRGSP_3 200 < 2017Aug15
# docHead CS5B{,} 100 2017Aug15
# for i in *.json; do < $i tr -d '\n'; echo   ; done  | mongoimport --db test --collection geneticmaps
#
# @param pattern	match the document name; this pattern is (currently) wrapped with \"\" in the regexp by this function
# @param name		name of file to create $name.json;  tmp files $name and $name.fold are also created
# @param length	number of lines of to take from the head of the .fold file;
#  each marker is spread over 2 lines (fold between oid and aliases), e.g.
#  { "name" : "OS03T0100020-01", "position" : 8552, "_id" : { "$oid" : "59926bb1bf55621a90012495" },
# "aliases" : [ "TraesCS4D01G272000_1", "TraesCS4A01G032500_1", "TraesCS4B01G272900_1" ] },
# so length 100 will give approx 50 markers.
# @param source file(s)	remaining params are used as source, if none then stdin is read
function docHead()
{
    # function was initially named firstPart, drafted in $pA/notes/agriBio, *shell*.2017Aug14
    pattern="$1"; name=$2; length=$3; 
    shift; shift; shift;
    [ -f $name ] || fgrep "\"$pattern\"" $* > $name
    <$name sed "s/},/},\n/g" > $name.fold
    (head -$length $name.fold  | sed '$s/,$//' ; tail -1 $name.fold | sed  ' s/"aliases" : \[\] } //') > $name.json
}

#-------------------------------------------------------------------------------

# Wrap chrSelect.pl, piped to mongoimport
#
# @see chrSelect.pl header comment re. param geneSelection :
# Given a file with a list of gene names, select just those genese from $* or stdin.
# The input is a valid mongodb export file, except that it is folded (sed
# "s/},/},\n/g") e.g. by mongoXport.bash: docHead() or docFold().
# The result of chrSelect.pl is formatted for input to mongoimport (join, remove
# trailing comma, close braces and brackets)
#
# 
# Usage e.g. : 
# cd ~/tmp/x/data/; chrSelect bracket_TraesCS7 < ../CS7A.fold
#
# @param geneSelection	path name of file with a list of gene names, 1 per line, to select from the input
# @param chrName	e.g. CS7A
# @param source file(s)	remaining params are used as source, if none then stdin is read
function chrSelect()
{
    geneSelection="$1";
    shift;

    perl -0pe  's/\n( "aliases")/\1/g' $*	\
	|  $MMV/resources/tools/chrSelect.pl $geneSelection \
	| ( sed '$,$s/,$//'  ; echo  ' ] } ], "__v" : 0 }' )	\
	| tr '\n' ' '  | mongoimport --db test --collection geneticmaps
}

#-------------------------------------------------------------------------------
