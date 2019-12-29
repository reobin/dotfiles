<?php

/*
  ██╗    ██╗██╗███████╗██╗    ███████╗████████╗ █████╗ ████████╗██╗   ██╗███████╗
  ██║    ██║██║██╔════╝██║    ██╔════╝╚══██╔══╝██╔══██╗╚══██╔══╝██║   ██║██╔════╝
  ██║ █╗ ██║██║█████╗  ██║    ███████╗   ██║   ███████║   ██║   ██║   ██║███████╗
  ██║███╗██║██║██╔══╝  ██║    ╚════██║   ██║   ██╔══██║   ██║   ██║   ██║╚════██║
  ╚███╔███╔╝██║██║     ██║    ███████║   ██║   ██║  ██║   ██║   ╚██████╔╝███████║
   ╚══╝╚══╝ ╚═╝╚═╝     ╚═╝    ╚══════╝   ╚═╝   ╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚══════
*/

error_reporting(0);

$ip = `curl -s ifconfig.me`;

$ip = trim($ip);

$output = `networksetup -getairportnetwork en0`;

$wifi = 'No wifi';
if (preg_match("/Current\sWi\-Fi\sNetwork\:\s(.*?)$/", $output, $matches) == true)
{
	$wifi = trim($matches[1]);
	
}

$output = `ifconfig en0 inet`;

$local = 'No local IP';
if (preg_match("/.*?inet\s(.*?)\snetmask.*?/", $output, $matches) == true)
{
	$local = trim($matches[1]);
	
}

echo "$wifi\n$ip\n$local";
