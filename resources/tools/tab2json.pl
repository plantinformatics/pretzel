#!/usr/bin/perl

my $outputChr;
my $comma;

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


while (<>)
{
    if (m/^#/)	# ignore comment lines
    {
	# line 1 comment is headers
    }
    else
    {
	chomp;  # avoid \n on last field
	# flcDNA matching marker,
	my @cols = split(/\t/);
	my $chr = $cols[0], $cm = $cols[2], $matching = $cols[6];
	if ($chr ne $curChr)
	{
	    if (defined($outputChr))
	    { jsonEnd(); }
	    $curChr = $chr;
	    jsonStart($chr);
	}
	if ($matching ne "-")
	{
	    jsonMarker($matching, $cm);
	}
    }

}

if (defined($outputChr))
{ jsonEnd(); }
