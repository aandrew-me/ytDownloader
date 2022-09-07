<!-- Readme in Turkish language by nxjosephofficial -->
# ytDownloader
[Yüzlerce site](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md)yi destekleyen, modern bir video indirme programı


<a href="https://flathub.org/apps/details/me.aandrew.ytdownloader"><img src="https://flathub.org/assets/badges/flathub-badge-en.svg" style="width:180px;"></a>
[![Get it from the Snap Store](https://snapcraft.io/static/images/badges/en/snap-store-black.svg)](https://snapcraft.io/ytdownloader)

[![Get AppImage](https://raw.githubusercontent.com/srevinsaju/get-appimage/master/static/badges/get-appimage-branding-blue.png)](https://github.com/aandrew-me/ytDownloader/releases/latest/download/YTDownloader.AppImage)
<a href="https://github.com/aandrew-me/ytDownloader/releases/latest/download/YTDownloader.exe
"><img src="https://user-images.githubusercontent.com/66430340/187172806-a8edd12a-ef58-4a05-96a3-99d7490b42f6.png" style="width:190px;"></a>



## Özellikler

✅ Açık/Koyu tema

✅ Youtube, Facebook, Instagram, Tiktok, Twitter dahil yüzlerce siteyi destekler.

✅ İndirilecek dosyanın zaman aralığını seçme gibi gelişmiş özellikler

✅ Windows ve Linux versiyonları mevcuttur

✅ Hızlı indirme hızları

✅ Elbette, izleyici ve reklam yok

## Ekran Görüntüleri

![image](https://user-images.githubusercontent.com/61632416/188954447-356acb65-09fb-43da-b79f-655767f4d2bb.png)
![image](https://user-images.githubusercontent.com/61632416/188954452-fd59f517-1d42-47be-ac8e-b0f9cab2c4b6.png)

<!--![ss](https://user-images.githubusercontent.com/66430340/181747909-f16e30dc-a7c3-40cb-876b-54f0ea8d4e42.jpg)-->
<!--![ss2](https://user-images.githubusercontent.com/66430340/181747920-4df80914-278f-4350-9328-015e9e0bcf16.jpg) -->


# Kurulum

## Windows
exe dosyasını indirin ve kurulumu gerçekleştirin

## Linux

Linux için çeşitli seçenekler var - AppImage, Deb, Snap ve flatpak olarak indirebilirsiniz.

### AppImage (Tıkla Çalıştır)

**AppImage** formatı çoğu Linux dağıtımında desteklenir ve otomatik güncelleme özelliği vardır. Bu yüzden AppImage kullanmanız tavsiye edilir.
İndirildikten sonra sadece çalıştırılması gerekiyor. Daha fazlası için [AppImage sitesini ziyaret edin](https://appimage.org/).

[AppImageLauncher](https://github.com/TheAssassin/AppImageLauncher), AppImage'leri entegre etmek için önerilir.


### Debian paketi
Ubuntu gibi Debian temelli dağıtımlar için .deb dosyası mevcuttur. İndirin ve komutu çalıştırın -
```
sudo dpkg -i dosya_adı.deb
```

## Kaynak koddan derlemek ve çalıştırmak için

[Nodejs](https://nodejs.org/) (npm ile birlikte) kurulu olması gerekiyor.

Başlamak için komutlar.
```
git clone https://github.com/aandrew-me/ytDownloader.git
cd ytDownloader
npm i
```

[Electron](https://www.electronjs.org/) ile çalıştırmak için :
```
npm start
```
Linux versiyonunu derlemek için
```
npm run linux
```
