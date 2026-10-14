# Pretzel spreadsheet format

Normative reference for generating Excel workbooks accepted by Pretzel. This is an authoring specification, not a user guide. Prefer the canonical forms below even where the current parser is more permissive.

## Workbook structure

- Use an Excel workbook (`.xlsx`/`.xltx`).
- Include a `Metadata` worksheet (project policy; the current parser can continue without it but warns for unmatched dataset sheets).
- Include one or more dataset worksheets named `<Type>|<DatasetName>`, e.g. `QTL|Wheat_CSv2.1_7AL_QTLs-KF`.
- `|` is the separator. Use the exact canonical type spelling and no space around `|`. Do not use leading/trailing whitespace in sheet names or metadata column headings. Prefer dataset names without spaces.
- A worksheet name is limited by Excel to 31 characters, including the type and `|`.
- Each dataset name must be unique in the target Pretzel instance, including among datasets owned by other users.
- Supported ordinary dataset types are `Map`, `SNP`, `Alignment`, `QTL`, `Haplotype`, `Genome`, and `VCF`. `Alias` and `AddMetadata` are specialised forms described below. Do not invent type prefixes even though the parser's sheet-name regex accepts alphabetic prefixes.
- Reserved non-dataset sheet names are `User Guide`, `Metadata`, `Chromosome Renaming`, and `Chromosomes to Omit`.
- The first row of every dataset worksheet is the header row. Do not put titles or comments above it.
- A row whose column-A value starts with `#` is ignored. Any column whose header starts with `#` is ignored. Blank rows are ignored.

## `Metadata` worksheet

Metadata is transposed: rows are fields and columns are datasets.

```text
Field        QTL|Dataset_A       Map|Dataset_B
Species      Triticum aestivum   Triticum aestivum
Crop         Wheat               Wheat
displayName  Descriptive name A  Descriptive name B
parentName   Parent_dataset
shortName                         Map B
platform                          multiple
```

- Column A contains metadata field names. The table begins at the row whose column-A value is exactly `Field`; preceding rows are ignored.
- Columns B onward each describe one dataset. Their row-`Field` value must exactly equal the corresponding dataset worksheet name. Case and whitespace matter; use identical strings.
- A metadata row whose column-A value starts with `#` is ignored. Empty keys and empty values are omitted.
- Metadata field names are case-sensitive. Arbitrary additional fields are allowed and become `Dataset.meta.<field>`.
- Periods in field names are converted to `_`; punctuation not accepted by the parser is removed. Use simple ASCII field names to avoid unintended normalisation.

Canonical metadata policy:

| Field | QTL | Alignment/SNP | Map | Meaning |
|---|---:|---:|---:|---|
| `Species` | required | required | required | Taxon, e.g. `Triticum aestivum` |
| `Crop` | required | required | required | Explorer crop filter, e.g. `Wheat`; this is the only field for which the current parser itself emits a missing-field warning |
| `displayName` | required | required | required | Descriptive name displayed in Explorer |
| `parentName` | required | required | not applicable | Exact Pretzel dataset name of the genome assembly or genetic map to which features anchor |
| `shortName` | not applicable | not applicable | required | Short label displayed above an axis; also required for a genome |
| `platform` | not applicable | not applicable | required | Marker technology, e.g. `90k`, `40k`, `SSRs`, or `multiple` |
| `licensing` | optional | optional | optional | Licence, e.g. `CC BY 4.0` or `none` |
| `Citation` | optional | optional | optional | Publication, personal communication, or `unpublished` |
| `DOI` | optional | optional | optional | Source DOI |
| `Comments` | optional | optional | optional | Dataset/study/curation description |
| `Contact` | optional | optional | optional | Uploader/person/organisation; email encouraged |

Parser-significant metadata:

- `parentName` becomes `Dataset.parent`, not `Dataset.meta.parentName`.
- `namespace` becomes `Dataset.namespace`. If absent and `platform` is present, namespace defaults to `<parentName>:<platform>` when a parent exists, otherwise `<platform>`.
- `tags` is split on spaces. `QTL` and `Haplotype` gain their type tag automatically. `VCF` gains `VCF view Genotype` automatically.
- A `Genome` with an installed BLAST database may specify the tag `BlastDb`; do not give a Genome the VCF tags.
- `Map` is stored with metadata type `Genetic Map`; other ordinary sheets default metadata `type` to their sheet type unless explicitly supplied.

Recommended additional metadata field names (spellings preserved; differently-cased names are distinct):

