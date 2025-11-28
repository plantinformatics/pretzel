# Genotype Table Sample Sorting

This document describes the data structures, events, and helper functions that
drive the “sort samples by similarity to a genotype pattern” feature.

## High-level flow

1. **User interaction**
   - The user clicks a Ref/Alt cell in the genotype matrix (`matrix-view.js`).
   - The action chain `afterOnCellMouseDown → handleCellClick → featureToggleRC`
     delegates to `featureToggle()` in `frontend/app/components/panel/manage-genotype.js`.
   - Alternatively, the user can select an LD block or variant interval, which
     invokes `haplotypeFiltersApply()`/`variantIntervalToggle()` before reaching the
     same filtering infrastructure.

2. **Filter state update**
   - `featureToggle()` mutates the per-block `sampleFiltersSymbol.feature` array.
     Each entry stores the Feature record and the desired allele flag
     (`feature[matchRefSymbol]`).
   - The block caches how many SNPs are currently selected via
     `block.set('selectedSNPCount.feature', filters.length)`.

3. **Trigger recomputation**
   - `ensureSamplesThenRender('feature')` requests samples if needed and calls
     `filterSamples()` once all prerequisites are met.

4. **Measure aggregation**
   - `filterSamples()` iterates over each block in `brushedOrViewedVCFBlocks`.
   - For the active filter type (`feature`, `variantInterval`, or `haplotype`)
     the helper `featuresCountMatches()` walks all Feature objects and compares
     every sample genotype value against the selected reference pattern:
       * `MatchRef` compares against Ref/Alt values stored on the feature.
       * `MatchRefSample` (from `frontend/app/utils/data/genotype-order.js`)
         compares against the genotypes of reference samples chosen by the user.
   - The resulting `Measure` (currently `Counts`) is accumulated into either
     `block[sampleMatchesSymbol][sampleName]` or
     `block[referenceSampleMatchesSymbol][referenceSampleName][sampleName]`.

5. **Ordering**
   - Once all blocks have contributed, `distancesTo1d()` merges their match maps.
     It falls back to a t‑SNE embedding when multiple reference samples create a
     multidimensional signal.  The output is stored in `this.matchesSummary`.
   - `matrix-view` uses these values to sort sample columns.  When the optional
     `showHideSampleFn` callback is supplied, columns with zero matches can be
     hidden immediately.

## Key data structures

| Symbol / Property | Location | Purpose |
|-------------------|----------|---------|
| `sampleFiltersSymbol` | Block | Holds `{ feature, haplotype, variantInterval }` arrays containing the user’s selections. |
| `matchRefSymbol` | Feature | Boolean flag that records which allele (Ref/Alt) should be used when comparing genotypes. |
| `referenceSamplesSymbol` | Block | Array of sample names that serve as match targets. |
| `sampleMatchesSymbol` | Block | Map `sampleName → Measure` used when no explicit reference samples are selected. |
| `referenceSampleMatchesSymbol` | Block | Nested map `referenceSampleName → sampleName → Measure` populated whenever reference samples are present. |
| `Measure` (`Counts`) | `frontend/app/utils/data/genotype-order.js` | Aggregation contract (`add`, `order`, `average`) used by both filtering and ordering code. |
| `blockFiltered` caches | `manage-genotype.js` | Cache filtered sample lists keyed by `selectedSNPsToKeyWithSortAndMap()` so identical selections reuse prior results. |

## Cache keys and selection serialization

`selectedSNPsToKeyWithSortAndMap()` produces the canonical representation of the
current SNP selection:

```
[ { position, matchRef }, ... ]  --sorted by genomic position-->
"matchHet:<flag> chrPos:Ref|Alt ..."
```

This string is used consistently when:

- Writing to the dataset/block sample cache inside `vcfGenotypeSamplesDataset()`.
- Reading cached results via `blockFilteredSamplesGet()` and
  `datasetFilteredSamplesGet()`.

Because every path goes through the same sort+map step, the cache remains stable
regardless of the order in which the user clicks individual SNPs.

## Interaction with genotype-order utilities

The module `frontend/app/utils/data/genotype-order.js` is intentionally detached
from Ember and exposes pure helpers:

- **Measure implementations** — encapsulate how distances/mismatches are counted.
- **`MatchRefSample`** — wraps a reference sample name and exposes the same
  `distanceFn()` interface used by `MatchRef`.
- **`distancesTo1d()`** — consolidates per-block measures and decides when to
  call `tsneOrder()` to obtain comparable numeric sort keys.
- **`tsneOrder()`** — uses `tsne-js` to embed the per-sample vectors into one
  dimension while preserving the relative proximity formed by the selected SNPs.

These helpers are consumed by `filterSamples()` to keep genotype math separate
from UI orchestration.
