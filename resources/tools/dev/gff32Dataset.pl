#!/usr/bin/perl
#!/bin/sh
#exec perl -w -x $0
#!perl

#-------------------------------------------------------------------------------
# -*- tab-width 2; perl-indent-level : 2; perl-continued-statement-offset : 2; perl-continued-brace-offset : -2; -*- (emacs)
# vim: set tabstop=2 shiftwidth=2 noexpandtab: 
#-------------------------------------------------------------------------------

use strict;
use warnings;

use Getopt::Std;	# for getopt()


#-------------------------------------------------------------------------------

# Based on effects2Dataset.pl, which is different in that each table row provides data for 1 Feature,
# whereas 1 row of a .GFF3 file defines a sub-element of a Feature.

# Sample data :
#chr1B	IWGSC_March2017	gene	119772468	119774999	53	-	.	ID=TraesCS1B01G107700;primconf=HC
#chr1B	IWGSC_March2017	mRNA	119772468	119774999	53	-	.	ID=TraesCS1B01G107700.1;Parent=TraesCS1B01G107700;primconf=HC;secconf=HC1
#chr1B	IWGSC_March2017	exon	119772468	119773200	.	-	.	Parent=TraesCS1B01G107700.1
#chr1B	IWGSC_March2017	three_prime_UTR	119772468	119772670	.	-	.	Parent=TraesCS1B01G107700.1
#chr1B	IWGSC_March2017	CDS	119772671	119773200	.	-	2	Parent=TraesCS1B01G107700.1
# ...
#chr1B	IWGSC_March2017	five_prime_UTR	119774963	119774999	.	-	.	Parent=TraesCS1B01G107700.1

# Refn ftp://ftp.ncbi.nlm.nih.gov/genomes/README_GFF3.txt



# Define enum-like constants for the indexes of the input columns.
#   based on: https://stackoverflow.com/a/25512227, kbro
# Prefix some of the enum names with fc_ (feature-column) to avoid namespace clash with e.g. perl chr().
use constant FeatureInputColumnsEnum => qw(seqid source type start end score strand phase attributes);
BEGIN
{
    eval "use constant (FeatureInputColumnsEnum)[$_] => $_;" foreach 0..(FeatureInputColumnsEnum)-1;
}

sub convertInput();

#-------------------------------------------------------------------------------

# from dev db
# my $datasetName = "Triticum_aestivum_IWGSC_RefSeq_v1.0_HC_genes";
my $datasetParent = "Triticum_aestivum_IWGSC_RefSeq_v1.0";
my $datasetNamespace =
 "Triticum_aestivum_IWGSC_RefSeq_v1.0:Triticum_aestivum_IWGSC_RefSeq_v1.0_HC_annotation";
# old values, from : 5206907 Mar  7  2018 IWGSC_RefSeq_pretzel.tar.gz : IWGSC_RefSeq_pretzel/IWGSC_RefSeq_v1.0_HC_genes.json
# my $datasetParent = "IWGSC_RefSeq_v1.0"
# my $datasetNamespace = "IWGSC_RefSeq_v1.0:IWGSC_RefSeq_v1.0_annotation"
#    "name": "IWGSC_RefSeq_v1.0_HC_genes",
#    "parent": "IWGSC_RefSeq_v1.0",
#    "namespace": "IWGSC_RefSeq_v1.0:IWGSC_RefSeq_v1.0_annotation",


# Used to form the JSON structure of datasets and blocks.
# Text extracted from IWGSC_RefSeq_pretzel.tar.gz : IWGSC_RefSeq_v1.0_HC_genes.json
# These are indented with 4 spaces, whereas the remainder of the file is indented with 2-column tabs.
my $datasetHeader = <<EOF;
{
    "name": "myMap",
    "parent": "$datasetParent",
    "namespace": "$datasetNamespace",
    "tags": [
        "geneElements"
    ],
    "meta" : { "shortName" : "IWGSC_genes_HC"  },
    "blocks": [
EOF

my $blockHeader = <<EOF;
        {
            "name": "1A",
            "scope": "1A",
            "features": [

EOF

my $blockFooter = <<EOF;
            ]
        }
EOF

my $datasetFooter = <<EOF;

    ]
}
EOF

