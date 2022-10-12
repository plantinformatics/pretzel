#### Downloading data files from dataverse.harvard.edu


Create a directory in $vcfDir to put the dataset in.
```
cd pretzel/tmp/vcf
mkdir AVR_1K-CoreCollection_Wheat_Exome_genotypes
cd !$
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

Extract the files of the dataset, and create links from the chromosome names ('chr1A.vcf.gz' etc) to the actual file names.
```
unzip dataverse_files.zip

vcfGz=Ta_PRJEB31218_IWGSC-RefSeq-v1.0_filtered-SNPs ; for i in {1,2,3,4,5,6,7}{A,B,D} ; do ln -s $vcfGz.chr$i.vcf.gz chr$i.vcf.gz ; done
```

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
