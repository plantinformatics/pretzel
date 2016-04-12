#!/usr/bin/perl

use strict;
use DBI;

print "Produce Corrdinates.\n";
my $host = "mysql-test3.it.csiro.au";
my $user = "dav127_user";
my $password = "xl8qbYZS=qexcpquGpl\$";
my $database = "dav127_test";

my $dbh = DBI->connect("DBI:mysql:database=$database;host=$host",$user,$pwd,{'RaiseError' => 1});


exit 0;
