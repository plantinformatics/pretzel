#-------------------------------------------------------------------------------
# environment configuration related to building/running of the MMV application (Pretzel).
# This is a template for the configuration which is not committed to git.
#-------------------------------------------------------------------------------

#-------------------------------------------------------------------------------
# Usage :
#  source ~/env_prod_host.bash
#  source ~/env_prod.bash	(this file)
#  source ~/pretzel/resources/tools/functions_prod.bash
# where ~/env_prod_host.bash contains, e.g. :
#  export API_HOST=your.web-app-domain.net;
#  export API_PORT_EXT=5000;
#-------------------------------------------------------------------------------




export API_HOST=localhost
export API_PORT_EXT
unusedVariable=${API_PORT_EXT=80}
export APIPORT=$API_PORT_EXT
export API_HOST_PORT=${API_HOST}:$API_PORT_EXT
export APIHOST=$API_HOST_PORT

# DB_NAME is the mongodb database name

# if not using AUTH=ALL EMAIL_VERIFY=NONE, then
# provide real values for : EMAIL_HOST, EMAIL_USER, EMAIL_PASS
# EMAIL_FROM, EMAIL_ADMIN
export \
DB_NAME=admin	\
EMAIL_VERIFY=ADMIN	\
EMAIL_ADMIN=Admin_Moderator@your-organisation.net	\
EMAIL_HOST=EMAIL_HOST	\
EMAIL_PORT=25	\
EMAIL_USER=EMAIL_USER	\
EMAIL_PASS=EMAIL_PASS	\
EMAIL_FROM=admin@your.web-app-domain.net	\

