

[![Docker pulls](https://img.shields.io/docker/pulls/plantinformaticscollaboration/pretzel.svg?logo=docker&style=for-the-badge)](https://hub.docker.com/r/plantinformaticscollaboration/pretzel)
[![Docker Image Version  (latest semver)](https://img.shields.io/docker/v/plantinformaticscollaboration/pretzel.svg?logo=docker&style=for-the-badge)](https://hub.docker.com/r/plantinformaticscollaboration/pretzel)

This README is just a fast quick start document. You can find more detailed documentation at https://docs.plantinformatics.io/

## What is Pretzel

Pretzel is a web-based online framework for the real-time interactive display integration of genetic and genomic datasets. It is built on Ember.js (front end), Loopback.js (back end) and D3.js (visualisation).

Features include:

- Integration of a diverse range of genetic and genomic information

- Genetic map and chromosome-scale genomic assembly alignments

- Visualisation of genomic features, including genes, markers and QTLs

- Genotype data visualisation, filtering, dataset intersection

- Searching by feature/marker name or by sequence (when BLAST database set up)

- Ability to upload custom datasets  by drag and dropping Excel templates

- User-defined access controls on uploaded datasets, including sharing to groups of users

![Screenshot1](https://private-user-images.githubusercontent.com/20571319/321076032-9044a096-519d-486a-8bb1-d837f741432b.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3MTI3MjUyODksIm5iZiI6MTcxMjcyNDk4OSwicGF0aCI6Ii8yMDU3MTMxOS8zMjEwNzYwMzItOTA0NGEwOTYtNTE5ZC00ODZhLThiYjEtZDgzN2Y3NDE0MzJiLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNDA0MTAlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjQwNDEwVDA0NTYyOVomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPWQwOTkyZDg0NWI3MDAxNTgwNjg0NDhkNmY3NGJjYTQ2YTcwYzg0OTY0MDE5NDZiNTljNjc4NTFlZGFiNmUwNDcmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0JmFjdG9yX2lkPTAma2V5X2lkPTAmcmVwb19pZD0wIn0.STN3ZEYmxYWeAaZAoLBDQtFkQEbMIuIGrtSZS9zr3I4)

> IWGSC RefSeq v1.0 genome assembly chromosome 7A zoomed around the RAC875_c1277_250 90k marker, with 90k markers (blue) and HC genes (purple) shown (left axis), aligned to the 8-way MAGIC genetic map (Shah et al. 2018, middle axis) and Avalon x Cadenza genetic map (Wang et al. 2014, right axis). The table shows relative position of markers in the genome assembly and MAGIC map.

![Screenshot2](https://private-user-images.githubusercontent.com/20571319/321076492-9bb75034-64ae-486e-b730-63e2d7e37ee8.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3MTI3MjUyODksIm5iZiI6MTcxMjcyNDk4OSwicGF0aCI6Ii8yMDU3MTMxOS8zMjEwNzY0OTItOWJiNzUwMzQtNjRhZS00ODZlLWI3MzAtNjNlMmQ3ZTM3ZWU4LnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNDA0MTAlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjQwNDEwVDA0NTYyOVomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPTYyNjY2Njk4YzVkMjViYjM1ZDcxMDJjOGFiZGJkMjkzNDdlNTFkYTkxMDQ1NWU2NjAzNDZkMWE3YzVlNjA4MzYmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0JmFjdG9yX2lkPTAma2V5X2lkPTAmcmVwb19pZD0wIn0.qHVvh2furR05--YwNJzAVwz7mwR-cttxrisoBG6LMkU)

> Westonia x Kauz genetic map based on 90 markers (Wang et al. 2014, left axis) aligned to IWGSC RefSeq v1.0 chromosome 2A (middle axis), aligned to barley Morex V2 assembly (right axis) with red lines between orthologous genes between wheat and barley.

![Screenshot3](https://private-user-images.githubusercontent.com/20571319/321077608-32c86838-ee11-417b-a637-eefa5aa1195b.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3MTI3MjUyODksIm5iZiI6MTcxMjcyNDk4OSwicGF0aCI6Ii8yMDU3MTMxOS8zMjEwNzc2MDgtMzJjODY4MzgtZWUxMS00MTdiLWE2MzctZWVmYTVhYTExOTViLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNDA0MTAlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjQwNDEwVDA0NTYyOVomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPWIyMjgxZGIzNGFkYTY4OWU1MzZhNWY1N2VkMTViNzcyMTM0MmYyODRmNzU5OGM2N2IyZWJkMjM2NjIxYTc0NzcmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0JmFjdG9yX2lkPTAma2V5X2lkPTAmcmVwb19pZD0wIn0.53hGaJIPCOdbLw-iLyjMcaN2huTfI3ubQh4jLQaJcyA)

> TaCOL-B5 marker position from Zhang et al. 2022 positioned in IWGSC RefSeq v1.0 chromosome 2A (left axis), aligned to SSR map from Shankar et al. 2017 with 3 QTLs shown in blue (right axis).

![Screenshot4](https://private-user-images.githubusercontent.com/20571319/321078255-8427e2ec-c9a6-402c-a2db-b6bb6758d31d.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3MTI3MjUyODksIm5iZiI6MTcxMjcyNDk4OSwicGF0aCI6Ii8yMDU3MTMxOS8zMjEwNzgyNTUtODQyN2UyZWMtYzlhNi00MDJjLWEyZGItYjZiYjY3NThkMzFkLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNDA0MTAlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjQwNDEwVDA0NTYyOVomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPTM5ZjU2ZmNhOWU3MjhmODBiZjVmMTZlMzZiNTBkYmI5NjBhMmM0MWU5OWM5OWI1MjEyZmU0ZTkyYjJiYjAxZDQmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0JmFjdG9yX2lkPTAma2V5X2lkPTAmcmVwb19pZD0wIn0.V2rf9kSeCx1wc51-04meSUJpvHqquXXB6-WMb40O2AU)

> Exome-based haplotypes (right panel) from a subset of accessions from Keeble-Gagnere et al. 2021 ([https://doi.org/10.7910/DVN/5LVYI1](https://doi.org/10.7910/DVN/5LVYI1 "https://doi.org/10.7910/dvn/5lvyi1")), with SNP positions shown around TraesCS4A01G343700 in IWGSC RefSeq v1.0 (left panel).

### Get started now

Agriculture Victoria hosts the following Pretzel instances for the following species for public datasets:

| Species | URL |
|--|--|
| Wheat | [https://plantinformatics.io/](https://plantinformatics.io/) |
| Pulses | [https://pulses.plantinformatics.io/](https://pulses.plantinformatics.io/) |
| Barley | https://barley.plantinformatics.io/  |

## Quick start (Local hosting using docker)

Please make sure docker has been installed before attempting any of the below steps.

https://docs.docker.com/engine/install/

For instructions on how to host pretzel without docker see https://docs.plantinformatics.io/

### Docker on linux

In the pretzel directory run the following command 

    docker compose up

Point your browser to [localhost:3000/signup](http://localhost:3000/signup) and you should see:

![login](https://private-user-images.githubusercontent.com/152138829/321110978-47cded7a-3414-434d-b005-bb3ea6777fc1.png?jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3MTI3MjcxMTQsIm5iZiI6MTcxMjcyNjgxNCwicGF0aCI6Ii8xNTIxMzg4MjkvMzIxMTEwOTc4LTQ3Y2RlZDdhLTM0MTQtNDM0ZC1iMDA1LWJiM2VhNjc3N2ZjMS5wbmc_WC1BbXotQWxnb3JpdGhtPUFXUzQtSE1BQy1TSEEyNTYmWC1BbXotQ3JlZGVudGlhbD1BS0lBVkNPRFlMU0E1M1BRSzRaQSUyRjIwMjQwNDEwJTJGdXMtZWFzdC0xJTJGczMlMkZhd3M0X3JlcXVlc3QmWC1BbXotRGF0ZT0yMDI0MDQxMFQwNTI2NTRaJlgtQW16LUV4cGlyZXM9MzAwJlgtQW16LVNpZ25hdHVyZT1kZGZhMzZmY2I0ZDY3N2U5YzJlNjMxMzZjMjM1MTg2NWFhNDM1MGNmYzE5ZmE4N2UwOTIxOTVmYjcxMGYwODUxJlgtQW16LVNpZ25lZEhlYWRlcnM9aG9zdCZhY3Rvcl9pZD0wJmtleV9pZD0wJnJlcG9faWQ9MCJ9.mLJ7q1GaWGCiO9ia_MPAssCaT2fu3x2v7s1WcPIgD4Q)

You can create a user by signing up, then logging in with these details (by default, the user is created immediately without any  verification).

For a full getting started guide please see https://docs.plantinformatics.io/


## Funding

Currently (2022-) funded as part of the Australian Grains Genebank Strategic Partnership, a $30M joint investment between the Victorian State Government and Grains Research and Development Corporation (GRDC) that aims to unlock the genetic potential of plant genetic resources for the benefit of the Australian grain growers.
https://agriculture.vic.gov.au/crops-and-horticulture/the-australian-grains-genebank

Between 2020-2022 funded and developed by Agriculture Victoria, Department of Jobs, Precincts and Regions (DJPR), Victoria, Australia.

Between 2016-2020 funded by the Grains Research Development Corporation (GRDC) and co-developed by Agriculture Victoria and CSIRO, Canberra, Australia.

<img alt="agvic" src="https://agriculture.vic.gov.au/__data/assets/git_bridge/0004/866065/dist/images/agriculture-logo.svg" width="300"><img alt="grdc" src="https://agriculture.vic.gov.au/__data/assets/image/0005/906422/GRDC-logo.jpg" width="300">
