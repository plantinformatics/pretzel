#!/usr/bin/perl
#!/bin/sh
#exec perl -w -x $0
#!perl

#-------------------------------------------------------------------------------
# Convert Exome SNPs to JSON Pretzel format for upload.
# input format, e.g :
# chr1A	22298	scaffold38755_22298	T/C
# chr1A	22304	scaffold38755_22304	A/G
#
# initial version based on effects2Dataset.pl (a6e96c6)

#-------------------------------------------------------------------------------
# -*- tab-width 2; perl-indent-level : 2; perl-continued-statement-offset : 2; perl-continued-brace-offset : -2; -*- (emacs)
# vim: set tabstop=2 shiftwidth=2 noexpandtab: 
#-------------------------------------------------------------------------------

use strict;
use warnings;

use Getopt::Std;	# for getopt()


#-------------------------------------------------------------------------------

# Define enum-like constants for the indexes of the input columns.
# Not fully used, c_char is used in snpLine(), but printFeature() unpacks the input fields directly using shift @a.
#   based on: https://stackoverflow.com/a/25512227, kbro
# Prefix some of the enum names with c_ (column) to avoid namespace clash with e.g. perl chr().
# data example : chr1A	22298	scaffold38755_22298	T/C
use constant ColumnsEnum => qw(c_chr c_pos c_scaffold_pos c_ref_alt);
BEGIN
{
    eval "use constant (ColumnsEnum)[$_] => $_;" foreach 0..(ColumnsEnum)-1;
}

sub convertInput();

#-------------------------------------------------------------------------------

my $shortName = "WGS";	# option, default : Exome
my $extraTags = ", \"HighDensity\"";	# option, default ''


# Used to form the JSON structure of datasets and blocks.
# Text extracted from pretzel-data/myMap.json
# These are indented with 4 spaces, whereas the remainder of the file is indented with 2-column tabs.
my $datasetHeader = <<EOF;
{
    "name": "myMap",
    "type": "linear",
    "tags": [
        "SNP"$extraTags
    ],
    "parent" : "Triticum_aestivum_IWGSC_RefSeq_v1.0",
    "namespace" : "Triticum_aestivum_IWGSC_RefSeq_v1.0:Triticum_aestivum_IWGSC_RefSeq_v1.0_Exome_SNPs",
    "meta" : { "type" : "Genome", "shortName" : "$shortName" },
    "blocks": [
EOF



# omitted :
#            "namespace": "90k",
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


#-------------------------------------------------------------------------------
# main


## Get options from ARGV
my %options;
getopts("vhd:p:", \%options);

## Version and help options display
use constant versionMsg => "2020 Dec 07 (Don Isdale).\n";
use constant usageMsg => <<EOF;
	Usage e.g. : $0 -d Exome_SNPs_1A -p Triticum_aestivum_IWGSC_RefSeq_v1.0 < IWGSC_RefSeq_v1.0.EXOME_SNPs.chr1A.tsv > Exome_SNPs_1A.json
EOF

my $datasetName = $options{d};
my $parentName = $options{p};

my $refAltSlash = 0;	# option, default 0

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
elsif (!defined ($parentName))
{
    print usageMsg, <<EOF;
    Required option : -p parent (reference dataset) name
EOF
}
else
{
	
    convertInput();
}

#-------------------------------------------------------------------------------

# Value of chr (chromosome) on the previous line, or undefined on the first line
my $lastChr;
my $blockSeparator;

#-------------------------------------------------------------------------------

sub convertInput()
{
    $datasetHeader =~ s/myMap/$datasetName/;
    $datasetHeader =~ s/Triticum_aestivum_IWGSC_RefSeq_v1.0/$parentName/g;
    $datasetHeader =~ s/_Exome_SNPs/_$datasetName/;
	

    print $datasetHeader;
    while (<>)
    {
        chomp;
        # commenting out this condition will output the column headers in the JSON,
        # which is a useful check of column alignment with the ColumnsEnum.
        if (! m/^label	chr	pos/)
        { snpLine($_); }
    }
    optionalBlockFooter();
    print $datasetFooter;
}

sub optionalBlockFooter()
{
    if (defined($lastChr))
    { print $blockFooter; }
}

# read 1 line, which defines a SNP and associated reference/alternate data
sub snpLine($)
{
    my ($line) = @_;
    # input line e.g.
    #c_chr c_pos c_scaffold_pos c_ref_alt
    #chr1A	22298	scaffold38755_22298	T/C

    my @a =  split( '\t', $line);
    # tsv datasets often follow the naming convention 'chr1A';  Pretzel data omits 'chr' for block scope & name : '1A'.
    $a[c_chr] =~ s/^chr//;
    my $c = $a[c_chr];
    if (! defined($lastChr) || ($lastChr ne $c))
    {
        optionalBlockFooter();

        # print $c;
        $lastChr = $c;

        if (defined($blockSeparator))
        { print $blockSeparator; }
        else
        { $blockSeparator = ",\n"; }

        my $h = $blockHeader;
        # replace '1A' in the $blockHeader template with the actual chromosome name $c.
        $h =~ s/1A/$c/g;
        print $h;
    }
    else # print feature separator
    { print ","; }
    printFeature(@a);
}

# For printing array as comma-separated list.
# Could make this local if it clashed with any other print.
# As an alternative to using join to construct $aCsv in printFeature(), can do :
# $,=",";
# then print @a; but it doesn't work within <<EOF.
# $"=",";	# applies to print "@a"

sub printFeature($)
{
    my (@a) = @_;

    my $chr = shift @a;
    my $pos = shift @a;
    my $label = shift @a;	# c_scaffold_pos
    my $values = "";
    my $ref_alt;
    if ($refAltSlash)
    { $ref_alt = "\"ref\" : \"" . (shift @a) . "\""; }
    else
    { $ref_alt = "\"ref\" : \"$a[0]\"" . ", " . "\"alt\": \"$a[1]\""; };
    my $indent = "                    ";
    if ($ref_alt) { $values .=  ",\n" . $indent . "\"values\" : {" . $ref_alt . "}\n"; }
    print <<EOF;
               {
                    "name": "$label",
                    "value": [
                        $pos,
                        $pos
                    ]$values
                }
EOF
}

#-------------------------------------------------------------------------------
