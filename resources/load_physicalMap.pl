#!/usr/bin/perl
# Created by Sean Li @ 30/07/2016
# Updated by

use strict;
use warnings;
use DBI;

#Provide a folder where contains all the sample files.
my $chromosome_file = $ARGV[0] || die "Please provide the file that stores the chromosome name and length information, e.g. Length_NRGenev0.4_Pseduomolecules.txt \n";
my $physicalMap_file = $ARGV[1] || die "Please provide the file that stores the marker positions in the assemblies and associated information, e.g. 160712_Physical_position_90k_SNP_probs_NRgene_v03_scaffolds_Grp1_chromosomes.txt \n";

#Start from Database connection.
#my $host = 'bio-01-cdc.it.csiro.au';
my $host = 'mysql-test3.it.csiro.au';
my $database = 'test';
my $user = 'dav127_admin';
my $pwd = 'D@V127_@dm1n';

my $dbh = DBI->connect("DBI:mysql:database=$database;host=$host",$user,$pwd,{'RaiseError' => 1});


# First check whether the chromosome information has been loaded already

my $s_sth = $dbh->prepare('SELECT id FROM chromosome limit 10');
$s_sth->execute();
my @data = $s_sth->fetchrow_array();
$s_sth->finish();

unless(defined $data[0]){
  # Load the chromosome info 
  my $query = "INSERT INTO chromosome(name, length) VALUES (?,?)";
  my $statement = $dbh->prepare($query);
  open(FHD, $chromosome_file) || die "Can't open the file $chromosome_file. Please have a check. \n";
  my @lines = <FHD>; 
  close(FHD);
  
  foreach my $line (@lines){
    chomp $line;
    my @attributes = split(/\s+/,$line);
    $statement->execute($attributes[0], $attributes[1]);
  }
  $statement->finish(); 
}

#Then load physical map information
my $physical_query = "INSERT INTO physicalmap(scaffoldName, scaffoldLength, probeOrientation, targetPosition, probeStart, probeStop, scaffoldStartChr, scaffoldStopChr, scaffoldOrientationChr, chromosome, marker) VALUES (?,?,?,?,?,?,?,?,?,?,?)";
my $phyiscal_statement = $dbh->prepare($physical_query);

open(FHD, $physicalMap_file) || die "Can't open the file $physicalMap_file. Please have a check. \n";
my @lines = <FHD>;
close(FHD);

foreach my $line (@lines){
  chomp $line;
  my @attributes = split(/\s+/,$line);
  #SNP_index	SNP_id	SNP_name	CS_NRGv0.3_scaffold_name	CS_NRGv0.3_scaffold_length	SNP_probe_orientation_in_NRGv0.3_scaffold	Tgt_SNP_pos_in_NRGv0.3_scaffold	SNPprobe_start_in_CS_NRGv0.3_scaffold	SNPprobe_stop_in_CS_NRGv0.3_scaffold	CS_NRGv0.3_scaffold_start_position_in_v0.4pseudomcl	CS_NRGv0.3_scaffold_stop_position_in_v0.4pseudomcl	CS_NRGv0.3_scaffold_orientation_in_v0.4pseudomcl	CS_NRGv0.3_HiC_Chr_Assignment	CS_NRGv0.3_HiC_Bin	CS_NRGv0.3_PopSeq_Chr_Assignment	CS_NRGv0.3_PopSeq_Position
  #2454	IWB2454	BobWhite_c31470_532	NRGv0.3_scaffold100613	1301937	-	1286018	1286019	1286068	1437464	2739400	-1	1A	2	1A	1.584
  unless($attributes[0] eq 'SNP_index'){ #skip the header
     my $marker_name = $attributes[1];
     my $marker_commonName = $attributes[2];
     my $chromosome_name = $attributes[12];

     #Fetch Marker ID given the marker name
     my $s_sth = $dbh->prepare('SELECT id FROM marker WHERE name = ? and commonName = ?');
     $s_sth->execute($marker_name,$marker_commonName);
     my @data = $s_sth->fetchrow_array();
     $s_sth->finish();
     if(defined $data[0]){
       my $marker = $data[0];
       #Fetch chromosome ID given the chromosome name  
       $s_sth = $dbh->prepare('SELECT id,length FROM chromosome WHERE name = ?');
       $s_sth->execute($chromosome_name);
       @data = $s_sth->fetchrow_array();
       $s_sth->finish();
       if(defined $data[0]){
         my $chromosome = $data[0];
         my $length = $data[1];
         #scaffoldName, scaffoldLength, probeOri, targetPosition, probeStart, probeStop, scaffoldStart, scaffoldStop, scaffoldOrit, chromosome, marker
         my $position;
         my $orientation;
         if($attributes[11] eq '-1'){
           $orientation = '-';
           #scaffoldStartPosinChr+(scaffoldlength - markerPositioninScaffold)
           $position = $attributes[9]+($attributes[4]-$attributes[6]);
         } else {
           $orientation = '+';
           $position = $attributes[10]-($attributes[4]-$attributes[6]);
         }
         $phyiscal_statement->execute($attributes[3],$attributes[4],$attributes[5],$position,$attributes[7],$attributes[8],$attributes[9],$attributes[10],$orientation,$chromosome,$marker);
         
       } else {
         #print "skip this record. No chromosome name has been found from the database;"
         print "chromosome missing: \t $line";
       }
     } else {
       #print "skip this record. No marker information has been found from the database;"
       print "marker missing: \t $line";
     }
  }
}
$phyiscal_statement->finish();
#Disconnect from the database;
$dbh->disconnect();

exit 0;
