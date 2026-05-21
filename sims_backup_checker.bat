@echo off
title SIMS Backup Checker

set "MAIN=C:\Projects\SIMS_BACKUP"
set "BACKUP=C:\Projects\SIMS_BACKUP - Copy"

echo Checking backup status...
echo.

robocopy "%MAIN%" "%BACKUP%" /MIR /L > check.txt

findstr /C:"New File" /C:"Older" /C:"New Dir" check.txt >nul

if %errorlevel%==0 (
    echo Backup is NOT up to date.
    echo.
    
    choice /M "Do you want to update the backup"

    if errorlevel 2 (
        echo.
        echo Backup update cancelled.
    ) else (
        echo.
        echo Updating backup...
        robocopy "%MAIN%" "%BACKUP%" /MIR /R:1 /W:1
        echo.
        echo Backup updated successfully.
    )
) else (
    echo Backup is already up to date.
)

del check.txt

echo.
pause