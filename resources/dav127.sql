-- phpMyAdmin SQL Dump
-- version 4.1.14
-- http://www.phpmyadmin.net
--
-- Host: 127.0.0.1
-- Generation Time: Nov 03, 2015 at 07:02 AM
-- Server version: 5.6.17
-- PHP Version: 5.5.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;

--
-- Database: `dav127_v01`
--

-- --------------------------------------------------------

--
-- Table structure for table `genocomplete`
--

CREATE TABLE IF NOT EXISTS `genocomplete` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `clustergroup` varchar(255) DEFAULT NULL,
  `score` float DEFAULT NULL,
  `geno` varchar(255) DEFAULT NULL,
  `locus` varchar(255) DEFAULT NULL,
  `sample` int(11) DEFAULT NULL,
  `marker` int(11) DEFAULT NULL,
  `markerlocation` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `clustergroup` (`clustergroup`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 AUTO_INCREMENT=1 ;

-- --------------------------------------------------------

--
-- Table structure for table `map`
--

CREATE TABLE IF NOT EXISTS `map` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) DEFAULT NULL,
  `start` float DEFAULT NULL,
  `stop` float DEFAULT NULL,
  `maporder` int(11) DEFAULT NULL,
  `mapset` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 AUTO_INCREMENT=1 ;

-- --------------------------------------------------------

--
-- Table structure for table `mapset`
--

CREATE TABLE IF NOT EXISTS `mapset` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) DEFAULT NULL,
  `source` varchar(255) DEFAULT NULL,
  `class` varchar(255) DEFAULT NULL,
  `units` varchar(255) DEFAULT NULL,
  `isPub` tinyint(1) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `species` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  UNIQUE KEY `source` (`source`),
  KEY `class` (`class`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 AUTO_INCREMENT=1 ;

-- --------------------------------------------------------

--
-- Table structure for table `marker`
--

CREATE TABLE IF NOT EXISTS `marker` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `idx` int(11) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `locus` varchar(255) DEFAULT NULL,
  `commonName` varchar(255) DEFAULT NULL,
  `class` varchar(255) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `alleles_number` int(11) DEFAULT NULL,
  `alleles` varchar(255) DEFAULT NULL,
  `flanking_sequences` longtext,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx` (`idx`),
  UNIQUE KEY `name` (`name`),
  UNIQUE KEY `commonName` (`commonName`),
  KEY `class` (`class`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 AUTO_INCREMENT=1 ;

-- --------------------------------------------------------

--
-- Table structure for table `markermaplocation`
--

CREATE TABLE IF NOT EXISTS `markermaplocation` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `linkageGroupA` varchar(255) DEFAULT NULL,
  `linkageGroupB` varchar(255) DEFAULT NULL,
  `chromosome` varchar(255) DEFAULT NULL,
  `location` float DEFAULT NULL,
  `leftpos` varchar(255) DEFAULT NULL,
  `rightpos` varchar(255) DEFAULT NULL,
  `marker` int(11) DEFAULT NULL,
  `geno` int(11) DEFAULT NULL,
  `map` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `linkageGroupA` (`linkageGroupA`),
  KEY `linkageGroupB` (`linkageGroupB`),
  KEY `chromosome` (`chromosome`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 AUTO_INCREMENT=1 ;

-- --------------------------------------------------------

--
-- Table structure for table `sample`
--

CREATE TABLE IF NOT EXISTS `sample` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) DEFAULT NULL,
  `commonName` varchar(255) DEFAULT NULL,
  `source` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 AUTO_INCREMENT=1 ;

-- --------------------------------------------------------

--
-- Table structure for table `species`
--

CREATE TABLE IF NOT EXISTS `species` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `RefSeqAcc` varchar(255) DEFAULT NULL,
  `GenBanAcc` varchar(255) DEFAULT NULL,
  `OrganismName` varchar(255) DEFAULT NULL,
  `CommonName` varchar(255) DEFAULT NULL,
  `taxonomyID` int(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `RefSeqAcc` (`RefSeqAcc`),
  UNIQUE KEY `GenBanAcc` (`GenBanAcc`),
  KEY `OrganismName` (`OrganismName`),
  KEY `taxonomyID` (`taxonomyID`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 AUTO_INCREMENT=1 ;

-- --------------------------------------------------------

--
-- Table structure for table `user`
--

CREATE TABLE IF NOT EXISTS `user` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(255) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `class` varchar(255) DEFAULT NULL,
  `lastLoginTime` datetime DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `role` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  KEY `class` (`class`),
  KEY `status` (`status`),
  KEY `role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=latin1 AUTO_INCREMENT=1 ;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
