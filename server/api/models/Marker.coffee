# Marker
# =========

# The initial design aims to match the data structure from AgriBio, basically stores primary information about the SNPs (markers) 
# being reported from each sample(assay) on the 90K beadchip. e.g. their SNPid, common name, while, other attributes, 
# like type (such as SNP, SSR, RFLP, AFLP, etc.), the description of a particular marker, alleles_number, alleles as well as flanking_sequences
# are essential for future development.

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

		#index
		idx:
			type: 'integer'
			unique: true		
		# Name
		# ----
		# the marker (SNPid: IWB1), designed to use in pulications
		name: 
			type: 'string'
			unique: true
			required: true
			index: true

		# commonly/locally known as (SNP name: BobWhite_c10015_641), should be unique but may not be used in publications
		commonName: 
			type: 'string'
			unique: true

		# Type of Marker. Currently, by default, it will be SNP.
		class: 
			type: 'string'
			enum: ['SNP','SSR','AFLP','RFLP','OTHER']
			defaultsTo: 'SNP'
			index: true

		# Some descriptions 
		# -------
		description: 
			type: 'string'

		# the number of alleles
		alleles_number:
			type: 'integer' 
		
		# alleles
		alleles:
			type: 'string'

		# flanking sequences to produce this marker
		flanking_sequences:
			type: 'text'

#		sample:
#			model: 'sample'

		genos:
			collection: 'genocomplete'
			via: 'marker'
		
		markermaplocations:
			collection: 'markermaplocation'
			via: 'marker'

		lds:
			collection: 'ld'
			via: 'marker'

		physicalmaps:
			collection: 'physicalmap'
			via: 'marker'