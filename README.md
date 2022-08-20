# YouTube Downloader
A GUI for downloading Video and Audio files from YouTube using Nodejs and Electron

## Features

✅ Light/Dark mode

✅ Video download support (High resolution supported)

✅ Audio download support

✅ Available on Windows and Linux

✅ Fast download speed

✅ No external dependencies needed

✅ And ofcourse no trackers or ads

## Screenshots

![ss](https://user-images.githubusercontent.com/66430340/181747909-f16e30dc-a7c3-40cb-876b-54f0ea8d4e42.jpg)
![ss2](https://user-images.githubusercontent.com/66430340/181747920-4df80914-278f-4350-9328-015e9e0bcf16.jpg)


# Installation

## Windows
Download and install the exe file

## Linux

Linux has several options available - AppImage, deb and flatpak.

### AppImage
**AppImage** is supported on most Linux distros and has Auto-Update support. So it is recommended.
It just needs to be executed after downloading. See more about [AppImages here](https://appimage.org/).

### Flatpak
The app is available on **Flathub** [here](https://flathub.org/apps/details/me.aandrew.ytdownloader)

To install run 
```
flatpak install flathub me.aandrew.ytdownloader
```
After installing, a .desktop file should be added and the app should be available in app search.
Othrwise it also can be launched by executing
```
flatpak run me.aandrew.ytdownloader
```

### Debian package
For Debian based distros like Ubuntu .deb file is available. Download and run -
```
sudo dpkg -i file_name.deb
```

## For building or running from source code

[Nodejs](https://nodejs.org/) (along with npm) needs to be installed.

Required commands to get started.
```
git clone https://github.com/aandrew-me/ytDownloader.git
cd ytDownloader
npm i
```

To run with [Electron](https://www.electronjs.org/) :
```
npm start
```
