
### Connecting additional genomics and bioinformatics databases to Pretzel

Pretzel can integrate information from additional databases such as Blast and VCF into the display.
These databases may have varying names for datasets and chromosomes.
To align the chromosome names, the .name field of the Blocks of the BlastDB or VCF dataset are set to the chromosome name used by external database.  Pretzel uses the Block .scope field to determine the chromosome axis on which a dataset is displayed, i.e. Block .scope identifies the chromosome in Pretzel.

Here are the steps for checking that the blast db chr name is configured in mongo db :

```
datasetId=Triticum_aestivum_IWGSC_RefSeq_v1.0
cd /mnt/data_blast/blast/datasetId
cat $datasetId.dbName
161010_Chinese_Spring_v1.0_pseudomolecules.fasta

ls -gG $datasetId.dir/$(cat $datasetId.dbName).fai
 723 Jan 24  2023 Triticum_aestivum_IWGSC_RefSeq_v1.0.dir/161010_Chinese_Spring_v1.0_pseudomolecules.fasta.fai

cat $datasetId.dir/$(cat $datasetId.dbName).fai
chr1A	594102056	7	60	61
chr1B	689851870	604003771	60	61
chr1D	495453186	1305353180	60	61
chr2A	780798557	1809063927	60	61
chr2B	801256715	2602875801	60	61
chr2D	651852609	3417486802	60	61
chr3A	750843639	4080203629	60	61
chr3B	830829764	4843561336	60	61
chr3D	615552423	5688238270	60	61
chr4A	744588157	6314049908	60	61
chr4B	673617499	7071047875	60	61
chr4D	509857067	7755892340	60	61
chr5A	709773743	8274247032	60	61
chr5B	713149757	8995850345	60	61
chr5D	566080677	9720885939	60	61
chr6A	618079260	10296401301	60	61
chr6B	720988478	10924781889	60	61
chr6D	473592718	11657786849	60	61
chr7A	736706236	12139272786	60	61
chr7B	750620385	12888257467	60	61
chr7D	638686055	13651388199	60	61
chrUn	480980714	14300719029	60	61
```

```
# Determine mongo container id
# On main this is already done in ~/.bash_custom
function dockerContainer() {
  image=$1;
  docker ps --format "{{.ID}}\t{{.Image}}" | sed -n "s/	$image.*//p"
}
DIM=$(dockerContainer mongo)

# or determine mongo container id using docker ps :
...
b371fe05350e   mongo:4.2                                       "docker-entrypoint.s…"   12 months ago   Up 2 months   0.0.0.0:27017->27017/tcp, :::27017->27017/tcp   exciting_agnesi
DIM=b371
```

`DB_NAME=pretzel`
```
# except on main :
echo $DB_NAME
admin
```

```
docker exec -it $DIM mongo --quiet $DB_NAME

# Similarly for VCF : "tags" : [ "view", "VCF" ], 
db.Dataset.aggregate({$match : {tags : { $exists: true}}},
 {$match : {$expr : {$in : ["BlastDb", "$tags"]}}},
 {$project : {_id : 1}} )

{ "_id" : "Triticum_aestivum_IWGSC_RefSeq_v1.0" }
{ "_id" : "Jagger" }
{ "_id" : "ArinaLrFor" }
{ "_id" : "Julius" }
{ "_id" : "Mace" }
{ "_id" : "Hordeum_vulgare_RGT_Planet_v1" }
{ "_id" : "Hordeum_vulgare_HOR9043_v1.1" }
{ "_id" : "Triticum_aestivum_IWGSC_RefSeq_v2.0" }


DBQuery.shellBatchSize=100
db.Block.aggregate({$match : {datasetId : "Triticum_aestivum_IWGSC_RefSeq_v1.0"}}, {"$project" : {_id : 0, name : 1, scope: 1}})

{ "scope" : "1A", "name" : "1A" }
{ "scope" : "1B", "name" : "1B" }
{ "scope" : "1D", "name" : "1D" }
{ "scope" : "2A", "name" : "2A" }
{ "scope" : "2B", "name" : "2B" }
{ "scope" : "2D", "name" : "2D" }
{ "scope" : "3A", "name" : "3A" }
{ "scope" : "3B", "name" : "3B" }
{ "scope" : "3D", "name" : "3D" }
{ "scope" : "4A", "name" : "4A" }
{ "scope" : "4B", "name" : "chr4B" }
{ "scope" : "4D", "name" : "chr4D" }
{ "scope" : "5A", "name" : "5A" }
{ "scope" : "5B", "name" : "5B" }
{ "scope" : "5D", "name" : "5D" }
{ "scope" : "6A", "name" : "6A" }
{ "scope" : "6B", "name" : "6B" }
{ "scope" : "6D", "name" : "6D" }
{ "scope" : "7A", "name" : "7A" }
{ "scope" : "7B", "name" : "7B" }
{ "scope" : "7D", "name" : "7D" }
{ "scope" : "Un", "name" : "Un" }
```


