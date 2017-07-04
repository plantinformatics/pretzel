#!/usr/bin/perl
#-------------------------------------------------------------------------------
# convert TSV data into json for import;
my $textDescription = << "END_textDescription";

 developed to load this data :
http://onlinelibrary.wiley.com/doi/10.1111/tpj.13436/full
DOI 4: https://doi.org/10.5447/IPK/2016/58 :
 2082883 Jun 30 14:57 Updated version (v2) of the Rye Genome Zipper.zip :
schmutzr@IPK-GATERSLEBEN.DE/Updated version (v2) of the Rye Genome Zipper/DATA:
 14391279 Aug  3  2016 RyeGenomeZipper_v2_chromosomes.tab

Optional file to map via contig to an alternate marker name which can be correlated with wheat genome (Sc*) :
from : DOI 2: https://doi.org/10.5447/IPK/2016/57
 7497587 Jun 30 14:56 Large data tables for gene prediction, gene annotation and the genetic map of rye (Lo7).zip
schmutzr@IPK-GATERSLEBEN.DE/Large data tables for gene prediction, gene annotation and the genetic map of rye (Lo7)/DATA/ :
 1059138 Jul  3 20:14 Assignment_RyeGeneModels_to_Lo7Contigs.tsv

See also : resources/functions.bash : function loadRepeats(), which uses this script and
filters to include only markers which connect between chromosomes in this data set.

END_textDescription

#-------------------------------------------------------------------------------

use strict;

sub usage()
{
    print "usage: tab2json.pl [-h|--help] [<join_filename>]\n";
    exit;
}

if (($ARGV[0] eq "-h") || ($ARGV[0] eq "--help"))
{
    shift(@ARGV);
    print $textDescription;
    exit 0;
}
# Expect 0 or 1 argument.
($#ARGV < 1) || usage();

#-------------------------------------------------------------------------------
#
# Optional input file :
# associates an alternate marker name with each contig name
# if given, output marker name is from this file, mapped via contig name.
#
# example of file :
# (first row is header)
#RyeGeneModels	Lo7_v2_contig
#Sc3Loc01342590.2	Lo7_v2_contig_262710
# Join file name;
my $filename = shift(@ARGV);
# hash to hold association from contig name to alternate marker name.
my %contigMarker;
# True if optional filename is given; otherwise, $matching is output for marker name.
my $joinContig = defined($filename);

if (defined($filename) && ! -f $filename)
{
    usage();
    die "$filename does not exist.";
}
else
{
    open NAME_JOIN, "<$filename" || die "open '$filename' failed : $!\n";
    while (<NAME_JOIN>)
    {
	if (my ($marker, $contig) = m/(.+)\t(.+)/)
	{
	    # Many marker naming systems include '.', e.g. "Sc1Loc00281810.2",
	    # which causes a problem for versions of draw-map.js earlier than commit [feature-aliases 5334ac5].
	    # Replace '.' with _;  this edit can be removed once the above commit is merged to this branch.
	    $marker =~ s/\./_/g;
	    $contigMarker{$contig} = $marker;
	}
    }
    close NAME_JOIN;
}

#-------------------------------------------------------------------------------

# File for output data of a chromosome.
my $outputChr;
# separator between successive markers of a chromosome.
my $comma;
# name of current chromosome being processed.
my $curChr;

sub fileStart($)
{
    my ($chr) = @_;
    open($outputChr, ">$chr")
	or die "Can't create file '$chr' for output: $!";
}
sub fileStop()
{
    if (defined($outputChr))
    { close $outputChr; undef $outputChr; }
}

sub jsonStart($)
{
    my ($chr) = @_;
    fileStart($chr);
    $comma = "";

    my $text = << "END_STRING";
{ "geneticmap":
  {
    "name": "BaueRye",
    "chromosomes":
    [
      {
      "name": "$chr",
      "markers":
        [
END_STRING
    print $outputChr $text;
}
sub jsonMarker($$)
{
    my ($marker, $position) = @_;
    my $text = << "END_STRING3";
         $comma {
          "name": "$marker",
          "position": $position
          }
END_STRING3
    print $outputChr $text;
    $comma = ",";
}

sub jsonMarkerAlias($$$)
{
    my ($marker, $position, $aliases) = @_;

    my $text = << "END_STRING4";
$comma
          {
          "name": "$marker",
          "position": $position,
          "aliases": [$aliases]
          }
END_STRING4

    print $outputChr $text;
    $comma = ",";

}
sub jsonEnd()
{
    my $text = << "END_STRING2";
        ]
      }
    ]
  }
}
END_STRING2

    print $outputChr $text;
    fileStop();
}

#-------------------------------------------------------------------------------

while (<>)
{
    if (m/^#/)	# ignore comment lines
    {
	# line 1 comment is headers
    }
    else
    {
	chomp;  # avoid \n on last field
	# column number : heading
	# 0 : chr
	# 2 : cm  (location in centiMorgans)
	# 6 : flcDNA matching marker
	# 10 : contigs matching marker
	my @cols = split(/\t/);
	my $chr = $cols[0];
	my $cm = $cols[2];
	my $matching = $cols[6];
	my $contig = $cols[10];

	if ($chr ne $curChr)
	{
	    if (defined($outputChr))
	    { jsonEnd(); }
	    $curChr = $chr;
	    jsonStart($chr);
	}

	if ($joinContig)
	{
	    my $markerC;
	    if (($contig ne "-") && defined($markerC = $contigMarker{$contig}))
	    {
		jsonMarker($markerC, $cm);
	    }
	}
	else
	{
	    if ($matching ne "-")
	    {
		jsonMarker($matching, $cm);
	    }
	}
    }
}

if (defined($outputChr))
{ jsonEnd(); }

#-------------------------------------------------------------------------------
