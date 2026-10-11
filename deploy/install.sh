#!/usr/bin/env bash
# Installs or updates Bunker 115 in an LXC container on Proxmox.
# Run on the Proxmox host as root, next to the bunkier-115.tar.gz package:
#   bash install.sh
# The first run creates the container and asks for its address (or pass IP=192.168.1.50/24 GW=192.168.1.1).
# Running it again finds the container (hostname "bunkier") and only updates the game.
#
# Options (environment variables):
#   CTID=...       container number; by default the existing "bunkier" container, or the next free number
#   IP=.../..  GW=...  address and gateway (router) for a new container; asked for when missing
#   BRIDGE, STORAGE  network bridge and disk storage for a new container (vmbr0, local-lvm)
#   PASSWORD=...   server password; without it the existing one is kept, or a new one is generated
#   NO_PASSWORD=1  run without a password (only for a server that is not reachable from the internet)
#   ENABLE_DC_FW=1 switch on the datacenter firewall if it was never configured (see the end of the script)
set -euo pipefail
# the container that already runs the game, else the next free number
CTID=${CTID:-$(pct list | awk '$NF == "bunkier" {print $1}' | head -1)}
CTID=${CTID:-$(pvesh get /cluster/nextid)}
BRIDGE=${BRIDGE:-vmbr0}
STORAGE=${STORAGE:-local-lvm}
PORT=8115
TARBALL=${TARBALL:-$(dirname "$0")/bunkier-115.tar.gz}

[ -f "$TARBALL" ] || { echo "Package not found: $TARBALL"; exit 1; }

