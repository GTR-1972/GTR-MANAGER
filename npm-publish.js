#!/usr/bin/env node

/**
 * GTR Manager - NPM Publishing Script
 * This script helps publish the GTR Manager to npm
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Colors for console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m'
};

console.log(`${colors.blue}=== GTR Manager NPM Publisher ===${colors.reset}`);
console.log(`${colors.yellow}This script will help you publish GTR Manager to npm${colors.reset}\n`);

// Check if package.json exists
const packageJsonPath = path.join(__dirname, 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error(`${colors.red}Error: package.json not found${colors.reset}`);
  process.exit(1);
}

// Read package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
console.log(`Current package: ${colors.green}${packageJson.name}@${packageJson.version}${colors.reset}`);

// Verify npm login
console.log(`\n${colors.blue}Step 1: Verifying npm login${colors.reset}`);
exec('npm whoami', (error, stdout, stderr) => {
  if (error) {
    console.log(`${colors.yellow}You are not logged in to npm. Please log in:${colors.reset}`);
    const npmLogin = exec('npm login', { stdio: 'inherit' });
    
    npmLogin.on('exit', (code) => {
      if (code !== 0) {
        console.error(`${colors.red}npm login failed with code ${code}${colors.reset}`);
        process.exit(1);
      }
      promptForVersionBump();
    });
  } else {
    console.log(`${colors.green}Logged in as: ${stdout.trim()}${colors.reset}`);
    promptForVersionBump();
  }
});

// Prompt for version bump
function promptForVersionBump() {
  console.log(`\n${colors.blue}Step 2: Version management${colors.reset}`);
  console.log(`Current version: ${colors.green}${packageJson.version}${colors.reset}`);
  
  rl.question(`${colors.yellow}Do you want to bump the version? (yes/no) ${colors.reset}`, (answer) => {
    if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
      rl.question(`${colors.yellow}Select version bump type (patch/minor/major): ${colors.reset}`, (bumpType) => {
        if (['patch', 'minor', 'major'].includes(bumpType)) {
          exec(`npm version ${bumpType} --no-git-tag-version`, (error, stdout) => {
            if (error) {
              console.error(`${colors.red}Error bumping version: ${error}${colors.reset}`);
              process.exit(1);
            }
            
            const newVersion = stdout.trim();
            console.log(`${colors.green}Version bumped to: ${newVersion}${colors.reset}`);
            promptForPublish();
          });
        } else {
          console.log(`${colors.red}Invalid bump type. Using current version.${colors.reset}`);
          promptForPublish();
        }
      });
    } else {
      promptForPublish();
    }
  });
}

// Prompt for publishing
function promptForPublish() {
  console.log(`\n${colors.blue}Step 3: Publishing to npm${colors.reset}`);
  
  rl.question(`${colors.yellow}Are you ready to publish to npm? (yes/no) ${colors.reset}`, (answer) => {
    if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
      console.log(`${colors.blue}Publishing...${colors.reset}`);
      
      // Publish to npm
      const publish = exec('npm publish', { stdio: 'inherit' });
      
      publish.stdout?.pipe(process.stdout);
      publish.stderr?.pipe(process.stderr);
      
      publish.on('exit', (code) => {
        if (code === 0) {
          console.log(`\n${colors.green}Successfully published to npm!${colors.reset}`);
          console.log(`${colors.green}Users can now install your package with: npm install -g gtr-manager${colors.reset}`);
        } else {
          console.error(`\n${colors.red}Publishing failed with code ${code}${colors.reset}`);
        }
        rl.close();
      });
    } else {
      console.log(`${colors.yellow}Publishing cancelled${colors.reset}`);
      rl.close();
    }
  });
}