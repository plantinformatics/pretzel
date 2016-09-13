# Sample
# =========

# The initial design aims to match the data structure from AgriBio. 
# Sample table basically stores primary information about the sample  
# e.g. their unique sample ID (e.g. WSNP92K.203.18947) genotyped using the 90K SNP, local name given by the user (e.g. F6RIL_10), as well as the source (Burke_x_Frontiera, Chara_x_Glenlea, Hlb_x_Crk, etc)

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

		# Name
		# ----
		# the Sample ID (e.g. WSNP92K.203.18947), unique
		name: 
			type: 'string'
			unique: true
			required: true
			index: true

		# commonly/locally known as (Sample name: F6RIL_10), given by the user
		commonName: 
			type: 'string'

		# Some descriptions 
		# -------
		source: 
			type: 'string'

		# One sample will have multiple markers
#		Markers:
#			collection: 'marker'
#			via: 'sample'

		Genos:
			collection: 'genocomplete'
			via: 'sample'