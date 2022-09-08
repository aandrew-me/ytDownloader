# ytDownloader
A modern GUI video and audio downloader supporting [hundreds of sites](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md)

<a href="https://flathub.org/apps/details/me.aandrew.ytdownloader"><img src="https://flathub.org/assets/badges/flathub-badge-en.svg" style="width:180px;"></a>
[![Get it from the Snap Store](https://snapcraft.io/static/images/badges/en/snap-store-black.svg)](https://snapcraft.io/ytdownloader)

[![Get AppImage](https://raw.githubusercontent.com/srevinsaju/get-appimage/master/static/badges/get-appimage-branding-blue.png)](https://github.com/aandrew-me/ytDownloader/releases/latest/download/YTDownloader.AppImage)
<a href="https://github.com/aandrew-me/ytDownloader/releases/latest/download/YTDownloader.exe
"><img src="https://user-images.githubusercontent.com/66430340/187172806-a8edd12a-ef58-4a05-96a3-99d7490b42f6.png" style="width:190px;"></a>

 README in [other languages](READMES/list.md)

## Features 🚀

✅ Light/Dark mode

✅ Supports hundreds of sites including Youtube, Facebook, Instagram, Tiktok, Twitter and so on.

✅ Advanced options like Range Selection

✅ Available on Windows and Linux

✅ Fast download speeds

✅ And of-course no trackers or ads

## Screenshots

![image](https://user-images.githubusercontent.com/66430340/188084613-706262fd-db82-403f-8dad-03dd2a50cfe9.png)
![image](https://user-images.githubusercontent.com/66430340/188084389-5e060523-07c3-42db-b282-7f446cb257fa.png)

<!--![ss](https://user-images.githubusercontent.com/66430340/181747909-f16e30dc-a7c3-40cb-876b-54f0ea8d4e42.jpg)-->
<!--![ss2](https://user-images.githubusercontent.com/66430340/181747920-4df80914-278f-4350-9328-015e9e0bcf16.jpg) -->

# Installation
## Windows
Download and install the exe file

## Linux

Linux has several options available - AppImage, Deb, Snap and flatpak.

### AppImage

**AppImage** format is supported on most Linux distros and has Auto-Update support. So it is recommended.
It just needs to be executed after downloading. See more about [AppImages here](https://appimage.org/).

[AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher) is recommended for integrating AppImages.


### Debian package
For Debian based distros like Ubuntu .deb file is available. Download and run -
```
sudo dpkg -i file_name.deb
```
## Internationalization 🌍
Translations into other languages would be highly appreciated. If you want to help translating the app to other languages, you can join from [here](https://crwd.in/ytdownloader). Open a new issue and that language will be added to Crowdin.

### Available languages

|Name|Status  |
|--|--|
|English  | ✔️ |
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
To build for Linux (It will create packages as specified in package.json)
```
npm run linux
```
To build for Windows
```
npm run windows
```