4B and 4D are configured to match the blast db.
To configure the remainder :
```
datasetId=Triticum_aestivum_IWGSC_RefSeq_v1.0
for chrName in $(echo {1,2,3,4,5,6,7}{A,B,D}) ; do echo "db.Block.updateOne({datasetId : '$datasetId', scope : '$chrName'}, {\$set : {name : 'chr$chrName'}});"; done  | docker exec -i $DIM mongo --quiet $DB_NAME
```
this does e.g. :
```
db.Block.updateOne({datasetId : 'Triticum_aestivum_IWGSC_RefSeq_v1.0', scope : '1A'}, { : {name : 'chr1A'}})
...
```

output :
```
{ "acknowledged" : true, "matchedCount" : 1, "modifiedCount" : 1 }
{ "acknowledged" : true, "matchedCount" : 1, "modifiedCount" : 1 }
{ "acknowledged" : true, "matchedCount" : 1, "modifiedCount" : 1 }
{ "acknowledged" : true, "matchedCount" : 1, "modifiedCount" : 1 }
{ "acknowledged" : true, "matchedCount" : 1, "modifiedCount" : 1 }
{ "acknowledged" : true, "matchedCount" : 1, "modifiedCount" : 1 }
{ "acknowledged" : true, "matchedCount" : 1, "modifiedCount" : 1 }
{ "acknowledged" : true, "matchedCount" : 1, "modifiedCount" : 1 }
{ "acknowledged" : true, "matchedCount" : 1, "modifiedCount" : 1 }
{ "acknowledged" : true, "matchedCount" : 1, "modifiedCount" : 1 }
{ "acknowledged" : true, "matchedCount" : 1, "modifiedCount" : 0 }
{ "acknowledged" : true, "matchedCount" : 1, "modifiedCount" : 0 }
{ "acknowledged" : true, "matchedCount" : 1, "modifiedCount" : 1 }
{ "acknowledged" : true, "matchedCount" : 1, "modifiedCount" : 1 }
{ "acknowledged" : true, "matchedCount" : 1, "modifiedCount" : 1 }
{ "acknowledged" : true, "matchedCount" : 1, "modifiedCount" : 1 }
{ "acknowledged" : true, "matchedCount" : 1, "modifiedCount" : 1 }
{ "acknowledged" : true, "matchedCount" : 1, "modifiedCount" : 1 }
{ "acknowledged" : true, "matchedCount" : 1, "modifiedCount" : 1 }
{ "acknowledged" : true, "matchedCount" : 1, "modifiedCount" : 1 }
{ "acknowledged" : true, "matchedCount" : 1, "modifiedCount" : 1 }
```

checking :
```
[@main. ~]$  echo "DBQuery.shellBatchSize=100; db.Block.find({datasetId : '$datasetId'})" | docker exec -i $DIM mongo --quiet $DB_NAME
{ "_id" : ObjectId("5b69dd44b1b8780b8739f694"), "scope" : "1A", "name" : "chr1A", "range" : [ 1, 594102056 ], "datasetId" : "Triticum_aestivum_IWGSC_RefSeq_v1.0", "featureType" : "linear" }
...
```
