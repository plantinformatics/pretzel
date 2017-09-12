#!/usr/bin/perl

use strict;

# Given a file with a list of gene names, select just those genes from $* or stdin.
#
# The input and output are valid mongodb export / import files, except that the
# input is folded (sed "s/},/},\n/g") e.g. by mongoXport.bash: docHead().
#
# Usage / Examples :
#
# 
#    fmt -1 < $SB.bracket.tsv | fgrep TraesCS7 > bracket_TraesCS7
# could also | fgrep -v LC_	low confidence genes are not in chr (they have location in $SB)
#
# This input filter joins the aliases onto the preceeding line, i.e. each marker
# is wholly on a single line, suited for filtering
#head -6 ~/tmp/x/data/CS7A.fold | tail -2 | perl -0pe  's/\n( "aliases")/\1/g'
# { "name" : "TraesCS7A01G000100_1", "position" : 241215, "_id" : { "$oid" : "58eae7d7dc9a7d5b1dc93d1b" }, "aliases" : [ "TraesCS1B01G043400_1", "TraesCS6B01G002300_1", "TraesCS1B01G004100_1", "TraesCS6D01G002300_1" ] }, 
#
# perl -0pe  's/\n( "aliases")/\1/g' | chrSelect.pl bracket_TraesCS7 > file && load_test_data_file file


sub usage()
{
    print "usage: chrSelect.pl <gene_names_file> [ input file/s ] > output\n";
    exit;
}


@ARGV || usage();


my $geneNamesFilename=$ARGV[0];
shift;

open(my $geneNamesFile, '<', $geneNamesFilename)
    or die("Unable to read input file '$geneNamesFilename': $!\n");

my %geneNames = {};
while (<$geneNamesFile>)
{
    chomp;
    $geneNames{$_} = 1;
}
close($geneNamesFile);

while (<>)
{
	if (my ($start, $gene, $remainder) = m/^( \{ "name" : ")([^"]*)(".*)/)
	{
	    if ($geneNames{$gene})
	    { print; }
	}
	else
	{ print; }
}
