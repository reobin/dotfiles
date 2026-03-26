VPN_DIR="/etc/openvpn/client"

_vpn_service() {
  printf "openvpn-client@%s.service" "$1"
}

_vpn_connect() {
  local name="$1"
  if [ -z "$name" ]; then
    echo "usage: vpn-connect <profile>"
    echo "example: vpn-connect poap-vpn-prod"
    return 1
  fi

  local active
  active=$(systemctl list-units --type=service --state=active --no-legend 2>/dev/null | awk '$1 ~ /openvpn-client@/ {print $1}')
  if [ -n "$active" ]; then
    echo "disconnecting ${active//openvpn-client@/}..."
    echo "$active" | xargs -r sudo systemctl stop
    sleep 0.5
  fi

  local service
  service=$(_vpn_service "$name")

  sudo systemctl start "$service"
  echo "connecting to $name..."
}

vpn-disconnect() {
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

_vpn_list() {
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

  sudo sh -c 'for f in /etc/openvpn/client/*.conf; do [ -e "$f" ] || exit 1; basename "$f" .conf; done' 2>/dev/null ||
    echo "no openvpn profiles found in /etc/openvpn/client"
}

vpn-connect() {
  if [ -n "$1" ]; then
    _vpn_connect "$1"
  else
    local selected
    selected=$(_vpn_list | fzf --height=5)
    if [ -n "$selected" ]; then
      _vpn_connect "$selected"
    fi
  fi
}
