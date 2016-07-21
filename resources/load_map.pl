#!/usr/bin/perl

# Load Mapset/Map/Markermapset information from a number of collections.
# Created by Sean Li @ 09/11/2015
# Updated by

use strict;
use warnings;
use DBI;

#Provide a folder where contains all the sample files.
my $data_dir = $ARGV[0] || die "Please provide the directory that stores all the sample ***_Sentrix.txt files. \n";
opendir(my $dir_hd, $data_dir) || die "Can't open the directory $data_dir. Please have a check. \n";
my @files = grep {/GeneticMap/} readdir($dir_hd);
closedir($dir_hd);

#Start from Database connection.
my $host = 'bio-01-cdc.it.csiro.au';
my $database = 'dav127_v01';
my $user = 'sqladmin';
my $pwd = '5QL@dmin';

my $dbh = DBI->connect("DBI:mysql:database=$database;host=$host",$user,$pwd,{'RaiseError' => 1});


my $query = "INSERT INTO map (name, start, stop, maporder, mapset) VALUES (?,?,?,?,?)";
my $statement = $dbh->prepare($query);

my $ms_query = "INSERT INTO mapset (name, source, class, units, isPub, species) VALUES (?,?,?,?,?,?)";
my $ms_statement = $dbh->prepare($ms_query);

my $mm_query = "INSERT INTO markermaplocation (chromosome, location, marker, map) VALUES (?,?,?,?)";
my $mm_statement = $dbh->prepare($mm_query);

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
  my %map_hash = ();
  #SNPindex	Chr	cM	P1 Cluster#	P2 Cluster#
  #47522	1A	0	C1	C2
  foreach my $line (@lines){
    chomp $line;
    my @attributes = split(/\s+/,$line);
    if($attributes[0] =~ /\d/){
      my $dis = $attributes[2];
      my $key = $attributes[1];
      $map_hash{$key}{$dis} = 1;
    }   
  }
  my%chr_hash = ();
  while(my ($key,$value) = each (%map_hash)){
    my $min = 99999999999;
    my $max = 0;
    foreach my $k (sort {lc $a <=> lc $b} keys (%$value)){
      if($k<$min){
        $min = $k;
      };
      if($k > $max){
        $max = $k;
      }  
    }
    $chr_hash{$key} = $min."_".$max;
    
  }
  $ms_statement->execute($source,$source,'genetic','cM','0','wheat');
  #Fetch mapset ID given the mapset name.
  my $ms_sth = $dbh->prepare('SELECT id FROM mapset WHERE name = ?');
  $ms_sth->execute($source);
  my @data = $ms_sth->fetchrow_array(); 
  my $ms_id = $data[0];
  my $order = 0;
  foreach my $key (sort {lc $a cmp lc $b} keys %chr_hash){
    my @records = split(/\_/,$chr_hash{$key});
    $statement->execute($key,$records[0],$records[1],$order,$ms_id);
    $order++;
  }
  
  #Process the markermaplocation table
  foreach my $line (@lines){
    chomp $line;
    my @attributes = split(/\s+/,$line);
    if($attributes[0] =~ /\d/){
      my $dis = $attributes[2];
      my $key = $attributes[1];

      #Fetch the marker ID.
      my $m_sth = $dbh->prepare('SELECT id FROM marker WHERE idx = ?');
      $m_sth->execute($attributes[0]);
      my @data = $m_sth->fetchrow_array();
      my $m_id = $data[0];
      
      #Fetch the map ID.
      my $mp_sth = $dbh->prepare('SELECT id FROM map WHERE name= ? and mapset= ?');
      $mp_sth->execute($attributes[1],$ms_id);
      @data = $mp_sth->fetchrow_array();
      my $mp_id = $data[0];
#      print $attributes[1]."\t".$attributes[2]."\t".$m_id."\t".$mp_id."\n";
      $mm_statement->execute($attributes[1],$attributes[2],$m_id,$mp_id);
    }
  }

   

}
$statement->finish();
$ms_statement->finish();
$mm_statement->finish();
#Disconnect from the database;
$dbh->disconnect();

exit 0;
