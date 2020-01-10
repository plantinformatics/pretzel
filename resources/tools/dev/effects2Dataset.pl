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

# Define enum-like constants for the indexes of the input columns.
#   based on: https://stackoverflow.com/a/25512227, kbro
# Prefix some of the enum names with ec_ (effects-column) to avoid namespace clash with e.g. perl chr().
use constant EffectsColumnsEnum => qw(ec_label	ec_chr	ec_pos	Freq	PIP1	PIP2	PIP3	PIP4	Beta);
BEGIN
{
    eval "use constant (EffectsColumnsEnum)[$_] => $_;" foreach 0..(EffectsColumnsEnum)-1;
}

sub convertInput();

#-------------------------------------------------------------------------------

# Used to form the JSON structure of datasets and blocks.
# Text extracted from pretzel-data/myMap.json
# These are indented with 4 spaces, whereas the remainder of the file is indented with 2-column tabs.
my $datasetHeader = <<EOF;
{
    "name": "myMap",
    "type": "linear",
    "tags": [
        "EffectsPlus", "chartable"
    ],
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
getopts("vhd:", \%options);

## Version and help options display
use constant versionMsg => "2019 May 15 (Don Isdale).\n";
use constant usageMsg => <<EOF;
	Usage e.g. : $0 -d BasicDensity_EGLOB < BasicDensity_EGLOB_EffectsPlus.txt > BasicDensity_EGLOB_EffectsPlus.json
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
my $blockSeparator;

#-------------------------------------------------------------------------------

sub convertInput()
{
	$datasetHeader =~ s/myMap/$datasetName/;
	print $datasetHeader;
	while (<>)
	{
		chomp;
		# commenting out this condition will output the column headers in the JSON,
		# which is a useful check of column alignment with the EffectsColumnsEnum.
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

# read 1 line, which defines a SNP and associated effects data
sub snpLine($)
{
	my ($line) = @_;
	# input line e.g.
	#label	chr	pos	Freq	PIP1	PIP2	PIP3	PIP4	Beta
	#ChrA_83	A	83	0.700912	0.992322	0.00757804	0.000100371	0	6.67212e-06

	my @a =  split( '\t', $line);
	my $c = $a[ec_chr];
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
	my $label = shift @a;
	my $chr = shift @a;
	my $pos = shift @a;
	my $aCsv = join(', ', @a);
	print <<EOF;
               {
                    "name": "$label",
                    "value": [
                        $pos,
                        null,
                        [$aCsv]
                    ]
                }
EOF
}

#-------------------------------------------------------------------------------
