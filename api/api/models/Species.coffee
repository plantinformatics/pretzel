# Species
# =========

# The initial design aims to match the data structure from AgriBio.
# Species table basically stores primary information about the species 

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

		# the species assembly accession number
		RefSeqAcc: 
			type: 'string'
			unique: true
			required: true
			index: true

		GenBanAcc:
			type: 'string'
			unique: true
			required: true
			index: true


		# the species name
		OrganismName: 
			type: 'string'
			index: true

	   # the species commonly known as 
		CommonName: 
			type: 'string'

		# Type of Marker. Currently, by default, it will be SNP.
		taxonomyID: 
			type: 'integer'
			index: true

		# Different types of maps belong to a parituclar species
		Map:
			collection: 'mapset'
			via: 'species'