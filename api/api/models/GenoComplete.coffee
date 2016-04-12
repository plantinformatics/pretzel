# GenoComplete
# =========

# The initial design aims to match the data structure from AgriBio.
# GenoComplete table stores information in *_GENO_CompleteTable.txt 
# For a given marker(SNP), it stores the name, the locus (chromosome) where the allelic cluster pair mapped to,
# Cluster assignment, confidence score of the assignment, and the allelic state (geno) 

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

		# the cluster (e.g. C1, C2, C3,...NC)
		clustergroup: 
			type: 'string'
			required: true
			index: true

		# Confidence score of the assignment
		score:
			type: 'float'

		# Geno, if the score is zero, 'NC' should be assigned here
		geno: 
			type: 'string'

		locus:
			type: 'string'
			
		sample:
			model: 'sample'

		marker:
			model: 'marker'

		markerlocation:
			model: 'markermaplocation'