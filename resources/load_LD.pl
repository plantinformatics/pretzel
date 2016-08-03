#!/usr/bin/perl
# Created by Sean Li @ 30/06/2016
# Updated by

use strict;
use warnings;
use DBI;

#Provide a folder where contains all the sample files.
my $ld_file = $ARGV[0] || die "Please provide the file that stores the sample LD information, e.g. chr1_r2v_f.txt \n";

#Start from Database connection.
#my $host = 'bio-01-cdc.it.csiro.au';
my $host = 'mysql-test3.it.csiro.au';
my $database = 'test';
my $user = 'dav127_admin';
my $pwd = 'D@V127_@dm1n';

my $dbh = DBI->connect("DBI:mysql:database=$database;host=$host",$user,$pwd,{'RaiseError' => 1});


# The marklocation id will be added later 
my $query = "INSERT INTO ld (marker, markerB, r2, r2v, MAF1, MAF2) VALUES (?,?,?,?,?,?)";
my $statement = $dbh->prepare($query);
open(FHD, $ld_file) || die "Can't open the file $ld_file. Please have a check. \n";
my @lines = <FHD>; 
close(FHD);
  
my @ids = ();
foreach my $line (@lines){
  chomp $line;
  my @attributes = split(/\s+/,$line);
  #loc1 	 loc2 	 r2 	 r2v 	 MAF.loc1 	 MAF.loc2
  #BobWhite_c10251_382_1 	 BobWhite_c1027_1127_1 	 0.0790454280849104 	 0.0349694102435433 	 0.365384615384615 	 0.313609467455621
  unless($attributes[0] eq 'loc1'){
     #Fetch Marker ID given the marker name
     substr($attributes[0], -2) = '';
     my $s_sth = $dbh->prepare('SELECT id FROM marker WHERE commonName = ?');
     $s_sth->execute($attributes[0]);
     my @data = $s_sth->fetchrow_array();
     my $marker = $data[0];
     #markerB, loc2;
     substr($attributes[1], -2) = '';
     $s_sth = $dbh->prepare('SELECT id FROM marker WHERE commonName = ?');
     $s_sth->execute($attributes[1]);
     @data = $s_sth->fetchrow_array();
     my $markerB = $data[0];
     if($marker && $markerB){
        #print "markerA: $marker\tmarkerB: $markerB\n";
        $statement->execute($marker, $markerB, $attributes[2],$attributes[3],$attributes[4],$attributes[5]);
     } else {
       print $line."\n";
     }
  } else {
     @ids = split(/\s+/,$line);
  }
}
$statement->finish();
#Disconnect from the database;
$dbh->disconnect();

exit 0;
