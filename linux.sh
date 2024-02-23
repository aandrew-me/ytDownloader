#!/bin/bash
# Script to download the latest x64 linux version of custom ffmpeg build for yt-dlp
# The binary will be placed in the root dir of the app

#################### VARIABLES #######################
FFMPEG_URL="https://github.com/yt-dlp/FFmpeg-Builds/releases/download/autobuild-2024-02-22-14-09/ffmpeg-N-113784-g4ea2b271eb-linux64-gpl.tar.xz"
FFMPEG_FILENAME="ffmpeg-N-113784-g4ea2b271eb-linux64-gpl"
FFMPEG_ARCHIVENAME="ffmpeg-N-113784-g4ea2b271eb-linux64-gpl.tar.xz"
#################### VARIABLES #######################

#################### FUNCTIONS #######################
download_and_extract() {
 url="$1"
 filename="$2"
 archive_name="$3"

 wget -q "$url" -O "$archive_name" || {
  echo "Error: Downloading $filename failed."
  exit 1
 }

 tar xvf "$archive_name" || {
  echo "Error: Extracting $filename failed."
  exit 1
 }

 rm -f "$archive_name" || {
  echo "Warning: Failed to remove $archive_name (not critical)."
 }
}
#################### FUNCTIONS #######################

# Script to download and install the latest x64 Linux version of custom ffmpeg build for yt-dlp

# Ensure the script's execution directory is writable
if [[ ! -w $(pwd) ]]; then
 echo "Error: This script needs write permissions in the current directory."
 exit 1
fi

############################# WGET #############################
if ! command -v wget &> /dev/null; then
 echo "The 'wget' command is not found. Trying to install..."

 # Install `wget` using the appropriate package manager
 case "$(cat /etc/os-release | grep "^ID=" | cut -d '=' -f 2 | tr -d '"')" in
  fedora | centos | rhel)
   echo "Trying to install 'wget' for Fedora/CentOS/RHEL..."
   sudo dnf install wget -y || {
    echo "Error: Installing 'wget' failed. Please install it manually."
    exit 1
   }
   ;;
  arch | endeavouros | manjaro)
   echo "Trying to install 'wget' for Arch..."
   sudo pacman -S wget -y || {
    echo "Error: Installing 'wget' failed. Please install it manually."
    exit 1
   }
   ;;
  ubuntu | debian | linuxmint)
   echo "Trying to install 'wget' for Ubuntu/Debian..."
   sudo apt install wget -y || {
    echo "Error: Installing 'wget' failed. Please install it manually."
    exit 1
   }
   ;;
  *)
   echo "Warning: Automatic installation of 'wget' on other distributions is not supported. Please install it manually."
   ;;
 esac
fi
############################# wget #############################

############################# libxcrypt-compat #############################
if ! command -v libxcrypt-compat &> /dev/null; then
 echo "The 'libxcrypt-compat' command is not found. Trying to install..."

 # Install `libxcrypt-compat` using the appropriate package manager
 case "$(cat /etc/os-release | grep "^ID=" | cut -d '=' -f 2 | tr -d '"')" in
  fedora | centos | rhel)
   echo "Trying to install 'libxcrypt-compat' for Fedora/CentOS/RHEL..."
   sudo dnf install libxcrypt-compat -y || {
    echo "Error: Installing 'libxcrypt-compat' failed. Please install it manually."
    exit 1
   }
   ;;
  ##Hint: We don't need to install the package for ubuntu based systems, because it's not needed.
  arch | endeavouros | manjaro)
   echo "Trying to install 'libxcrypt-compat' for Arch..."
   sudo pacman -S libxcrypt-compat -y || {
    echo "Error: Installing 'libxcrypt-compat' failed. Please install it manually."
    exit 1
   }
   ;;
  *)
   echo "Warning: Automatic installation of 'libxcrypt-compat' on other distributions is not supported. Please install it manually."
   ;;
 esac
fi
############################# libxcrypt-compat #############################

############################# rpm #############################
if ! command -v rpm &> /dev/null; then
 echo "The 'rpm' command is not found. Trying to install..."

 # Install `rpm` using the appropriate package manager
 case "$(cat /etc/os-release | grep "^ID=" | cut -d '=' -f 2 | tr -d '"')" in
  arch | endeavouros | manjaro)
   echo "Trying to install 'rpm' for Arch..."
   sudo pacman -S rpm -y || {
    echo "Error: Installing 'rpm' failed. Please install it manually."
    exit 1
   }
   ;;
  ubuntu | debian | linuxmint)
   echo "Trying to install 'rpm' for Ubuntu/Debian..."
   sudo apt install rpm -y || {
    echo "Error: Installing 'rpm' failed. Please install it manually."
    exit 1
   }
   ;;
  *)
   echo "Warning: Automatic installation of 'rpm' on other distributions is not supported. Please install it manually."
   ;;
 esac
fi
############################# rpm #############################

# Download and extract FFMPEG
rm ffmpeg*
wget "https://github.com/yt-dlp/FFmpeg-Builds/releases/download/autobuild-2024-02-22-14-09/ffmpeg-N-113784-g4ea2b271eb-linux64-gpl.tar.xz"
tar xvf ffmpeg-N-113784-g4ea2b271eb-linux64-gpl.tar.xz
cp ffmpeg-N-113784-g4ea2b271eb-linux64-gpl/bin/ffmpeg ffmpeg
chmod +x ffmpeg
rm -rf ffmpeg-N-113784-g4ea2b271eb-linux64-gpl
rm ffmpeg-N-113784-g4ea2b271eb-linux64-gpl.tar.xz
