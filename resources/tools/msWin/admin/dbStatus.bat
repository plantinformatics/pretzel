C:\"Program Files"\MongoDB\Server\3.4\bin\mongo.exe --eval "conn = new Mongo(); db = conn.getDB('test'); db.getCollectionNames();"

@REM db.hostInfo()
@REM --eval "db.serverStatus()"
@REM status 
@REM "use test "
@REM "show collections"
@REM exit


@timeout /t 10