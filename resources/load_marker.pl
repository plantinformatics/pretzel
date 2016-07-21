#!/usr/bin/perl

# Load Sample information from a number of files.
# Created by Sean Li @ 30/10/2015
# Updated by

use strict;
use warnings;
use DBI;

#Provide a folder where contains all the sample files.
my $snp_file = $ARGV[0] || die "Please provide the file that stores all the SNPs/Markers. \n";

my $database = $ARGV[1] || die "Please provide the database name \n";
#Start from Database connection.
my $host = 'bio-01-cdc.it.csiro.au';
#my $database = 'dav127_v01';
my $user = 'sqladmin';
my $pwd = '5QL@dmin';

my $dbh = DBI->connect("DBI:mysql:database=$database;host=$host",$user,$pwd,{'RaiseError' => 1});

open(FHD, $snp_file) || die "Can't open the file $snp_file . Please have a check. \n";
my @lines = <FHD>; 
close(FHD);
my $query = "INSERT INTO marker (idx, name, commonName, class) VALUES (?,?,?,?)";
my $statement = $dbh->prepare($query);
foreach my $line (@lines){
  chomp $line;
  my @attributes = split(/\s+/,$line);
  my $type = "snp";
  if($attributes[0] =~ /\d/){
    $statement->execute($attributes[0],$attributes[1],$attributes[2],$type);
  }
}

$statement->finish();
#Disconnect from the database;
$dbh->disconnect();

exit 0;
