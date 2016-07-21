#!/usr/bin/perl
# Created by Sean Li @ 30/10/2015
# Updated by

use strict;
use warnings;
use DBI;

#Provide a folder where contains all the sample files.
my $data_dir = $ARGV[0] || die "Please provide the directory that stores all the sample LD .txt files, e.g. Ta-Chr1A_r2v_Filtered.txt \n";
opendir(my $dir_hd, $data_dir) || die "Can't open the directory $data_dir. Please have a check. \n";
my @files = grep {/Filtered/} readdir($dir_hd);
closedir($dir_hd);

#Start from Database connection.
#my $host = 'bio-01-cdc.it.csiro.au';
my $host = 'mysql-test3.it.csiro.au';
my $database = 'dav127_test';
my $user = 'dav127_user';
my $pwd = 'xl8qbYZS=qexcpquGpl\$';

my $dbh = DBI->connect("DBI:mysql:database=$database;host=$host",$user,$pwd,{'RaiseError' => 1});


# The marklocation id will be added later 
my $query = "INSERT INTO ld (marker1, marker2, marker1name,marker2name, r2, r2v, maf1, maf2) VALUES (?,?,?,?,?,?,?,?)";
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
  
  my @ids = ();
  foreach my $line (@lines){
    my @attributes = split(/\s+/,$line);
    if($attributes[0] =~ /\d/){
       #Fetch Marker ID given the marker name
       my $s_sth = $dbh->prepare('SELECT id FROM marker WHERE idx = ?');
       $s_sth->execute($attributes[0]);
       my @data = $s_sth->fetchrow_array();
       my $m_id = $data[0];
       my $locus = $attributes[2];
       my $ele=3;
       my $size = scalar @attributes;
       while($ele<= $size-3){
         my $s_name = $ids[$ele];
         $s_name = substr $s_name,0,-8;
         #Fetch Sample ID given the sample name
         my $s_sth = $dbh->prepare('SELECT id FROM sample WHERE name = ?');
         $s_sth->execute($s_name);
         my @data = $s_sth->fetchrow_array();
         my $s_id = $data[0];

         $statement->execute($attributes[$ele],$attributes[$ele+1],$attributes[$ele+2],$locus,$s_id,$m_id);
         $ele += 3;
       }
    } else {
       @ids = split(/\s+/,$line);
    }
  }
}
$statement->finish();
#Disconnect from the database;
$dbh->disconnect();

exit 0;
