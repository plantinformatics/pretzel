from flask import Flask
from flask_executor import Executor
from flask_shell2http import Shell2HTTP

import sys
import os

# python's inbuilt logging module
import logging
# get the flask_shell2http logger
logger = logging.getLogger("flask_shell2http")
# create new handler
handler = logging.StreamHandler(sys.stdout)
logger.addHandler(handler)
# log messages of severity DEBUG or lower to the console
logger.setLevel(logging.DEBUG)  # this is really important!



# Flask application instance
app = Flask(__name__)

executor = Executor(app)
executor.init_app(app)
shell2http = Shell2HTTP(app=app, executor=executor, base_url_prefix="/commands/")
shell2http.init_app(app, executor)

def my_callback_fn(context, future):
  # optional user-defined callback function
  print(context, future.result())

# callback_fn=my_callback_fn, 

# was : scripts/
# /backend/ is changed to /lb4app/lb3app/, maybe temporarily
if 'scriptsDir' in os.environ:
  scriptsDir = os.getenv('scriptsDir')
else:
  # pretzelDir is the root of a git checkout of pretzel
  if 'pretzelDir' in os.environ:
    scriptsDir = os.getenv('pretzelDir') + "/lb4app/lb3app/scripts"
  else:
    scriptsDir = "/app/lb3app/scripts"  # /usr/src/app in blastserver container

if not 'mntData' in os.environ:
  print('mntData not defined')

shell2http.register_command(endpoint="blastn", command_name=(scriptsDir+"/blastn_cont.bash"), callback_fn=my_callback_fn, decorators=[])
shell2http.register_command(endpoint="dnaSequenceLookup", command_name=(scriptsDir+"/dnaSequenceLookup.bash"), callback_fn=my_callback_fn, decorators=[])

