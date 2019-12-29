#!/bin/sh

# ██╗    ██╗██╗███████╗██╗   ███████╗████████╗ █████╗ ████████╗██╗   ██╗███████╗
# ██║    ██║██║██╔════╝██║   ██╔════╝╚══██╔══╝██╔══██╗╚══██╔══╝██║   ██║██╔════╝
# ██║ █╗ ██║██║█████╗  ██║   ███████╗   ██║   ███████║   ██║   ██║   ██║███████╗
# ██║███╗██║██║██╔══╝  ██║   ╚════██║   ██║   ██╔══██║   ██║   ██║   ██║╚════██║
# ╚███╔███╔╝██║██║     ██║   ███████║   ██║   ██║  ██║   ██║   ╚██████╔╝███████║
#  ╚══╝╚══╝ ╚═╝╚═╝     ╚═╝   ╚══════╝   ╚═╝   ╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚══════

WIFI_NAME=`networksetup -getairportnetwork en0`

if [[ $WIFI_NAME =~ "Current Wi-Fi Network: " ]]
then
  WIFI_NAME=${WIFI_NAME#*: }
  PUBLIC_IP=`curl -s ifconfig.me`
  PRIVATE_IP=`ifconfig en0 inet | grep -o '\d\d*\.\d\d*\.\d\d*\.\d\d*' | head -1`

  echo "$WIFI_NAME\n$PUBLIC_IP\n$PRIVATE_IP"
else
  echo "No wifi\n\n"
fi