my $featureFooter = <<EOF;
]
                    ]
                }
EOF


#-------------------------------------------------------------------------------
# main


## Get options from ARGV
my %options;
getopts("vhd:", \%options);

## Version and help options display
use constant versionMsg => "2020 Mar 26 (Don Isdale).\n";
use constant usageMsg => <<EOF;
	Usage e.g. : $0 -d Triticum_aestivum_IWGSC_RefSeq_v1.0_HC_genes < iwgsc_refseqv1.0_HighConf_2017Mar13.gff3 > iwgsc_refseqv1.0_HC_genes_elements.json
EOF

my $datasetName = $options{d};

if ($options{v}) {
	print versionMsg;
}
elsif ($options{h})
{
	print usageMsg;
}
elsif (!defined ($datasetName))
{
	print usageMsg, <<EOF;
	Required option : -d dataset name
EOF
}
else
{
	
	convertInput();
}

#-------------------------------------------------------------------------------

# Value of chr (chromosome) on the previous line, or undefined on the first line
my $lastChr;
my $lastId;
my $lastParent;
my $blockSeparator;
my $featureSeparator;

#-------------------------------------------------------------------------------

sub convertInput()
{
	$datasetHeader =~ s/myMap/$datasetName/;
	print $datasetHeader;
	while (<>)
	{
		chomp;
		# GFF3 has no headers to skip.
		{ subEltLine($_); }
	}
  optionalFeatureFooter();
	optionalBlockFooter();
	print $datasetFooter;
}

sub optionalBlockFooter()
{
	if (defined($lastChr))
	{ print $blockFooter; }
}

sub optionalFeatureFooter()
{
	if (defined($lastId))
	{ print $featureFooter; }
}

# read 1 line, which defines a gene sub-element
sub subEltLine($)
{
  my ($line) = @_;

  my @a =  split( '\t', $line);
  my $c = $a[seqid];
  my $attributes = $a[attributes];
  # trim off any trailing .1, .2 ..., enabling mRNA and gene names to
  # match - the mRNA are presented as sub-elements within the Feature
  # corresponding to the gene.
  (my $id) = $attributes =~ m/ID=([A-Za-z0-9]+)/;
  (my $parent) = $attributes =~ m/Parent=([A-Za-z0-9]+)/;

  if ((defined($id) && (! defined($lastId) || ($lastId ne $id)))
      || (defined($parent) && ((defined($lastParent) && ($lastParent ne $parent)))))
  {
    optionalFeatureFooter();
    # print defined($id) ? $id : '', defined($parent) ? $parent : '';
    $lastId = $id;
    $lastParent = $parent;

    if (! defined($lastChr) || ($lastChr ne $c))
    {
	    # Using a state machine would be more readable.
	    optionalBlockFooter();

	    # print $c;
	    $lastChr = $c;

	    if (defined($blockSeparator))
	    { print $blockSeparator; }
	    else
	    { $blockSeparator = ",\n"; }
      undef $featureSeparator;

	    my $h = $blockHeader;
	    $h =~ s/1A/$c/g;
	    print $h;
    }
    else  # print feature separator
    {
      $featureSeparator = ",\n";
      print $featureSeparator;
    }

    if ($a[type] ne 'gene') {
	    print 'Expected ', $a[type], ' to be gene', $_;
    }
    if (! defined($id)) 
    { $id = $parent; }
    printFeatureHeader($id, $c, $a[start], $a[end]);
  }
  else # print sub-element separator
  { print ",\n"; }

  printSubElement(@a);
}

sub printFeatureHeader($$$$)
{
  my ($id, $chr, $start, $end) = @_;

  print <<EOF;
               {
                    "name": "$id",
                    "value": [
                        $start,
                        $end,
                        [
EOF
}




#-------------------------------------------------------------------------------


sub printSubElement($)
{
  my (@a) = @_;
  print '[', $a[start], ',', $a[end], ', "', $a[type], '"]';
}



#-------------------------------------------------------------------------------
