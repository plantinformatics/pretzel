

cd C:\data\data\json\in

forfiles  /m *.json /c "cmd /c c:\data\admin\load1Json @file"

@timeout /t 15