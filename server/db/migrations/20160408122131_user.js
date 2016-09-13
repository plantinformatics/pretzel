'use strict';

exports.up = function(knex, Promise) {
  return knex.schema.createTable('user', function(table) {
    table.increments('id');
    table.timestamp('createdAt');
    table.timestamp('updatedAt');
    table.string('firstName');
    table.string('lastName');
    table.string('email');
    table.string('apiKey');
    table.float('age');
    table.boolean('subscribed');
    table.boolean('verified');
  });
};

exports.down = function(knex, Promise) {
  return knex.schema.dropTable('user');
};

