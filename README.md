
<img src="https://pretzel-images-public.s3.ap-southeast-2.amazonaws.com/pretzel.svg" width=100 height=100>

[![Docker pulls](https://img.shields.io/docker/pulls/plantinformaticscollaboration/pretzel.svg?logo=docker&style=for-the-badge)](https://hub.docker.com/r/plantinformaticscollaboration/pretzel)
[![Docker Image Version  (latest semver)](https://img.shields.io/docker/v/plantinformaticscollaboration/pretzel.svg?logo=docker&style=for-the-badge)](https://hub.docker.com/r/plantinformaticscollaboration/pretzel)

## What is Pretzel

Pretzel is a web-based online framework for the real-time interactive display integration of genetic and genomic datasets. It is built on Ember.js (front end), Loopback.js (back end) and D3.js (visualisation).

## Get started now

The Australian Grains Genebank Strategic Partnership hosts the publicly accessible AGG Pretzel at:

### [https://agg.plantinformatics.io/](https://agg.plantinformatics.io/)

This includes the [genotype datasets released by the Partnership](https://dataverse.harvard.edu/dataverse/australiangrainsgenebank-genotypedata) together with curated datasets that enable users to connect research and breeding knowledge to the AGG.

Users can sign up for an account by following the Sign Up links in the top right of the page.

Documentation is available at:

### [https://docs.plantinformatics.io/](https://docs.plantinformatics.io/)

## Install and run Pretzel

Before starting, install:

- [Git](https://git-scm.com/downloads), using the installer for your operating
  system;
- [Docker](https://docs.docker.com/get-started/get-docker/), including Docker
  Compose v2. Docker Desktop includes Compose on Windows and macOS. On Linux,
  follow Docker's instructions for Docker Engine and the Compose plugin.

Verify that both commands are available:

```sh
git --version
docker compose version
```

Use `docker compose`, not the legacy `docker-compose` command.

1. Create a parent directory for Pretzel's working copy and persistent data,
   then clone the repository. A simple layout places everything below a
   directory named `pretzelDir`.
   The following describes how to do this using MS Windows CMD Shell, PowerShell, or Linux/Unix Bash :

   In Windows Command Prompt (`cmd.exe`):

   ```bat
   mkdir pretzelDir
   cd pretzelDir
   dir
   mkdir mongodb landing-page data data\blast cache
   git clone https://github.com/plantinformatics/pretzel.git
   cd pretzel
   ```

   In Windows PowerShell, the equivalent is:

   ```powershell
   New-Item -ItemType Directory -Path pretzelDir
   Set-Location pretzelDir
   pwd
   New-Item -ItemType Directory -Force `
     -Path "mongodb", "landing-page", "data/blast", "cache"
   git clone https://github.com/plantinformatics/pretzel.git
   Set-Location pretzel
   ```

   Or, in Linux / Unix Bash :
   ```bash
   mkdir pretzelDir
   cd pretzelDir
   pwd
   mkdir mongodb landing-page data data/blast cache
   git clone https://github.com/plantinformatics/pretzel.git
   cd pretzel
   ```
 

   This creates the Git working directory at `pretzelDir/pretzel`. The data
   directories do not have to share a parent directory; this layout is only a
   convenient example.
   In the following step (configuring `.env`) you will need to know the absolute
   path of the parent directory `pretzelDir`.  In the above commands this is
   displayed using `dir` in MS Windows CMD Shell (it is also displayed in the
   command prompt), or in PowerShell / Linux/Unix Bash using `pwd`.

2. (Optional) You can load a previous Pretzel database by copying the MongoDB data directory into the directory created above : `pretzelDir/mongodb/`.
   This should be done before starting the database below using `docker compose up`, i.e. while the MongoDB server is not running.
   You can copy files from another MongoDB data directory while that MongoDB server is not running.
   The files you copy into `pretzelDir/mongodb/` will look like this :

   ```text
   .dbshell
   .mongorc.js
   WiredTiger
   ...
   collection-0-197248881868610081.wt
   ...
   diagnostic.data/
   index-1-197248881868610081.wt
   ...
   journal/
   mongod.lock
   ...
   ```

  You can replace the database after the MongoDB server is stopped (see `docker compose down` below) - remove the files in `pretzelDir/mongodb/` and copy in the MongoDB data files you wish to use.  You can restart the MongoDB server after the files are copied in, using `docker compose up` as noted below.


3. Create a local `.env` from the committed [`.env.template`](.env.template).


   In Windows Command Prompt, run:

   ```bat
   copy .env.template .env
   ```

   In Windows PowerShell, run:

   ```powershell
   Copy-Item .env.template .env
   ```

   On Linux or macOS, run:

   ```sh
   cp .env.template .env
   ```



   Open `.env` in a text editor and replace every `CHANGE_ME` value. In
   particular:

   - if you are using a database password, which is not required if your database is local and will not be exposed to a LAN / WAN / internet, set `DB_PASS` to a long, unique password, and uncomment the DB_PASS line.
   - set `pretzelDir` to the absolute path of the parent directory created in
     step 1. The other directory settings in the template are derived from it;
     alternatively, replace them with unrelated absolute paths;
   - set `API_HOST` to the public DNS name for a deployed instance, or leave it
     as `localhost` for local use; leave `API_PORT_PROXY` empty unless requests
     reach Pretzel through a reverse proxy;
   - if you wish to use administrator moderation of sign-ups, configure the `EMAIL_*` values for the site's SMTP service. Otherwise, no edit is required - the default value configured in .env.template is `EMAIL_VERIFY=NONE`, which disables email verification, and is suitable for a local trial;
   - replace `handsOnTableLicenseKey` if your use requires a commercial
     Handsontable licence.

   The template contains examples only. Never commit the generated `.env`, real
   passwords, licence keys, email addresses, hostnames, or
   organisation-specific paths.
   For production, restrict `.env` permissions (for example, `chmod 600 .env`)
   or supply a separately managed file with `docker compose --env-file`.

4. Pull the published images and start the services.
   On MS Windows, this requires that 'Docker Desktop' has been started, so start that before this step.
   (As an alternative to `docker compose pull`, see the section below 'Building the Docker image from source').

   ```sh
   docker compose pull
   docker compose up -d --no-build
   ```

5. Check startup and open [http://localhost:3010](http://localhost:3010) (or the host and port selected
   in `.env`):

   ```sh
   docker compose ps
   docker compose logs -f api
   ```

Stop Pretzel with a single Ctrl-C in the terminal where you did `docker compose up`, or in another terminal do `docker compose down`. This preserves MongoDB and application
data in the configured host directories.

### Building the Docker image from source
To build the application image from source, use the repository Dockerfile directly:

```sh
docker build -t plantinformaticscollaboration/pretzel:local .
PRETZEL_SERVER_IMAGE=plantinformaticscollaboration/pretzel:local \
  docker compose up -d --no-build
```

Sequence search additionally uses the `blastserver` service. Its databases must
be installed below the configured `mntData/blast` directory; see the
[BLAST administration guide](doc/adminGuides/data/blast.md). The Compose file
mounts the Docker socket into this service, so only run it on a trusted host.

## Pretzel features

- Integration of a diverse range of genetic and genomic information

- Genetic map and chromosome-scale genomic assembly alignments

- Visualisation of genomic features, including genes, markers and QTLs

- Genotype data visualisation, filtering, dataset intersection

- Searching by feature/marker name or by sequence (when BLAST database set up)

- Ability to upload custom datasets  by drag and dropping Excel templates

- User-defined access controls on uploaded datasets, including sharing to groups of users

- Dynamic link to Crop Ontology API for QTL trait definition and visualisation

## Examples of Pretzel in action

### Simultaneously investigating genome to genetic map relationships and zooming to specific regions to visualize genomic features

![Screenshot1](https://pretzel-images-public.s3.ap-southeast-2.amazonaws.com/screenshot1.png)

> IWGSC RefSeq v1.0 genome assembly chromosome 7A zoomed around the RAC875_c1277_250 90k marker, with 90k markers (blue) and HC genes (purple) shown (left axis), aligned to the 8-way MAGIC genetic map (Shah et al. 2018, middle axis) and Avalon x Cadenza genetic map (Wang et al. 2014, right axis). The table shows relative position of markers in the genome assembly and MAGIC map.

### Visualising chromosome-scale alignments between a genetic map to a genome assembly and syntenic relationships between different species' genomes

![Screenshot2](https://pretzel-images-public.s3.ap-southeast-2.amazonaws.com/screenshot2.png)

> Westonia x Kauz genetic map based on 90k markers (Wang et al. 2014, left axis) aligned to IWGSC RefSeq v1.0 chromosome 2A (middle axis), aligned to barley Morex V2 assembly (right axis) with red lines between orthologous genes between wheat and barley.

### Projecting QTL information from a genetic map into a genome assembly

![Screenshot3](https://pretzel-images-public.s3.ap-southeast-2.amazonaws.com/screenshot3.png)

> TaCOL-B5 marker position from Zhang et al. 2022 positioned in IWGSC RefSeq v1.0 chromosome 2A (left axis), aligned to SSR map from Shankar et al. 2017 with 3 QTLs shown in blue (right axis).

### Exploring haplotypes around a gene in diverse germplasm

![Screenshot4](https://pretzel-images-public.s3.ap-southeast-2.amazonaws.com/screenshot4.png)

> Exome-based haplotypes (right panel) from a subset of accessions from Keeble-Gagnere et al. 2021 ([https://doi.org/10.7910/DVN/5LVYI1](https://doi.org/10.7910/DVN/5LVYI1 "https://doi.org/10.7910/dvn/5lvyi1")), with SNP positions shown around TraesCS4A01G343700 in IWGSC RefSeq v1.0 (left panel).


## Funding

Currently (2022-) funded as part of the Australian Grains Genebank Strategic Partnership, a $30M joint investment between the Victorian State Government and Grains Research and Development Corporation (GRDC) that aims to unlock the genetic potential of plant genetic resources for the benefit of the Australian grain growers.
https://agriculture.vic.gov.au/crops-and-horticulture/the-australian-grains-genebank

Between 2020-2022 funded and developed by Agriculture Victoria, Department of Jobs, Precincts and Regions (DJPR), Victoria, Australia.

Between 2016-2020 funded by the Grains Research Development Corporation (GRDC) and co-developed by Agriculture Victoria and CSIRO, Canberra, Australia.

<img alt="agvic" src="https://agriculture.vic.gov.au/__data/assets/git_bridge/0004/866065/dist/images/agriculture-logo.svg" width="300"><img alt="grdc" src="https://agriculture.vic.gov.au/__data/assets/image/0005/906422/GRDC-logo.jpg" width="300">
