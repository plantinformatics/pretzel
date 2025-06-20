# From the input, $2 is the collated haplotype value for the selected SNPs.
# Each input line corresponds to a sample; i.e. line 1 corresponds to column 1 of the
# samples in the VCF file.
# $1 is the column / line number; it is equal to NR (row number), which is used instead.
# Count the number of times each haplotype value occurs, i.e. count the number
# of samples which have each haplotype.
{
  count[$2]++;
  samples[$2] = "" samples[$2] "," NR
}

# Output each unique haplotype value, with the number of samples which have that
# haplotype value, and the list of samples.
# Samples are represented by a number which is their column number in the VCF
# file, with 1 corresponding to the first sample column.
END {
  for (haplotype in samples)
    print haplotype, count[haplotype], samples[haplotype]
}
