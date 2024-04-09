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

### Get started now

Agriculture Victoria hosts the following Pretzel instances for the following species for public datasets:

| Species | URL |
|--|--|
| Wheat | [https://plantinformatics.io/](https://plantinformatics.io/) |
| Pulses | [https://pulses.plantinformatics.io/](https://pulses.plantinformatics.io/) |
| Barley | https://barley.plantinformatics.io/](https://barley.plantinformatics.io/)  |

## Quick start (Local hosting using docker)

Please make sure docker has been installed before attempting any of the below steps.

https://docs.docker.com/engine/install/

For instructions on how to host pretzel without docker see https://docs.plantinformatics.io/

### Docker on linux

In the pretzel directory run the following command 

    docker compose up

Point your browser to [localhost:3000](http://localhost:3000/) and you should see:

(image of login page)

You can create a user by signing up, then logging in with these details (by default, the user is created immediately without any  verification).

## Funding

Currently (2022-) funded as part of the Australian Grains Genebank Strategic Partnership, a $30M joint investment between the Victorian State Government and Grains Research and Development Corporation (GRDC) that aims to unlock the genetic potential of plant genetic resources for the benefit of the Australian grain growers.

Between 2020-2022 funded and developed by Agriculture Victoria, Department of Jobs, Precincts and Regions (DJPR), Victoria, Australia.

Between 2016-2020 funded by the Grains Research Development Corporation (GRDC) and co-developed by Agriculture Victoria and CSIRO, Canberra, Australia.
