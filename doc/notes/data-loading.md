## Overview 

For small datasets, see also the top-level README.md : [Loading data](../../README.md#loading-data)

### Loading large SNP lists

The backend server doesn't yet use streaming when loading datasets, so due to memory limits it is necessary to split large datasets for loading.
This section describes a bash function loadChr() which supports that;  this is not yet a production tool - some additional input checks and error handling would be required.
It is fine for use by users who are comfortable with the bash command-line.

The examples are based on loading SNP data for barley, which has chromosomes 1H - 7H.

If not already done, clone the pretzel source so that the scripts can be accessed.
The following will use the environment variable $pretzel to refer to this work-tree.
```
git clone https://github.com/plantinformatics/pretzel
export pretzel=$PWD/pretzel
```

Source the script file which defines loadChr().
```
source $pretzel/resources/tools/dev/functions_data.bash
```

loadChr() has been used in conjunction with this version of the script snps2Dataset.pl :
```
18ba480a :     Add value_0 to generated json, for improved index use.
Date:   Mon Mar 15 21:33:57 2021 +1100
```
To access this version :
```
set -o noclobber		# this file is already set up on dev and barley
git show 18ba480a:resources/tools/dev/snps2Dataset.pl > ~/tmp/snps2Dataset.value_0.pl
```

The option -s shortName is added in a later version of the script.
In this version, simply edit the script :
```
< my $shortName = "WGS";	# option, default : Exome
> my $shortName = "LC_WGS_SNP"; # HC_WGS_SNP"; # WGS";	# option, default : Exome
```

... and comment out or modify this line; this determines a suffix added to .namespace (originally _Exome_SNPs); it should not be $datasetName because that produces a name which is too long.  e.g. it could be : $datasetHeader =~ s/_Exome_SNPs/_SNPs/;
```
<     $datasetHeader =~ s/_Exome_SNPs/_$datasetName/;
>     # $datasetHeader =~ s/_Exome_SNPs/_$datasetName/;
```
If editting the definition of $datasetHeader, retain the text 'Triticum_aestivum_IWGSC_RefSeq_v1.0' which is replaced with $parentName. (this is like an ad-hoc template, evolving as uses are added, can be made more generic as needed).


For loadChr(), the chromosomes are independent.  They are combined into a single dataset in a subsequent stage, using mongo shell to 'rename' the blocks into a single dataset.

This means the following can be done in 2 stages, so that any issues can be discovered by checking the added dataset with just the first chromosome :
- for c0 in 1
- for c0 in 2 3 4 5 6 7

Doing the 1st chromosome separately allows it to have a different naming pattern - it can have the name of the final, combined dataset, and the blocks from the other single-chromosome datasets are moved into it.

loadChr() can take as input either .vcf.gz or .vcf.
Also, it will grep the input to select the data for the chromosome indicated by the 1st argument.
Because of the time take for gzip -d and grep-ing each chr out of the vcf,
it can save time to do this in advance, and pass just the .vcf for 1 chromosome to loadChr().
For smaller datasets, passing a single .vcf containing all chromosomes, or even a .vcf.gz, may be more convenient.


In cases where the server ssh connection may time out, it may be necessary to either put the process in the background and use occasional keyboard input to keep the connection, or copy the necessary definitions and commands into a script file and nohup it.
e.g. keep an eye on db size and its disk space :
```
sudo du -ks /mnt/data_blast/mongodata_barley
df -h !$
```

```
# edit the .pl : shortName=LC_WGS_SNP
refn=Hordeum_vulgare_RGT_Planet_v1
datasetId=Hordeum_vulgare_RGT_Planet_v1.PanGenome_LowCoverage_WGS_SNPs

( for c0 in 1 2 3 4 5 6 7; do c=${c0}H; echo $c; vcfGz=BPG-LC_RGT_Planet:chr$c.bi-allelic.maf0.01_ACgt2.SNPList.vcf; time loadChr $c $vcfGz ${datasetId}_$c $refn ; done  )  &
```

This will output the dataset name, and then the id of the block added is output as each chunk is added.
```
{"id":"Hordeum_vulgare_RGT_Planet_v1.PanGenome_HighCoverage_WGS_SNPs_1H"}
...
{"status":{"blockId":"60d9bcb02ba90758c257dfb4"}}
```

#### Combining into a single dataset

Using mongo shell, check the names and details of the datasets and blocks created :
```
> db.Dataset.find({_id : /PRJEB8044/})
{ "_id" : "Hordeum_vulgare_Hv_IBSC_PGSB_v2.PRJEB8044_Exome_SNPs", "tags" : [ "SNP", "HighDensity" ], "type" : "linear", "namespace" : "Hordeum_vulgare_Hv_IBSC_PGSB_v2:Hordeum_vulgare_Hv_IBSC_PGSB_v2_Exome_SNPs", "meta" : { "type" : "Genome", "shortName" : "WGS" }, "public" : true, "readOnly" : true, "createdAt" : ISODate("2021-06-28T11:38:05.442Z"), "updatedAt" : ISODate("2021-06-28T11:38:05.442Z"), "clientId" : ObjectId("5e5ed9fa0ae7900001cae97c"), "parent" : "Hordeum_vulgare_Hv_IBSC_PGSB_v2", "name" : "Hordeum_vulgare_Hv_IBSC_PGSB_v2.PRJEB8044_Exome_SNPs" }
...
> db.Block.find ( {datasetId : /10M/} )
...
```

In this example, the chr1H dataset has the desired final name, so all that is required is to move the blocks from the other datasets into it:
```
db.Block.updateMany ( {name : /[2-7]H/, datasetId : /PRJEB8044/}, {$set : {datasetId : "Hordeum_vulgare_Hv_IBSC_PGSB_v2.PRJEB8044_Exome_SNPs" }} )
{ "acknowledged" : true, "matchedCount" : 6, "modifiedCount" : 6 }
db.Block.updateMany ( {name : "Un", datasetId : /PRJEB8044/}, {$set : {datasetId : "Hordeum_vulgare_Hv_IBSC_PGSB_v2.PRJEB8044_Exome_SNPs" }} )
{ "acknowledged" : true, "matchedCount" : 1, "modifiedCount" : 1 }
```

Manually delete datasets 2H - Un via Pretzel GUI, and "Hordeum_vulgare_Hv_IBSC_PGSB_v2.PRJEB8044_Hordeum_vulgare_Hv_IBSC_PGSB_v2.PRJEB8044_Exome_SNPs"

If the desired meta.shortName was not set in snps2Dataset.pl, it can be done via mongo shell or in the GUI :
```
db.Dataset.updateOne({_id : /PRJEB8044/}, {$set : {'meta.shortName' : 'PRJEB8044_SNP'}})
{ "acknowledged" : true, "matchedCount" : 1, "modifiedCount" : 1 }
```
Noting that // can match other dataset ids, so exact match may be better : {_id : "Hordeum_vulgare_Hv_IBSC_PGSB_v2.PRJEB8044_Exome_SNPs" }

Check the result
```
> db.Dataset.find({_id : /PRJEB8044/})
```


The template in snps2Dataset.pl has public : true, otherwise the Pretzel GUI can be used to make the datasets public.


##### Replacing dataset id

In this example, the 1st dataset doesn't have the desired final name, so it is necessary to insert a new dataset and move the blocks into it.
```
> db.Dataset.find({_id : /Low/})
{ "_id" : "Hordeum_vulgare_RGT_Planet_v1.PanGenome_LowCoverage_WGS_SNPs_1H", "tags" : [ "SNP", "HighDensity" ], "type" : "linear", "namespace" : "Hordeum_vulgare_RGT_Planet_v1:Hordeum_vulgare_RGT_Planet_v1_Exome_SNPs", "meta" : { "type" : "Genome", "shortName" : "LC_WGS_SNP" }, "public" : true, "readOnly" : true, "createdAt" : ISODate("2021-06-29T02:10:23.439Z"), "updatedAt" : ISODate("2021-06-29T02:10:23.439Z"), "clientId" : ObjectId("5e5ed9fa0ae7900001cae97c"), "parent" : "Hordeum_vulgare_RGT_Planet_v1", "name" : "Hordeum_vulgare_RGT_Planet_v1.PanGenome_LowCoverage_WGS_SNPs_1H" }
...
```
We want to rename : 
- _1H -> ''
- Hordeum_vulgare_RGT_Planet_v1_Exome_SNPs ->
Hordeum_vulgare_RGT_Planet_v1.PanGenome_LowCoverage_WGS_SNPs

Using the information listed by the above .find() as a template, modify the _id and namespace etc, and insert :
```
db.Dataset.insertOne(
{ "_id" : "Hordeum_vulgare_RGT_Planet_v1.PanGenome_LowCoverage_WGS_SNPs",
 "tags" : [ "SNP", "HighDensity" ], "type" : "linear",
 "namespace" : "Hordeum_vulgare_RGT_Planet_v1:Hordeum_vulgare_RGT_Planet_v1.PanGenome_LowCoverage_WGS_SNPs",
 "meta" : { "type" : "Genome", "shortName" : "LC_WGS_SNP" },
 "public" : true, "readOnly" : true,
 "createdAt" : ISODate("2021-06-29T02:10:23.439Z"),
 "updatedAt" : ISODate("2021-06-29T02:10:23.439Z"),
 "clientId" : ObjectId("5e5ed9fa0ae7900001cae97c"),
 "parent" : "Hordeum_vulgare_RGT_Planet_v1",
 "name" : "Hordeum_vulgare_RGT_Planet_v1.PanGenome_LowCoverage_WGS_SNPs" })

{
	"acknowledged" : true,
	"insertedId" : "Hordeum_vulgare_RGT_Planet_v1.PanGenome_LowCoverage_WGS_SNPs"
}
```

