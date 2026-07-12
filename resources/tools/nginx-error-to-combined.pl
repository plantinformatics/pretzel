#!/usr/bin/env perl
use strict;
use warnings;
use POSIX qw(strftime);

my @mon = qw(Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec);

sub esc {
    my ($s) = @_;
    $s = "-" if !defined($s) || $s eq "";
    $s =~ s/\\/\\\\/g;
    $s =~ s/"/\\"/g;
    return $s;
}

while (<>) {
  chomp;

  next unless m{^(\d{4})/(\d{2})/(\d{2}) (\d{2}:\d{2}:\d{2}) \[(\w+)\] \d+#\d+: \*\d+ (.*)$};

  my ($y,$mo,$d,$time,$level,$rest) = ($1,$2,$3,$4,$5,$6);

  my ($client)   = $rest =~ /client:\s*([^,\s]+)/;
  my ($server)   = $rest =~ /server:\s*([^,]+)/;
  my ($request)  = $rest =~ /request:\s*"([^"]*)"/;
  my ($referrer) = $rest =~ /referrer:\s*"([^"]*)"/;

  next unless $client && $request;   # GoAccess needs these to be useful

  my ($msg) = $rest =~ /^(.*?)(?:,\s+client:|,\s+server:|,\s+host:|$)/;
  $msg //= $rest;

  my $status = 500;
  $status = 504 if $msg =~ /upstream timed out/i;
  $status = 502 if $msg =~ /connect\(\) failed|upstream prematurely closed/i;
  $status = 404 if $msg =~ /open\(\).*failed.*No such file/i;
  $status = 403 if $msg =~ /access forbidden|permission denied/i;

  my $date = sprintf "%02d/%s/%04d:%s +0000", $d, $mon[$mo-1], $y, $time;

  # COMBINED:
  # host ident authuser [date] "request" status bytes "referrer" "user-agent"
  # Put nginx error level/message/server into user-agent field for inspection.

  my $ua = "nginx-error level=$level server=$server msg=$msg";

  print esc($client)
      . qq{ - - [$date] "}
      . esc($request)
      . qq{" $status 0 "}
      . esc($referrer)
      . qq{" "}
      . esc($ua)
      . qq{"\n};

}
