# User 
# =====
# This model represents the users of the system. They should mainly be authenticated using nexus ids, 
# but should allow to have flexibility of basic password based users.
# Passwords should always be stored as hash strings.
# Refer to podd:User for concept details.
# Created by Raj Gaire (raj.gaire@csiro.au)
# Comments: copied from Germplasm Project
module.exports = 
	# sails automatically adds 'created at' and 'updated at' fields that we don't want.
	autoCreatedAt: false
	autoUpdatedAt: false
	
	# We want to define our own primary key (PK)
	autoPK : false

	# these are the fields in our User model
	attributes :
		# Data Properties
		# -------------------
		# The primary key
		id:
			type: 'integer'
			primaryKey: true
			autoIncrement: true

		# The user name
		username: 
			type: 'string'
			unique: true

		# The password. It will have an empty password for nexus users as the nexus users are authenicated directly.
		password: 'string'

		# Type of user. A nexus user will be authenticated through nexus server. The basic user will be authenticated using
		# stored password in hashed format
		type: 
			type: 'string'
			"enum": ["basic", "nexus"]
			defaultsTo: "nexus"
			index: true

		# The most recent login timestamp
		lastLoginTime:
			type: 'datetime'
			defaultsTo: () ->
				return new Date()

		# The status of the user (active or inactive)
		status: 
			type: 'string'
			enum: ["Active", "Inactive"]
			defaultsTo: "Active"
			index: true
		# The role of the user. An administrator should be able to add other users. Authenicated users can perform
		# rest of the activities.
		role: 
			type: 'string'
			"enum": ["Administrator", "Authenticated"]
			defaultsTo: "Authenticated"
			index: true
		# The person details

		# Object Properties
		# ------------------
		# Personal details of the user.
		# *  see: <a href='Person.html'>Person</a>
#		refersToPerson:
#			model: 'person'
#			required: true

		# relationships with project


#		isAdminOfProjects:
#			collection: "Project"
#			via: "hasAdministrators"
#			includeIn: { list: "record", detail: "record"}

#		observesProjects:
#			collection: "Project"
#			via: "hasObservers"
#			includeIn: { list: "record", detail: "record"}

		# when accessing the data, password should be removed.
		toJSON: () ->
			obj = this.toObject()
			delete obj.password
			return obj
		
