#!/usr/bin/perl

use strict;

# synteny blocks - just the bracket / limit genes

#-------------------------------------------------------------------------------

#1A_1B	0	849	A	chr1A	B	chr1B	plus	0	TraesCS1A01G238700	TraesCS1B01G250600	425260104	442623101	scaffold122140|98	+	scaffold42443|177	+

#7B_7D	1255	4	B	chr7B	D	chr7D	minus	3	TraesCS7B01G199100	TraesCS7D01G286900	357638920	310973423	scaffold7498|102	+	scaffold96938|102	+

#-------------------------------------------------------------------------------

my @cols =
(
 "adj", "sbID", "nGenes", "ch0", "chr0", "ch1", "chr1", "sign", "idGeneInSb", "gene0", "gene1", "loc0", "loc1", "scaffold0", "plus0", "scaffold1", "plus1"
);
my %c = {};
for (my $i=0; $i < $#cols; $i++) { $c{$cols[$i]} = $i; }

# $first is set when start of new sb
# $prev is set for each line
# $first <-+
#          |
# $prev <--+-- $curr
my @first;
my @prev;
my @curr;

sub output($$)
{
    my ($p, $l) = @_;
    my $chrs = $$l[$c{"adj"}]; $chrs =~ s/([1-7][ABD])_([1-7][ABD])/CS\1\tCS\2/;
    print $chrs, "\t",	
	$$p[$c{"gene0"}] . "_1", "\t", $$l[$c{"gene0"}] . "_1", "\t", 
	$$p[$c{"gene1"}] . "_1", "\t", $$l[$c{"gene1"}] . "_1", "\t", 
	$$l[$c{"nGenes"}], ",", 
	$$l[$c{"sign"}], ",", 
	$$l[$c{"scaffold0"}], ",", 
	$$l[$c{"scaffold1"}], "\n";
}

while (<>)
{
    @curr = split(/\t/);
    # my ($adj, $sbID, $nGenes, $ch0, $chr0, $ch1, $chr1, $sign, $idGeneInSb, $gene0, $gene1, $loc0, $loc1, $scaffold0, $plus0, $scaffold1, $plus1) = @curr;
    if ($#prev == -1)
    {
	@first = @curr;
    }
    elsif ($prev[$c{"sbID"}] ne $curr[$c{"sbID"}])
    {
	# output previous, save new bracket_start 
	output(\@first, \@prev);
	@first = @curr;
    };
    @prev = @curr;

}
if ($#prev != -1)
{
    output(\@first, \@prev);
}
