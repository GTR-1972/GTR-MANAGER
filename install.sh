#!/bin/bash

# GTR Manager Installation Script
# This script installs GTR Manager globally

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}==============================================${NC}"
echo -e "${BLUE}        GTR Manager Installation Script       ${NC}"
echo -e "${BLUE}==============================================${NC}"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install Node.js first.${NC}"
    echo -e "${YELLOW}You can install Node.js from https://nodejs.org/${NC}"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm is not installed. Please install npm first.${NC}"
    exit 1
fi

# Display Node.js and npm versions
NODE_VERSION=$(node -v)
NPM_VERSION=$(npm -v)
echo -e "${GREEN}Node.js version: ${NODE_VERSION}${NC}"
echo -e "${GREEN}npm version: ${NPM_VERSION}${NC}"

echo -e "\n${BLUE}Installing GTR Manager globally...${NC}"

# Install GTR Manager
npm install -g gtr-manager

# Check if installation was successful
if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}GTR Manager installed successfully!${NC}"
    echo -e "${YELLOW}You can now use the 'gtr' command in your terminal.${NC}"
    echo -e "\n${BLUE}Example commands:${NC}"
    echo -e "${GREEN}gtr --help${NC} - Show help"
    echo -e "${GREEN}gtr start app.js${NC} - Start an application"
    echo -e "${GREEN}gtr list${NC} - List running applications"
    echo -e "${GREEN}gtr monitor${NC} - Monitor applications"
else
    echo -e "\n${RED}Installation failed. Please try again or install manually:${NC}"
    echo -e "${YELLOW}npm install -g gtr-manager${NC}"
fi

echo -e "\n${BLUE}==============================================${NC}"
