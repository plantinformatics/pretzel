# Introduction

This document explains for Pretzel data administrators how to set up the databases for blast and vcf.

# Directory overview

The blast and vcf databases are in volumes which are shared into the Pretzel server container, and referred to by the environment variables `$blastDir` and `$vcfDir` respectively.
Typically these are sibling directories, e.g. :
```
/mnt/pretzelData/prod/
  blast/
  vcf/
```
So the default values of `$blastDir` and `$vcfDir` are `$mntData/blast` and `$mntData/vcf` respectively.
Typically `$mntData` is a separate data volume (e.g. EBS on AWS).

This is illustrated in [`pretzel/doc/adminGuides/install_and_configure.md`](../install_and_configure.md#configuration-of-docker-compose-yaml)
which lists the volumes shared into the Pretzel server container.

---

# Blast

## Data directory and file setup for Blast 

In Pretzel upload spreadsheets, each worksheet name matches the column name in the Metadata worksheet which defines metadata for the datasets,
e.g. for a worksheet name `Genome|X`, the Metadata column is `Genome|X`.

The worksheet name for a Genome defines the Genome datasetId, which is used to identify the location of the blast database, e.g. for `Genome|datasetId`, the parentName in Metadata for VCF should be `datasetId`. This determines the axis which the VCF data is displayed on, and the chromosome length will match the VCF.

The worksheet name for a VCF defines its datasetId, which is used to identify the location of the VCF database, e.g. for `Genome|datasetId`, the parentName in Metadata for VCF should be `datasetId`.

To allow for blast and VCF databases to have different naming conventions for chromosomes, the chromosome name which is displayed in the Pretzel GUI can be different to these names.
In the Genome and VCF worksheets, the `Chromosome` column identifies the chromosome name used in the blast and VCF databases, and there can be an extra column `Scope` which is displayed as the axis name in the Pretzel GUI, if that should be different.  The default value for `Scope` is to use the value from the `Chromosome` column.

The blast database file names have these suffixes :
```
.ndb
.nhr
.nin
.njs
.not
.nsq
```
They are each prefixed with a common name, e.g. dataset.fasta.

Pretzel datasets have a displayName, which appears in the Dataset Explorer in the left panel, and datasetId which identifies the dataset uniquely in the MongoDB database.
The design of Pretzel allows the blast dataset name to be different to the Pretzel datasetId, which is useful when the database is the output of a pipeline which may be re-run, or there may be a soft-link to a shared data repository where it is not desired to change the name.

This is enabled by the following configuration : within $blastDir/datasetId/, for each dataset X, there are 2 entries :
- X.dir  which contains the blast database files;  this may be a directory, or a soft link to a directory in a separate data volume.
- X.dbName which is a text file containing the blast db file name prefix, e.g. dataset.fasta.

It may be preferred to keep the blast database files separate from the datasetId configuration,
so there is also conventionally a directory $blastDir/GENOME_REFERENCES/, which can contain a directory for each blast database, and the X.dbName can be a soft-link to this



---

# VCF

## Data directory and file setup for VCF / bcftools 

Unlike  the blast databases, VCF doesn't need .dir and .dbName entries;  the structure is simply :
```
$vcfDir/
- datasetId/
- - Chr1A.vcf.gz ...
```
Where datasetId is derived from the worksheet name 'VCF|datasetId',
and Chr1A is the Chromosome name from the 'VCF|' worksheet.


The Pretzel server will use $vcfDir (default tmp/vcf relative the server cwd) to locate the VCF data.
Within that directory it looks up datasetname/chrxx where datasetname is the datasetId.id, i.e. the unique id of the dataset, and xx is 1A etc.

Because bcftools looks up a /chrxx within datasetname/,  the datasetname/ can be a symbolic link.

The Pretzel server
(see [vcfGenotypeLookup.bash](https://github.com/plantinformatics/pretzel/blob/master/lb4app/lb3app/scripts/vcfGenotypeLookup.bash) )
checks for a .csi for the .vcf.gz, and if not present it will create it using `bcftools index`
The chrxx can also be a symbolic link, with the result that the created .csi file will be chr1A.vcf.gz.csi instead of being based on the symbolic link value.

Example :
```
ls -l vcf
    8 Jun 10 13:51 Triticum_aestivum_IWGSC_RefSeq_v1.0 -> wheat_LD
      Jun 10 13:53 wheat_LD/

ls -l vcf/wheat_LD
        58 Jun 10 13:52 chr1A.vcf.gz -> Ta_PRJEB31218_IWGSC-RefSeq-v1.0_filtered-SNPs.chr1A.vcf.gz
     71162 Jun 10 13:53 chr1A.vcf.gz.csi
 299181674 Jul 26  2021 Ta_PRJEB31218_IWGSC-RefSeq-v1.0_filtered-SNPs.chr1A.vcf.gz
```

Setting up the chromosome link files :

In this first case, a single .vcf.gz contains all chromosomes, so all chromosome link files refer to this single file :

```
cd $vcfDir
cd *40K*XT*
vcfGz=_40K__samples_XT.exomeIDs.vcf.gz ; for i in {1,2,3,4,5,6,7}{A,B,D} ; do ln -s $vcfGz $i.vcf.gz ; done
```

In this case, each chromosome is in a separate .vcf.gz file :
```
vcfGz=Ta_PRJEB31218_IWGSC-RefSeq-v1.0_filtered-SNPs ; for i in {1,2,3,4,5,6,7}{A,B,D} ; do ln -s $vcfGz.chr$i.vcf.gz chr$i.vcf.gz ; done
```

Check the links are correct, using ls -lL (-L follows symbolic links) :
```
ls -lL chr*.vcf.gz
```


---

## Datasets to access VCF data

Within the Pretzel MongoDB database we create a view dataset which identifies and refers to the VCF dataset.

The simplest way to create these is via a spreadsheet, based on one of these spreadsheet
template [files](https://github.com/plantinformatics/pretzel/tree/develop/resources/data_templates).

e.g.

| Chromosome | Start | End |
|---|---|---|
| Chr1A | 0 | 7123456 |
| Chr1B | 0 | 6123456 |
...

Pretzel also supports upload of datasets defined in JSON files, which was used before spreadsheet upload was added, and some earlier datasets are defined in this form.


If the .vcf.gz has chromosomes named chr1A instead of 1A, then this can be configured in the database after the spreadsheet is uploaded
(i.e. to prefix the name with "chr"; the .scope is used for the axis, and the .name is used for VCF lookup).


---

--------------------------------------------------------------------------------
