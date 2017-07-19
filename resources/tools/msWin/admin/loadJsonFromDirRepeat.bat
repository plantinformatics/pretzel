cd C:\data\data\json\in

:rescanFolder

forfiles  /m *.json /c "cmd /c c:\data\admin\load1Json @file"

@timeout /t 30

@goto rescanFolder