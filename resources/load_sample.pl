#!/usr/bin/perl

# Load Sample information from a number of files.
# Created by Sean Li @ 30/10/2015
# Updated by

use strict;
use warnings;
use DBI;

#Provide a folder where contains all the sample files.
my $data_dir = $ARGV[0] || die "Please provide the directory that stores all the sample ***_Sentrix.txt files. \n";
opendir(my $dir_hd, $data_dir) || die "Can't open the directory $data_dir. Please have a check. \n";
my @files = grep {/Sentrix/} readdir($dir_hd);
closedir($dir_hd);

#Start from Database connection.
my $host = 'bio-01-cdc.it.csiro.au';
my $database = 'dav127_v01';
my $user = 'sqladmin';
my $pwd = '5QL@dmin';

my $dbh = DBI->connect("DBI:mysql:database=$database;host=$host",$user,$pwd,{'RaiseError' => 1});


my $query = "INSERT INTO sample (name, source, commonName) VALUES (?,?,?)";
my $statement = $dbh->prepare($query);
foreach my $file (@files){
  print "Processing $file ...\n";
  my @f_nas = split(/\_/,$file);
  my $source;
  if($f_nas[2] eq 'x') {
    $source = $f_nas[1]."_x_".$f_nas[3];
  } else {
    $source = $f_nas[1];
  }
  open(FHD, $data_dir."\/".$file) || die "Can't open the file $file. Please have a check. \n";
  my @lines = <FHD>; 
  close(FHD);
  foreach my $line (@lines){
    my @attributes = split(/\s+/,$line);
    if($attributes[0] =~ /\d/){
      $statement->execute($attributes[3],$source,$attributes[4]);
    }
  }
}
$statement->finish();
#Disconnect from the database;
$dbh->disconnect();

exit 0;
