# OpenVPN setup

## 1. Install OpenVPN

Run the `omarchy/init` script, which includes installing OpenVPN.

```sh
cd $HOME/dotfiles
./omarchy/init
```

## 2. Move VPN profile file to system

```sh
sudo mkdir /etc/openvpn/client
sudo cp <.ovpn file location> /etc/openvpn/client/<vpn-name>.conf
sudo chmod 600 /etc/openvpn/client/<vpn-name>.conf
```

### 3. Handle authentication

This steps assumes the VPN needs a username and password. Otherwise, skip.

Create a credentials file:

```sh
sudo nvim /etc/openvpn/client/<vpn-name>.auth
```

The contents should look like:

```txt
USERNAME
PASSWORD
```

Make the file accessible by openvpn:

```sh
sudo chown root:network /etc/openvpn/client/<vpn-name>.auth
sudo chmod 640 /etc/openvpn/client/<vpn-name>.auth
```

Change the `auth-user-pass` line in the `.conf` file to:

```txt
auth-user-pass /etc/openvpn/client/<vpn-name>.auth
```

## 4. Test connection

```sh
systemctl status openvpn-client@vpn-name
```

You'll want to see:

```txt
Active: active (running)
```

Test your IP:

```sh
curl ifconfig.me
```
