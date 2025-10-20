#-------------------------------------------------------------------------------

# Pretzel bash functions related to dataset metadata and the 'AddMetadata|' worksheet

# This file contains scripts to export the metadata and convert
# from json to tsv, and tsv to json, i.e. convert back again.

#-------------------------------------------------------------------------------

# environment variables used :
#  $DIM
#  $database_ip
#  $DB_NAME
# setup  : ...
# Example Usage : exportDatasetMetadata  > all.json
function exportDatasetMetadata() {
  docker exec -it $DIM mongo --host $database_ip --quiet $DB_NAME --eval 'printjson(db.Dataset.aggregate([{$project:{meta:1}}]).toArray())'
}

# Convert the dataset metadata exported by exportDatasetMetadata() to TSV,
# for import to MS Excel, to set up a 'AddMetadata|' worksheet.
# Usage example :
# json2tsv all.json > datasets.metadata.all_cols.2023Oct09.tsv
function json2tsv() {
jq -r '
  # Ensure we only use object docs
  (map(select(type=="object"))) as $docs
  # Union of ALL keys that appear in any meta object
  | ($docs | map(.meta? | objects) | add // {} | keys | sort) as $keys
  # Header
  | (["_id"] + $keys),
    # Rows
    ($docs[] as $d
      | [($d._id // null | tostring)]
        + ($keys | map(. as $k
            | ($d.meta? | objects | .[$k] // null | tostring))))
  | @tsv
' $* \
 | sed 's/null//g'
  # The script outputs 'null' in the empty cells - I have replaced 'null' with ''.
}



#-------------------------------------------------------------------------------

# Taking as input the TSV output from a 'AddMetadata|' worksheet,
# convert to JSON for use in metadata graph development cycle.
#
# Usage example :
# < datasets.metadata.2025Oct09.tsv tsv2json  > metadata.json
function tsv2json() {
  sed $'s/\t\t*$//' | awk 'BEGIN {FS="\t"; OFS=":"}
     NR==1 {for (i=1; i<=NF; i++) headers[i]=$i; next}
     {
       printf "{";
       for (i=1; i<=NF; i++) {
         if ($i != "") {
           printf "\"%s\" : \"%s\"%s", headers[i], $i, (i<NF? ", " : "");
         }
       }
       printf "}\n"
     }'
}

# Optional : `jq -s '.'` collects the JSON objects into an array.
# < metadata.json jq -s '.' > metadata.array.json

#-------------------------------------------------------------------------------
