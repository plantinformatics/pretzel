# LD
# =========

# The initial design aims to match the data structure from AgriBio.
# The LD table stores association scores of alleles at difference loci.  

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

		r2:
			type: 'float'
			required: true

		r2v:
			type: 'float'
			required: true

		MAF1:
			type: 'float'
			required: true

		MAF2:
			type: 'float'
			required: true

		marker:
			model: 'marker'

		markerB:
			type: 'integer'
			required: true