```text
Accession name
Acknowledgements
Categories
Publication
Comments
Contact
Curator
Crop
Data Source
Description
EBI-ENA ID
Growth Habit
Licensing
Marker type
Origin
Owner
PanBARLEXName
Pedigree
Population
Species
Year
description
displayName
name
platform
shortName
DOI
species
type
Year of release
Market class
Features
100 seed weight
Production Region
Number of Genes
cellColour
```

## Ordinary dataset worksheets

Header names are case-sensitive; use the spellings shown. Required below means authoring policy. Additional named columns are allowed and are stored under `Feature.values`.

| Type | Canonical required headers | Coordinates/semantics |
|---|---|---|
| `Map` | `Marker`, `Chromosome`, `Position` | Genetic-map position in cM |
| `SNP` | `Name`, `Chromosome`, `Position` | Single base/point, normally bp |
| `Alignment` | `Name`, `Chromosome`, `Start`, `End` | Feature or interval, normally bp |
| `QTL` | `Name`, `Chromosome`, `Trait`, `Start`, `End` | Interval in bp when parent is a genome, or cM when parent is a genetic map |
| `Haplotype` | `Name`, `Chromosome` | Add `Start` and `End` for an interval; no stricter public schema is defined by the cited sources |
| `Genome` | `Chromosome`, `Start`, `End` | One chromosome extent per row |
| `VCF` | `Chromosome`, `Start`, `End` | One chromosome extent per row; genotype data itself is managed separately |

Canonical header aliases understood by the parser are `Marker` -> `name`, `Name` -> `name`, `Position`/`Start` -> `pos`, `End` -> `end`, `Qs` -> `pos`, `Qe` -> `end`, and `Flanking Markers`/`Flanking_Markers` -> `flankingMarkers`. Generate canonical public headers, not the internal names.

Data rules:

- `Chromosome` must exactly match the block/chromosome name in `parentName`; e.g. `Chr7A` and `7A` are different.
- Format `Position`, `Start`, and `End` as Excel `General` numbers without commas/thousands separators (`678380602`, not `678,380,602`). Point features may use equal Start and End values.
- For ordinary feature sheets the parser requires non-empty `Name`/`Marker` and `Chromosome`; for `Genome` and `VCF`, only `Chromosome` is parser-required. Rows failing these checks are skipped with warnings.
- The parser tolerates QTL/Haplotype rows without Start/End (notably when `Flanking Markers` is supplied), but canonical uploads should provide the type-required coordinates above.
- Optional QTL columns include `Ontology` (Crop Ontology identifier such as `CO_321:0000902`), `Flanking Markers`, `Reference`, and `Comments`.
- `Flanking Markers` may contain marker names separated by commas or whitespace; it is stored as an array of strings.
- An optional `parentName` data column overrides/supplements metadata per row. Rows are split into child datasets named `<DatasetName> - <parentName>`. Prefer a single metadata `parentName` unless deliberate row-level splitting is required.
- Numeric marker names are converted to strings. Additional numeric cells remain numeric. A cell containing a valid JSON array string (double-quoted JSON, e.g. `["Published","External"]`) is parsed as an array.
- Date-like columns (header contains `date`) with Excel serial-date values are converted to dates.

## Chromosome control worksheets

### `Chromosomes to Omit`

Optional. Put one chromosome name per row in column A, with no header. Names are exact matches after trimming/sanitisation; prefixes and wildcards are not supported. Omission is conceptually applied before renaming.

### `Chromosome Renaming`

Optional. Put one mapping per row, with no header: source name in column A and replacement name in column B. Matching is exact after trimming/sanitisation.

## Specialised worksheets

### `Alias|<Name>`

Defines aliases rather than a dataset. First-row headers are `string1`, `string2`, and optionally `namespace1`, `namespace2`. Metadata may provide `namespace1`/`namespace2`, or `namespace` as a default. Alias strings and namespaces are coerced to strings.

### `AddMetadata|<Name>`

Adds metadata to existing datasets. Each data row is a metadata record; its first row supplies field names. `Display name` is normalised to `displayName`. This is an administrative/specialised upload form, not a substitute for the transposed `Metadata` worksheet accompanying normal datasets.

## Source precedence and known source corrections

This specification combines `resources/data_templates/datasets.xltx`, `lb4app/lb3app/common/utilities/spreadsheet-read.js`, and the 2026 ABTS workshop-manual appendix. Resolved corrections:

- `Chromosomes to Omit` uses exact names, not prefixes (the prefix statement describes an older parser).
- `Metadata` is required by project policy although absence is tolerated by software.
- Avoid sheet-name whitespace; do not rely on parser trimming.
- Only recognised types above are part of the format; regex acceptance of another prefix does not define a type.
- The template Genome example containing `VCF view Genotype` is erroneous; use optional `BlastDb` only when applicable.
- Template VCF comments referring to a Genome dataset are erroneous.
