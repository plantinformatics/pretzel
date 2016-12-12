# Map
# =========

# The initial design aims to match the data structure from AgriBio.
# Map table stores meta-data that descripts a particular map (e.g. genetic, physical, or sequence)

# Created by Sean Li (sean.li@csiro.au)
# Updated by
# Comments: 

module.exports = 
	# sails automatically adds 'created at' and 'updated at' fields that we don't want.
	autoCreatedAt: false
	autoUpdatedAt: false

	autoPK : false
	attributes :
		id:
			type: 'string'
			primaryKey: true
			autoIncrement: true

		# Name
		# ----
		# the map name, designed to use in pulications
		name: 
			type: 'string'
			unique: true
			required: true
			index: true

		consensus: 
			type: 'string'
			required: true
			index: true

		# Which party/group produces this map, or publicly downloaded
#		source: 
#			type: 'string'
#			unique: true

		# Type of Map. Currently, by default, it will be GENETIC.
#		type: 
#			type: 'string'
#			enum: ['GENETIC','PHYSICAL','SEQUENCE','OTHER']
#			defaultsTo: 'GENETIC'
#			index: true
		
		# Map parameters
#		units:
#			type: 'string'
#			defaultsTo: 'cm'
		
		start:
			type: 'float'

		stop:
			type: 'float'

		maporder:
		    type: 'integer'
			
		mapset:
			model: 'mapset'

		markermaplocations:
			collection: 'markermaplocation'
			via: 'map'

		# Is public map or not, or going to be published
#		isPub:
#			type: 'boolean'
#			defaultsTo: false

		# Some descriptions 
		# -------
#		description: 
#			type: 'string'

#		species:
#			model: 'species'

#		maplocation:
#			collection: 'markermaplocation'
#			via: 'map'
