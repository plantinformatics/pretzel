'use strict';

var Promise = require('bluebird')
var fs = require('fs');
var zlib = require('zlib')

Promise.promisifyAll(fs);
Promise.promisifyAll(zlib);

/**
 * Send a json dataset structure to the database
 * @param {string} filePath - path to load the file
 * @returns data
 */
exports.file = (filePath) => {
  console.log(`reading file ${filePath}`)
  return fs.readFileAsync(filePath)
  .then(function(buf) {
    // console.log('file read')
    // console.log(buf.length)
    // console.log(buf)
    return buf
  })
}

/**
 * Reads in binary file
 * @param {string} filePath - path to load the file
 * @returns data
 */
exports.fileBinary = (filePath) => {
  console.log(`reading file ${filePath}`)
  return fs.readFileAsync(filePath, 'binary')
  .then(function(buf) {
    // console.log('file read')
    // console.log(buf.length)
    // console.log(buf)
    return buf
  })
}

/**
 * Unpack a dataset from gzip compression
 * @param {string} data - path to load the file
 * @returns data
 */
exports.gzip = (buf) => {
  return zlib.gunzipAsync(buf)
  .then(function(buf) {
    // console.log('gunzip done')
    // console.log(buf.length)
    // console.log(buf)
    return JSON.parse(buf.toString())
  })
}

/**
 * Unpack a dataset from gzip compression
 * @param {string} filePath - path to load the file
 * @returns data
 */
exports.fileJson = (filePath) => {
  return exports.file(filePath)
  .then(function(buf) {
    return JSON.parse(buf.toString())
  })
}

/**
 * Unpack a dataset from gzip compression
 * @param {string} filePath - path to load the file
 * @returns data
 */
exports.fileGzip = (filePath) => {
  return exports.file(filePath)
  .then(function(data) {
    return exports.gzip(data)
  })
}