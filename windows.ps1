Invoke-WebRequest -Uri "https://github.com/aandrew-me/ffmpeg-builds/releases/download/v8/deno.exe" -OutFile deno.exe
Invoke-WebRequest -Uri "https://github.com/aandrew-me/ffmpeg-builds/releases/download/v8/ffmpeg_win64.zip" -OutFile ffmpeg_win64.zip
Expand-Archive -Path ffmpeg_win64.zip -DestinationPath .
Remove-Item -Path ffmpeg_win64.zip
Move-Item -Path .\ffmpeg_win64 -Destination .\ffmpeg