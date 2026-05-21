@echo off
title SIMS Backup Script

set "SOURCE=C:\Projects\SIMS_BACKUP"
set "BACKUP=C:\Projects\SIMS_BACKUP - Copy"

echo Backing up files...
echo.

robocopy "%SOURCE%" "%BACKUP%" /MIR /R:1 /W:1

echo.
echo Backup completed!
pause