# Map from the genotype value output by bcftools --format %GT
# to the dosage (number of alternate alleles), i.e. 0,1,2.
#
# | %GT | Dosage |
# |:--|:--|
# | 0/0 | 0 |
# | 0/1 | 1 |
# | 1/0 | 1 |
# | 1/1 | 2 |
# The %GT value may be phased or unphased, i.e. the separator may be | or /.
# Unknown values, e.g. ./. are mapped to '.'.
function gt_to_dosage(gt) {
  if (gt == "." || gt == "./." || gt == ".|.") return "."
  split(gt, a, /[\/|]/)
  return a[1] + a[2]
}

# Input is the output from bcftools query -f '%CHROM\t%POS[\t%GT]\n'
# i.e. chromosome \t position \t sample1_gt \t sample2_gt ...
# where sample1_gt is the genotype value of sample1 in %GT format, e.g. 0/1.
# Each input line corresponds to a selected SNP.
# Skip the chromosome and position columns, which are not used (useful to check
# output in development); process each of the sample columns, i.e. 3 ... NF.
# Convert the genotype value from %GT format to dosage [012] (copies of Alt).
# For each sample, collate (concatenate) the genotype value at all of the SNPs.
{
  for (i = 3; i <= NF; i++) {
    g = gt_to_dosage($i)
    haplotype[i - 2] = (NR == 1 ? g : haplotype[i - 2]  g)
  }
}

# For each of the sample columns, output the column number (starting at 1 for
# the first sample column which is column 3 of the input, i.e. this number is -2
# relative to the column number), and the haplotype value of the sample at the
# selected SNPs.
END {
  for (i = 1; i <= length(haplotype); i++) {
    print i, haplotype[i]
  }
}
