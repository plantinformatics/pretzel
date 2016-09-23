/**
 * Module dependencies
 */
var util = require( 'util' ),
	actionUtil = require( './_util/actionUtil' ),
	pluralize = require( 'pluralize' ),
	_ = require('lodash');

/**
 * Populate (or "expand") an association
 *
 * get /model/:parentid/relation
 * get /model/:parentid/relation/:id
 *
 * @param {Integer|String} parentid  - the unique id of the parent instance
 * @param {Integer|String} id  - the unique id of the particular child instance you'd like to look up within this relation
 * @param {Object} where       - the find criteria (passed directly to the ORM)
 * @param {Integer} limit      - the maximum number of records to send back (useful for pagination)
 * @param {Integer} skip       - the number of records to skip (useful for pagination)
 * @param {String} sort        - the order of returned records, e.g. `name ASC` or `age DESC`
 *
 * @option {String} model  - the identity of the model
 * @option {String} alias  - the name of the association attribute (aka "alias")
 */

module.exports = function expand( req, res ) {

	var Model = actionUtil.parseModel( req );
	var relation = req.options.alias;
	if ( !relation || !Model ) return res.serverError();

	// Allow customizable blacklist for params.
	req.options.criteria = req.options.criteria || {};
	req.options.criteria.blacklist = req.options.criteria.blacklist || [];
	//Removed the actionUtil.uniqueList
	//req.options.criteria.blacklist = actionUtil.uniqueList(req.options.criteria.blacklist.concat([ 'limit', 'skip', 'sort', 'id', 'parentid']));
	req.options.criteria.blacklist = req.options.criteria.blacklist.concat([ 'limit', 'skip', 'sort', 'id', 'parentid']);

	var parentPk = req.param( 'parentid' );
    
	// Determine whether to populate using a criteria, or the
	// specified primary key of the child record, or with no
	// filter at all.
	var childPk = actionUtil.parsePk( req );

	// Coerce the child PK to an integer if necessary
	if ( childPk ) {
		if ( Model.attributes[ Model.primaryKey ].type == 'integer' ) {
			childPk = +childPk || 0;
		}
	}

	var where = childPk ? {id: [childPk]} : actionUtil.parseCriteria(req);

	var skip = actionUtil.parseSkip( req );
	var limit = actionUtil.parseLimit( req );
	var sort = actionUtil.parseSort( req );

	var populateOptions = {
		where: where
	};

	if ( skip ) populateOptions.skip = skip;
	if ( limit ) populateOptions.limit = limit;
	if ( sort ) populateOptions.sort = sort;

	var relationIdentity, documentIdentifier;


	// find the model identity and the Collection for this relation
	var association = _.find( req.options.associations, {
		alias: relation
	} );

	var relationIdentity = association.collection || association.model;

	var RModel = req._sails.models[ relationIdentity ];
	var RAssociations = actionUtil.getAssociationConfiguration( RModel, "list" );


	if ( association.type === "model" ) {
		Model
			.findOne( parentPk )
			.populate( relation, populateOptions )
			.exec( function found( err, matchingRecord ) {
				if ( err ) return res.serverError( err );
				if ( !matchingRecord ) return res.notFound( 'No record found with the specified id.' );
				if ( !matchingRecord[ relation ] ) return res.notFound( util.format( 'Specified record (%s) is missing relation `%s`', parentPk, relation ) );

				// Subcribe to instance, if relevant
				// TODO: only subscribe to populated attribute- not the entire model
				if ( sails.hooks.pubsub && req.isSocket ) {
					Model.subscribe( req, matchingRecord );
					actionUtil.subscribeDeep( req, matchingRecord );
				}


				documentIdentifier = pluralize( actionUtil.kebabCase( RModel.globalId ) );
				var related = Ember.linkAssociations( RModel, matchingRecord[ relation ] );

				/*
				var emberizedJSON = Ember.buildResponse( RelatedModel, results.records, associations, true, associated );

				emberizedJSON.meta = {
					total: results.count
				};
				res.ok( emberizedJSON );			
				*/
				var json = {};
				json[ documentIdentifier ] = related;
				res.ok( json );
			} );
	} else {
		var invRelation = association.via;
		var invAssociation = _.find( RAssociations, {
				alias: invRelation
			} );

		if(invAssociation.type == "model"){
			if ( !RModel ) throw new Error( util.format( 'Invalid route option, "model".\nI don\'t know about any models named: `%s`', relationIdentity ) );
			var criteria = populateOptions.where;
			criteria[invAssociation.alias] = parentPk;
			async.parallel( {
					count: function ( done ) {
						// console.log("counting");
						RModel.count( criteria ).exec( done );
					}, 
					records: function ( done ) {
						// Lookup for records that match the specified criteria
						// console.log("querying");
						var query = RModel.find()
							.where( criteria );
						if ( populateOptions.skip ) 	query.skip(populateOptions.skip);
						if ( populateOptions.limit ) 	query.limit(populateOptions.limit);
						if ( populateOptions.sort ) 	query.sort(populateOptions.sort);
						// populate associations according to our model specific configuration...
						query = actionUtil.populateRecords( query, RAssociations );
						query.exec( done );
					}
				},
				function ( err, results ) {
					if ( err ) return res.serverError( err );

					var matchingRecords = results.records;
					var ids = _.pluck( matchingRecords, 'id' );

					actionUtil.populateIndexes( RModel, ids, RAssociations, function ( err, associated ) {

						if ( err ) return res.serverError( err );

						// Only `.watch()` for new instances of the model if
						// `autoWatch` is enabled.
						if ( req._sails.hooks.pubsub && req.isSocket ) {
							RModel.subscribe( req, matchingRecords );
							if ( req.options.autoWatch ) {
								RModel.watch( req );
							}
							// Also subscribe to instances of all associated models
							// @todo this might need an update to include associations included by index only
							_.each( matchingRecords, function ( record ) {
								actionUtil.subscribeDeep( req, record );
							} );
						}

						var emberizedJSON = Ember.buildResponse( RModel, results.records, RAssociations, true, associated );

						emberizedJSON.meta = {
							total: results.count
						};
						res.ok( emberizedJSON );

					} );
				} );

		}else{ // it is many to many relationship
			modelName = req.options.model || req.options.controller;
			// console.log(Model);
			option1 = (modelName+"_"+association.alias+"__"+association.collection+"_"+association.via).toLowerCase();
			option2 = (association.collection+"_"+association.via+"__"+modelName+"_"+association.alias).toLowerCase();
			// console.log(option1);
			// console.log(option2);

			jointModel = req._sails.models[option1] || req._sails.models[option2] || null;
			// console.log(req._sails.models);
			criteria = {};
			criteria[modelName+"_"+association.alias] = parentPk;
			// console.log(populateOptions);
			async.parallel( {
					count: function ( done ) {
						// console.log("counting");
						jointModel.count( criteria ).exec( done );
					}, 
					records: function ( done ) {
						Model.findOne( parentPk )
							.populate( relation, populateOptions )
							.exec( done);
					}
				},
				function ( err, results ) {
					if ( err ) return res.serverError( err );
					var matchingRecord = results.records;
					if ( !matchingRecord ) return res.notFound( 'No record found with the specified id.' );
					if ( !matchingRecord[ relation ] ) return res.notFound( util.format( 'Specified record (%s) is missing relation `%s`', parentPk, relation ) );
					
					var related = Ember.linkAssociations( RModel, matchingRecord[ relation ] );
					var ids = _.pluck( related, 'id' );

					actionUtil.populateIndexes( RModel, ids, RAssociations, function ( err, associated ) {

						if ( err ) return res.serverError( err );

						// Only `.watch()` for new instances of the model if
						// `autoWatch` is enabled.
						if ( req._sails.hooks.pubsub && req.isSocket ) {
							RModel.subscribe( req, related );
							if ( req.options.autoWatch ) {
								RModel.watch( req );
							}
							// Also subscribe to instances of all associated models
							// @todo this might need an update to include associations included by index only
							_.each( related, function ( record ) {
								actionUtil.subscribeDeep( req, record );
							} );
						}

						var emberizedJSON = Ember.buildResponse( RModel, related, RAssociations, true, associated );

						emberizedJSON.meta = {
							total: results.count
						};
						res.ok( emberizedJSON );

				} );
			} );
		}
	}
};
