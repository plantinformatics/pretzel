## Overview 

Pretzel datasets may contain metadata, which may be simply displayed by Pretzel, or it may also be understood according to the following conventions.

This guide explains how the metadata is represented in the Pretzel JSON format, which field names are recognised by Pretzel, and how these values are used.

### See also

- top-level README.md : [Loading data](../../README.md#loading-data)
- [meta in data loading examples](data-loading.md#combining-into-a-single-dataset)

### Syntax

This example of a dataset shows how the metadata is contained in a "meta" field, at the top-level of the JSON object.
```
{ "_id" : "Hordeum_vulgare_RGT_Planet_v1.PanGenome_LowCoverage_WGS_SNPs",
 "tags" : [ "SNP", "HighDensity" ], "type" : "linear",
 "namespace" : "Hordeum_vulgare_RGT_Planet_v1:Hordeum_vulgare_RGT_Planet_v1.PanGenome_LowCoverage_WGS_SNPs",
 "meta" : { "type" : "Genome", "shortName" : "LC_WGS_SNP" },
...
```


### meta.type

If a Dataset defines meta.type with value "Genome", the dataset is used as a parent in the Genome tab in the Dataset Explorer.
That is, dataset which reference this dataset as their parent are grouped under it, in a 3-layer structure : parent / dataset / block.

Other values of meta.type also create a new tab in the Dataset Explorer with that name, listing datasets which have that value for meta.type.
Conventionally these values are used :
- Genetic Map
- QTL


meta.type === 'QTL' is also currently used to signify :
- request all features of this block and its parent block, to enable calculation of the .value[] of the QTL features.
- colour axis track rectangle by values.Trait instead of block colour


### meta.shortName

If a Dataset defines meta.shortName, this value is used as an alternative in the display where space is limited, e.g. in the Dataset Explorer, in the axis titles in the graph, and in the Block name in the Selected Features table.

### Data Curation Conventions 

These fields within meta have been used to record the publication from which the dataset originates :
- meta.year
- meta.source

- meta.variety	 variety / breed of the species

### Control flags

- meta.paths	'false' indicates that alignments should not be requested and displayed for this dataset.  (The default value is true.)

- meta.phased	'true' indicates : show a directional triangle for the feature instead of a rectangle in the split axis tracks.  Equivalently the dataset can be given the tag 'phased'.

- meta.referenceHost	indicate a preference when using secondary Pretzel servers which define multiple copies of a reference.


### Spreadsheet metadata

The Metadata worksheet of a spreadsheet which is uploaded to Pretzel may contain :
- commonName	recorded as meta.commonName; this can be used to group the datasets by species common name in the Dataset Explorer.
- parentName	indicates the parent reference of a dataset
- platform	the namespace will be constructed from parentName:platform


### Internal meta values

Pretzel also records temporarily, some additional values in dataset .meta :

- meta._origin	the secondary Pretzel server from which a dataset was received;  this contains fields : .host - the name of the secondary server, .imported - the time of receipt.
- meta.apiHost	the API host from which the block was received

