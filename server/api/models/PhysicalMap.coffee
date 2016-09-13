# PhysicalMap
# =========

# The initial design aims to match the data structure from AgriBio, basically stores SNPs' (markers) physical location in the assemblies. 

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

		# scaffoldName
		# ----
		# CS_NRGv0.3_scaffold_name
		# ----
		# the scaffold name (NRGv0.3_scaffold100613), designed to use in pulications
		scaffoldName: 
			type: 'string'
			required: true
			index: true

        # scaffoldLength
		# ----
		# CS_NRGv0.3_scaffold_length
		# ----
		scaffoldLength: 
			type: 'integer'
			required: true

		# probeOrientation	
        # ----
        # -/+
        # ---
		probeOrientation: 
			type: 'string'
			enum: ['-','+']
			defaultsTo: '+'

		# targetPosition
		#---
		#Tgt_SNP_pos_in_NRGv0.3_scaffold
		#---
		targetPosition:
			type: 'integer'
			required: true

		# probeStart
		# ---
		# SNPprobe_start_in_CS_NRGv0.3_scaffold
		# ---
		probeStart:
			type: 'integer'
			required: true

		# probeStop
		# ---
		# SNPprobe_stop_in_CS_NRGv0.3_scaffold
		# ---
		probeStop:
			type: 'integer'
			required: true

		# scaffoldStartChr
		# ---
		# CS_NRGv0.3_scaffold_start_position_in_v0.4pseudomcl
		# ---
		scaffoldStartChr:
			type: 'integer'
			required: true

		# scaffoldStopChr
		# ---
		# CS_NRGv0.3_scaffold_stop_position_in_v0.4pseudomcl
		# ---
		scaffoldStopChr:
			type: 'integer'
			required: true

		# scaffoldOrientationChr
		# ---
		# CS_NRGv0.3_scaffold_orientation_in_v0.4pseudomcl
		# ---
		scaffoldOrientationChr: 
			type: 'string'
			enum: ['-','+']
			defaultsTo: '+'

		# chromosome
		# ---
		# CS_NRGv0.3_HiC_Chr_Assignment
		# ---
		chromosome:
			model: 'chromosome'

		marker:
			model: 'marker'

		# Bin
		# ---
		# CS_NRGv0.3_HiC_Bin
		# ---

		# PopChromosome
		# ---
		# CS_NRGv0.3_PopSeq_Chr_Assignment
		# ---

		# PosPosition
		# ---
		# CS_NRGv0.3_Posse_Position
		# ---
