# Chromosome
# =========

# The initial design aims to match the data structure from AgriBio.
# The chromosome table stores the length of v0.4 pseudochromosomes.  

# Created by Sean Li (sean.li@csiro.au)
# Updated by 12/08/2016
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

		name:
			type: 'string'
			required: true

		length:
			type: 'integer'
			required: true
