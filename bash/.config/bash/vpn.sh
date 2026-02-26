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
  local files=()
  local nullglob_was_set=0

  if shopt -q nullglob; then
    nullglob_was_set=1
  else
    shopt -s nullglob
  fi

  files=("$VPN_DIR"/*.conf)
  if [ ${#files[@]} -gt 0 ]; then
    local file
    for file in "${files[@]}"; do
      local name
      name=$(basename "$file")
      echo "${name%.conf}"
    done
    if [ $nullglob_was_set -eq 0 ]; then
      shopt -u nullglob
    fi
    return 0
  fi

  if [ $nullglob_was_set -eq 0 ]; then
    shopt -u nullglob
  fi

  sudo sh -c 'for f in /etc/openvpn/client/*.conf; do [ -e "$f" ] || exit 1; basename "$f" .conf; done' 2>/dev/null || \
    echo "no openvpn profiles found in /etc/openvpn/client"
}
