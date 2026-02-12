VPN_DIR="/etc/openvpn/client"

_vpn_service() {
  printf "openvpn-client@%s.service" "$1"
}

_vpn_dns_hook() {
  printf "%s/%s-dns.sh" "$VPN_DIR" "$1"
}

_vpn_wait_tun0() {
  local i
  for i in {1..20}; do
    if ip link show tun0 >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.2
  done
}

vpn-start() {
  local name="$1"
  if [ -z "$name" ]; then
    echo "usage: vpn-start <profile>"
    echo "example: vpn-start poap-vpn-prod"
    return 1
  fi

  local service
  service=$(_vpn_service "$name")

  sudo systemctl start "$service"

  local hook
  hook=$(_vpn_dns_hook "$name")
  if sudo test -x "$hook"; then
    _vpn_wait_tun0
    sudo sh "$hook"
  fi
}

vpn-stop() {
  local name="$1"
  if [ -z "$name" ]; then
    local services
    services=$(systemctl list-units --type=service --state=active --no-legend 2>/dev/null | awk '$1 ~ /vpn/ {print $1}')
    if [ -z "$services" ]; then
      echo "no active vpn services"
      return 0
    fi
    echo "$services" | xargs -r sudo systemctl stop
    return 0
  fi

  local service
  service=$(_vpn_service "$name")

  sudo systemctl stop "$service"
}

vpn-list() {
  local files
  files=($VPN_DIR/*.conf(N))
  if [ ${#files[@]} -gt 0 ]; then
    for file in "${files[@]}"; do
      local name="${file:t}"
      echo "${name%.conf}"
    done
    return 0
  fi

  sudo sh -c 'for f in /etc/openvpn/client/*.conf; do [ -e "$f" ] || exit 1; basename "$f" .conf; done' 2>/dev/null || \
    echo "no openvpn profiles found in /etc/openvpn/client"
}
