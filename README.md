# ytDownloader 

<p><a href="https://flatstat.mijorus.it/app/me.aandrew.ytdownloader"  align="center"><img width="250" src="https://img.shields.io/endpoint?url=https://flathub-stats-backend.vercel.app/badges/me.aandrew.ytdownloader/shields.io.json"></a></p>

A modern GUI video and audio downloader supporting [hundreds of sites](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md)

<a href="https://flathub.org/apps/details/me.aandrew.ytdownloader"><img src="https://flathub.org/assets/badges/flathub-badge-en.svg" style="width:180px;"></a>
[![Get it from the Snap Store](https://snapcraft.io/static/images/badges/en/snap-store-black.svg)](https://snapcraft.io/ytdownloader)

[![Get AppImage](https://raw.githubusercontent.com/srevinsaju/get-appimage/master/static/badges/get-appimage-branding-blue.png)](https://github.com/aandrew-me/ytDownloader/releases/latest/download/YTDownloader.AppImage)
<a href="https://github.com/aandrew-me/ytDownloader/releases/latest/download/YTDownloader_Win.exe
"><img src="https://user-images.githubusercontent.com/66430340/187172806-a8edd12a-ef58-4a05-96a3-99d7490b42f6.png" style="width:190px;"></a>

<a href="https://github.com/aandrew-me/ytDownloader/releases/latest/download/YTDownloader_Mac.zip"><img src="https://user-images.githubusercontent.com/66430340/189808142-0a4725c6-b167-4afd-98f1-dfcb16bfbd43.png" style="width:200px;"></a>

 README in [other languages](READMES/list.md)

## Features 🚀

✅ Light/Dark mode

✅ Supports hundreds of sites including Youtube, Facebook, Instagram, Tiktok, Twitter and so on.

✅ Advanced options like Range Selection

✅ Available on Linux, Windows & macOS

✅ Fast download speeds

✅ And of-course no trackers or ads

## Screenshots

![image](https://user-images.githubusercontent.com/66430340/188084613-706262fd-db82-403f-8dad-03dd2a50cfe9.png)
![image](https://user-images.githubusercontent.com/66430340/188084389-5e060523-07c3-42db-b282-7f446cb257fa.png)

<!--![ss](https://user-images.githubusercontent.com/66430340/181747909-f16e30dc-a7c3-40cb-876b-54f0ea8d4e42.jpg)-->
<!--![ss2](https://user-images.githubusercontent.com/66430340/181747920-4df80914-278f-4350-9328-015e9e0bcf16.jpg) -->

# Installation
## Windows 🪟
Download and install the exe file. Windows defender may create problems as usual.

## Linux 🐧

Linux has several options available - AppImage, Deb, Snap and flatpak.
### AppImage

**AppImage** format is supported on most Linux distros and has Auto-Update support. So it is recommended.
It just needs to be executed after downloading. See more about [AppImages here](https://appimage.org/).

[AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher) is recommended for integrating AppImages.


### Debian package
For Debian based distros like Ubuntu .deb file is available. Download and run -
```
sudo dpkg -i YTDownloader.deb
```
## macOS 🍎
Since the app is not signed, when you will try to open the app, macOS will not allow you to open it. So you will need to follow some steps to open it.

1. Click on **System Preferences** on your Mac Dock.
2. Choose **Security & Privacy**
3. The app will be shown there. Click on **Open**

## Internationalization 🌍
Translations into other languages would be highly appreciated. If you want to help translating the app to other languages, you can join from [here](https://crwd.in/ytdownloader). Open a new issue and that language will be added to Crowdin.

### ✅ Available languages

|Name |Status (Credits)  |
|--|--|
|English  | ✔️ |
|Finnish | ✔️ [LINUX-SAUNA](https://t.me/linuxsauna)|
|German | ✔️ [Proxycon](https://github.com/proxycon)|
|Italian  | ✔️ [albanobattistella](https://github.com/albanobattistella)|
|Russian | ✔️ |
|Spanish | ✔️ [haggen88](https://github.com/haggen88)|
| Turkish | ✔️ [nxjosephofficial](https://github.com/nxjosephofficial) |
| Ukrainian | ✔️ [KotoWhiskas](https://github.com/KotoWhiskas) |


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
To build for Linux (It will create packages as specified in package.json). The builds are stored in **release** folder.
```
npm run linux
```
To build for Windows
```
npm run windows
```
To build for macOS
```
npm run mac
```
