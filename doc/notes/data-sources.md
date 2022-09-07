#### Downloading data files from dataverse.harvard.edu

This dataset will be used as an example :
```
    "source" : {
      "url" : "https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/5LVYI1",
```

That page lists the files comprising the dataset, and in the detail page for each page there is a 'Download URL'.
The following process extracts that URL in association with the file name.

If there are <10 files they will all be listed on the first page, and the file Ids and names can be extracted with :
```
wget -O - -nv 'https://dataverse.harvard.edu/dataset.xhtml?persistentId=doi:10.7910/DVN/5LVYI1' | fgrep -C1 '?fileId='
```
Otherwise, set the 'Files per page' to the maximum (50) and copy the content using the Web Inspector (in the browser right-click : Inspect Element) : in the Elements tab, right-click on the <html> element and Copy : Outer HTML.  This copies the dynamic content of the page to the clipboard.
Paste the clipboard into a file using a text editor, e.g. Notepad / Wordpad, or cat > file <<EOF, paste, then <Enter> and EOF.
As above, extract the file Ids and names from the html file using :
```
fgrep -C1 '?fileId=' page_all_inspector_copy.html 
```

Extract the fileId-s and corresponding fileNames into this format :
```
getChr 4924871 checksums.md5
getChr 4924969 Ta_PRJEB31218_IWGSC-RefSeq-v1.0_filtered-SNPs.chr1A.vcf.gz
getChr 4924980 Ta_PRJEB31218_IWGSC-RefSeq-v1.0_filtered-SNPs.chr1B.vcf.gz
...
```
this can be done using an edit script e.g. using an Emacs script :
```
(replace-regexp 
"                    <a href=\"/file.xhtml\\?fileId=\\(.+\\)&amp;version=1.0\">
                        \\(.+\\)" "getChr \\1 \\2")
(replace-string "--
                    
" "")
```

The getChr commands prepared above are executed by this function :
```
function getChr() { fileId=$1; fileName=$2;
  url=$(wget  -O - -nv "https://dataverse.harvard.edu/file.xhtml?fileId=$fileId&version=1.0" | grep 'dataverse.harvard.edu/api/access/datafile/[0-9]' |  sed 's,<code>,,;s,</code>,,')
  wget -O $fileName -nv $url && ls -gG $fileName && md5sum $fileName
}
```

---
