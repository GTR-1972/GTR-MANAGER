#!/bin/bash

# GTR Manager - Systemd Service Setup
# This script installs GTR Manager as a systemd service

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}==============================================${NC}"
echo -e "${BLUE}   GTR Manager Systemd Service Installation   ${NC}"
echo -e "${BLUE}==============================================${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run as root${NC}"
  echo -e "${YELLOW}Use: sudo $0${NC}"
  exit 1
fi

# Create service file
SERVICE_PATH="/etc/systemd/system/gtr-manager.service"
echo -e "\n${BLUE}Creating systemd service file...${NC}"

cat > $SERVICE_PATH << EOL
[Unit]
Description=GTR Manager Service
After=network.target

[Service]
Type=forking
User=root
ExecStart=/usr/bin/env node /usr/local/bin/gtr resurrect
Restart=on-failure
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=gtr-manager

[Install]
WantedBy=multi-user.target
EOL

# Set permissions
chmod 644 $SERVICE_PATH

# Reload systemd
echo -e "${BLUE}Reloading systemd daemon...${NC}"
systemctl daemon-reload

# Enable the service
echo -e "${BLUE}Enabling GTR Manager service...${NC}"
systemctl enable gtr-manager.service

echo -e "\n${GREEN}✓ GTR Manager service has been set up!${NC}"
echo -e "${YELLOW}You can now use the following commands:${NC}"
echo -e "  ${GREEN}sudo systemctl start gtr-manager${NC} - Start the service"
echo -e "  ${GREEN}sudo systemctl stop gtr-manager${NC} - Stop the service"
echo -e "  ${GREEN}sudo systemctl status gtr-manager${NC} - Check service status"
echo -e "  ${GREEN}sudo systemctl restart gtr-manager${NC} - Restart the service"

echo -e "\n${BLUE}NOTE: Make sure to run 'gtr save' to save your current processes${NC}"
echo -e "${BLUE}      before starting the service, so they can be resurrected.${NC}"

echo -e "\n${BLUE}==============================================${NC}"