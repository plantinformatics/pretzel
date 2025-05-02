#### Downloading data files from dataverse.harvard.edu

In the following these variables are used :
- $vcfDir path containing the VCF dataset directories
e.g. vcfDir may be .../pretzel/tmp/vcf, or /mnt/pretzelData/prod/blast/vcf/ etc
- $datasetId the VCF dataset ID, which is given in the spreadsheet worksheet name 'VCF|datasetId'
e.g. Redberry_V2_VCF-AGG-raw-r1




Create a directory in $vcfDir to put the dataset in.

```
cd $vcfDir
mkdir $datasetId
cd $datasetId
```

Create an account on the dataverse server [dataverse.harvard.edu](https://dataverse.harvard.edu),
and [create an API token](https://guides.dataverse.org/en/latest/api/getting-started.html#getting-an-api-token)
(see also the user account [guide](https://guides.dataverse.org/en/latest/user/account.html)).

The persistentId of the dataset is in the dataset web page URL :
https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/5LVYI1

Download the dataset :
```
export API_TOKEN=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
export SERVER_URL=https://dataverse.harvard.edu
export PERSISTENT_ID=doi:10.7910/DVN/5LVYI1
curl -L -O -J -H "X-Dataverse-key:$API_TOKEN" $SERVER_URL/api/access/dataset/:persistentId/?persistentId=$PERSISTENT_ID
```
This creates a file dataverse_files.zip (6110751421 bytes).

Extract the files of the dataset
```
unzip dataverse_files.zip
```

Create links from the chromosome names ('chr1A.vcf.gz' etc) to the actual file names.


Change to the directory which contains the VCF files for the dataset.
```
cd $vcfDir
cd $datasetId
```

The .vcf.gz files may be per-dataset or per-chromosome, and these cases are handle separately in the following.
This is also described in [pretzel/doc/adminGuides/data/blast.md](../adminGuides/data/blast.md).


This handles the case where each chromosome is in a separate .vcf.gz file, with "chr$i" embedded in the name  :
```
# $vcfGz is the common prefix of the chromosome .vcf.gz file names
vcfGz=Ta_PRJEB31218_IWGSC-RefSeq-v1.0_filtered-SNPs ; for i in {1,2,3,4,5,6,7}{A,B,D} ; do ln -s $vcfGz.chr$i.vcf.gz chr$i.vcf.gz ; done
```


Alternatively, in the case a single .vcf.gz contains all chromosomes, so all chromosome link files refer to this single file :
e.g.
```
# this is : cd $datasetId
cd Redberry_V2_VCF-AGG-raw-r1

# $vcfGz is the name of the VCF.
vcfGz=250228_AGG-Lentil_Raw_Anchored-Lcu.2RBY.vcf.gz
for i in {1,2,3,4,5,6,7} ; do ln -s $vcfGz Lcu.2RBY.Chr$i.vcf.gz ; done

```

---


Optional : to get the dataset metadata, from the web page; the collection ID is in the section hierarchy URL :
```
 "Filtered SNP matrix of raw genotypes used for wheat LD analysis".
https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/5LVYI1&version=1.0

Harvard Dataverse >
  Illumina Infinium Wheat Barley 40K SNP array v1.0 >
    right-click : copy url :
    https://dataverse.harvard.edu/dataverse/WheatBarley40k_v1
export ID=WheatBarley40k_v1
export SERVER_URL=https://dataverse.harvard.edu
curl -H X-Dataverse-key:$API_TOKEN $SERVER_URL/api/dataverses/$ID/contents -o dataset_metadata.json
```


---

Previous version (a2491c60) of this document described how to download the dataset files using the information from the web page instead of adding an account and using the API.

---
