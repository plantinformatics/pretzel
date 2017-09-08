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