if ! pct status "$CTID" >/dev/null 2>&1; then
  # a new container needs an address on the home network
  ask() { local v; if [ -t 0 ]; then read -rp "$1" v; echo "$v"; fi; }
  IP=${IP:-$(ask "IP address for the new container, with prefix (e.g. 192.168.1.50/24): ")}
  GW=${GW:-$(ask "Gateway (your router, e.g. 192.168.1.1): ")}
  case "$IP" in */*) ;; *) echo "Give the address with its prefix, e.g. IP=192.168.1.50/24 GW=192.168.1.1 bash install.sh"; exit 1;; esac
  [ -n "$GW" ] || { echo "Give the gateway, e.g. GW=192.168.1.1"; exit 1; }
  TEMPLATE=$(pveam list local | awk '/debian-13-standard/ {print $1}' | tail -1)
  if [ -z "$TEMPLATE" ]; then
    pveam update >/dev/null
    T=$(pveam available --section system | awk '/debian-13-standard/ {print $2}' | tail -1)
    pveam download local "$T"
    TEMPLATE="local:vztmpl/$T"
  fi
  echo "Creating CT $CTID ($IP) from $TEMPLATE"
  pct create "$CTID" "$TEMPLATE" --hostname bunkier --cores 1 --memory 512 --swap 256 \
    --rootfs "$STORAGE:4" --net0 "name=eth0,bridge=$BRIDGE,ip=$IP,gw=$GW,firewall=1" \
    --nameserver "$GW 1.1.1.1" --unprivileged 1 --features nesting=1 --onboot 1
else
  NET0=$(pct config "$CTID" | awk -F': ' '/^net0:/ {print $2}')
  # the gateway for the firewall rules comes from the container itself
  GW=${GW:-$(echo "$NET0" | tr ',' '\n' | awk -F= '$1 == "gw" {print $2}')}
  IP=$(echo "$NET0" | tr ',' '\n' | awk -F= '$1 == "ip" {print $2}')
  [ -n "$GW" ] || { echo "CT $CTID has no gateway in net0; pass GW=..."; exit 1; }
  case "$NET0" in
    *firewall=1*) ;;
    *) echo "Turning on the firewall for net0 of CT $CTID"; pct set "$CTID" --net0 "${NET0},firewall=1" ;;
  esac
fi

# --- Container firewall: the internet may reach the game port and nothing else;
# --- the container may reach the internet (updates) but not the home network.
mkdir -p /etc/pve/firewall
cat > "/etc/pve/firewall/$CTID.fw" <<EOF
[OPTIONS]
enable: 1
policy_in: DROP
policy_out: ACCEPT

[RULES]
IN ACCEPT -p tcp -dport $PORT # Bunker 115
OUT ACCEPT -dest $GW -p udp -dport 53 # DNS on the router
OUT ACCEPT -dest $GW -p tcp -dport 53 # DNS on the router
OUT DROP -dest 10.0.0.0/8 # no home network
OUT DROP -dest 172.16.0.0/12
OUT DROP -dest 192.168.0.0/16
OUT DROP -dest 100.64.0.0/10
EOF
echo "Firewall rules written to /etc/pve/firewall/$CTID.fw"

pct start "$CTID" 2>/dev/null || true
for i in $(seq 1 30); do pct exec "$CTID" -- getent hosts deb.debian.org >/dev/null 2>&1 && break; sleep 2; done

# --- Server password, kept in /etc/bunkier/env inside the container (root only).
NEW_PASSWORD=""
if [ "${NO_PASSWORD:-0}" = 1 ]; then
  ENVLINE=""
elif [ -n "${PASSWORD:-}" ]; then
  NEW_PASSWORD="$PASSWORD"
elif pct exec "$CTID" -- test -s /etc/bunkier/env 2>/dev/null; then
  ENVLINE=keep
else
  NEW_PASSWORD=$(head -c 512 /dev/urandom | LC_ALL=C tr -dc 'a-km-zA-HJ-NP-Z2-9' | cut -c1-12)
fi
if [ -n "$NEW_PASSWORD" ]; then
  case "$NEW_PASSWORD" in *[[:space:]\"\'\\\$]*) echo "The password may not contain spaces, quotes, \\ or \$"; exit 1;; esac
  ENVLINE="GAME_PASSWORD=$NEW_PASSWORD"
fi
if [ "${ENVLINE:-}" != keep ]; then
  TMP=$(mktemp); chmod 600 "$TMP"; printf '%s\n' "${ENVLINE:-}" > "$TMP"
  pct exec "$CTID" -- install -d -m 700 /etc/bunkier
  pct push "$CTID" "$TMP" /etc/bunkier/env --perms 600
  rm -f "$TMP"
fi

pct push "$CTID" "$TARBALL" /root/bunkier-115.tar.gz
pct exec "$CTID" -- bash -s <<'EOS'
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
NEED=""
command -v node >/dev/null || NEED="nodejs npm"
dpkg -s unattended-upgrades >/dev/null 2>&1 || NEED="$NEED unattended-upgrades"
if [ -n "$NEED" ]; then apt-get update -qq && apt-get install -y -qq $NEED >/dev/null; fi
# security updates every night, without asking
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
# a Node update only takes effect after a restart
cat > /etc/apt/apt.conf.d/99bunkier-restart <<'EOF'
DPkg::Post-Invoke { "if systemctl is-active -q bunkier; then systemctl try-restart bunkier || true; fi"; };
EOF
systemctl enable --now unattended-upgrades >/dev/null 2>&1 || true

id bunkier >/dev/null 2>&1 || useradd --system --home /nonexistent --shell /usr/sbin/nologin bunkier
rm -rf /opt/bunkier-115.new && mkdir -p /opt/bunkier-115.new
tar -xzf /root/bunkier-115.tar.gz -C /opt/bunkier-115.new
cd /opt/bunkier-115.new && npm ci --omit=dev --no-audit --no-fund --loglevel=error
rm -rf /opt/bunkier-115.old; [ -d /opt/bunkier-115 ] && mv /opt/bunkier-115 /opt/bunkier-115.old
mv /opt/bunkier-115.new /opt/bunkier-115
# the game files belong to root: the server process can read them but never change them
chown -R root:root /opt/bunkier-115 && chmod -R go-w,o+rX /opt/bunkier-115
[ -f /etc/bunkier/env ] && chown root:root /etc/bunkier/env && chmod 600 /etc/bunkier/env
cp /opt/bunkier-115/deploy/bunkier.service /etc/systemd/system/bunkier.service
systemctl daemon-reload
systemctl enable bunkier >/dev/null 2>&1
# 200, or 401 when a password is set: either way the server answers
check() { node -e "fetch('http://127.0.0.1:8115/health').then(r => { if (r.status !== 200 && r.status !== 401) throw new Error('HTTP ' + r.status); console.log('Server is up' + (r.status === 401 ? ' (password protected)' : ' (no password)')); }).catch(e => { console.error('Server is not responding:', e.message); process.exit(1); })"; }
systemctl restart bunkier; sleep 2
if ! check 2>/dev/null; then
  # some containers do not allow systemd's sandboxing; fall back to the basic protections
  echo "Starting with full sandboxing failed, retrying with fewer restrictions"
  mkdir -p /etc/systemd/system/bunkier.service.d
  cat > /etc/systemd/system/bunkier.service.d/lxc.conf <<'EOF'
[Service]
ProtectSystem=
ProtectHome=
PrivateTmp=
PrivateDevices=
ProtectKernelTunables=
ProtectKernelModules=
ProtectControlGroups=
EOF
  systemctl daemon-reload; systemctl restart bunkier; sleep 2
  check || { journalctl -u bunkier -n 30 --no-pager; exit 1; }
fi
EOS

echo
if [ -n "$NEW_PASSWORD" ]; then
  echo "Server password: $NEW_PASSWORD"
  echo "(stored in CT $CTID at /etc/bunkier/env; give it to your friends)"
elif [ "${ENVLINE:-}" = keep ]; then
  echo "Server password unchanged (see: pct exec $CTID -- cat /etc/bunkier/env)"
else
  echo "WARNING: the server runs WITHOUT a password."
fi

# --- The container rules above only work when the datacenter firewall is on.
if ! grep -qsE '^\s*enable:\s*1' /etc/pve/firewall/cluster.fw; then
  if [ "${ENABLE_DC_FW:-0}" = 1 ] && [ ! -s /etc/pve/firewall/cluster.fw ]; then
    # policy ACCEPT keeps the host and every other guest exactly as reachable as before
    printf '[OPTIONS]\nenable: 1\npolicy_in: ACCEPT\npolicy_out: ACCEPT\n' > /etc/pve/firewall/cluster.fw
    echo "Datacenter firewall switched on (policy ACCEPT: nothing else is blocked)."
  else
    echo
    echo "WARNING: the datacenter firewall is OFF, so the rules for CT $CTID do nothing yet."
    echo "Turn it on in Datacenter > Firewall > Options (set Input Policy to ACCEPT first),"
    echo "or run this script again with ENABLE_DC_FW=1."
  fi
fi
pve-firewall compile >/dev/null 2>&1 || true
echo "Done: http://${IP%/*}:$PORT/"
