# MarkerMapLocation
# =========

# The initial design aims to match the data structure from AgriBio.
# The Map location table stores genetic mapping locations along with which cluster it was assigned 

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
			type: 'integer'
			primaryKey: true
			autoIncrement: true

		#  The linkage group
		# ----
		linkageGroupA:
			type: 'string'
			required: true
			index: true

		linkageGroupB:
			type: 'string'
			required: true
			index:  true

		# chromosome
		chromosome: 
			type: 'string'
			index: true

		# Location
		location:
			type: 'float'

		# left
		leftpos:
			type: 'string'

		rightpos:
			type: 'string'

		marker:
			model: 'marker'

		geno:
			model: 'genocomplete'

		map:
			model: 'map'