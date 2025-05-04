#!/usr/bin/env node

/**
 * GTR Manager - Process Manager for GTR Applications
 * Similar to PM2 but specialized for GTR applications
 */

const { program } = require('commander');
const { spawn, exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const chalk = require('chalk');
const Table = require('cli-table3');

// Config directory
const GTR_HOME = path.join(os.homedir(), '.gtr-manager');
const PROCESS_FILE = path.join(GTR_HOME, 'processes.json');
const LOG_DIR = path.join(GTR_HOME, 'logs');

// Ensure GTR_HOME and LOG_DIR directory exists
if (!fs.existsSync(GTR_HOME)) {
  fs.mkdirSync(GTR_HOME, { recursive: true });
}

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Initialize empty processes file if it doesn't exist
if (!fs.existsSync(PROCESS_FILE)) {
  fs.writeFileSync(PROCESS_FILE, JSON.stringify([], null, 2));
}

// Helper function to read processes
const readProcesses = () => {
  try {
    return JSON.parse(fs.readFileSync(PROCESS_FILE, 'utf8'));
  } catch (error) {
    console.error(chalk.red(`Error reading process file: ${error.message}`));
    return [];
  }
};

// Helper function to write processes
const writeProcesses = (processes) => {
  try {
    fs.writeFileSync(PROCESS_FILE, JSON.stringify(processes, null, 2));
    return true;
  } catch (error) {
    console.error(chalk.red(`Error writing process file: ${error.message}`));
    return false;
  }
};

// Helper function to generate a unique numeric ID
const generateId = () => {
  const processes = readProcesses();
  const existingIds = new Set(processes.map(p => p.id));
  
  let id = 0;
  while (existingIds.has(id)) {
    id++;
  }
  
  return id;
};

// Helper function to find a process by ID, name, or PID
const findProcess = (identifier) => {
  const processes = readProcesses();
  
  // Try to parse as integer in case it's a PID or ID
  const num = parseInt(identifier, 10);
  
  return processes.find(p => 
    p.id === num || 
    p.name === identifier || 
    (!isNaN(num) && p.pid === num)
  );
};

// Start a GTR application
const startGTR = (name, script, options, existingId = null) => {
  // Check if script exists
  if (!fs.existsSync(script)) {
    console.error(chalk.red(`GTR Manager: Script ${script} does not exist`));
    return null;
  }

  // Check if there's already a process with the same name
  const existingProcesses = readProcesses();
  if (existingProcesses.some(p => p.name === name && p.status === 'online')) {
    console.error(chalk.yellow(`GTR Manager: Process ${name} is already running. Use restart instead.`));
    return null;
  }

  // Create log paths
  const logFile = path.join(LOG_DIR, `${name}.log`);
  const errorLogFile = path.join(LOG_DIR, `${name}-error.log`);
  
  const stdout = fs.openSync(logFile, 'a');
  const stderr = fs.openSync(errorLogFile, 'a');
  
  try {
    const env = { ...process.env, ...options.env };
    const child = spawn('node', [script], {
      detached: true,
      stdio: ['ignore', stdout, stderr],
      env
    });

    // Detach the child process
    child.unref();
    
    // Save process info
    const pid = child.pid;
    const processes = readProcesses();
    const id = existingId !== null ? existingId : generateId();
    
    const processInfo = {
      id,
      name,
      pid,
      script: path.resolve(script),
      logFile,
      errorLogFile,
      status: 'online',
      instances: parseInt(options.instances, 10) || 1,
      restarts: existingId !== null ? (options.restarts || 0) + 1 : 0,
      memory: 0,
      cpu: 0,
      env: options.env || {},
      createdAt: existingId !== null ? options.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    processes.push(processInfo);
    
    writeProcesses(processes);
    
    console.log(chalk.green(`GTR Manager: Process ${name} (id: ${id}, pid: ${pid}) started successfully`));
    return id;
  } catch (error) {
    console.error(chalk.red(`GTR Manager: Error starting process ${name}: ${error.message}`));
    return null;
  }
};

// Stop a GTR application
const stopGTR = (identifier) => {
  const processes = readProcesses();
  const process = findProcess(identifier);
  
  if (!process) {
    console.log(chalk.red(`GTR Manager: Process ${identifier} not found`));
    return false;
  }
  
  try {
    process.status = 'stopping';
    process.updatedAt = new Date().toISOString();
    writeProcesses(processes);
    
    if (process.pid) {
      exec(`kill ${process.pid}`, (error) => {
        if (error) {
          console.error(chalk.yellow(`GTR Manager: Error stopping process ${process.name} gracefully, trying SIGKILL...`));
          exec(`kill -9 ${process.pid}`, (error) => {
            if (error) {
              console.error(chalk.red(`GTR Manager: Error force killing process ${process.name}: ${error.message}`));
            } else {
              const updatedProcesses = readProcesses();
              const processIndex = updatedProcesses.findIndex(p => p.id === process.id);
              if (processIndex !== -1) {
                updatedProcesses[processIndex].status = 'stopped';
                updatedProcesses[processIndex].updatedAt = new Date().toISOString();
                writeProcesses(updatedProcesses);
              }
            }
          });
        } else {
          const updatedProcesses = readProcesses();
          const processIndex = updatedProcesses.findIndex(p => p.id === process.id);
          if (processIndex !== -1) {
            updatedProcesses[processIndex].status = 'stopped';
            updatedProcesses[processIndex].updatedAt = new Date().toISOString();
            writeProcesses(updatedProcesses);
          }
          console.log(chalk.yellow(`GTR Manager: Process ${process.name} (id: ${process.id}, pid: ${process.pid}) stopped`));
        }
      });
    } else {
      process.status = 'stopped';
      writeProcesses(processes);
      console.log(chalk.yellow(`GTR Manager: Process ${process.name} marked as stopped (no active PID)`));
    }
    
    return true;
  } catch (error) {
    console.error(chalk.red(`GTR Manager: Error stopping process ${process.name}: ${error.message}`));
    return false;
  }
};

// Check if a process is running by PID
const isProcessRunning = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
};

// Helper function to safely execute commands with error handling
const safeExec = (command, callback) => {
  try {
    return exec(command, callback);
  } catch (error) {
    callback(error, null);
    return null;
  }
};

// Monitor all processes
const monitorProcesses = () => {
  const processes = readProcesses();
  let updated = false;
  
  for (const process of processes) {
    if (process.status === 'online' || process.status === 'stopping') {
      try {
        safeExec(`ps -p ${process.pid} -o pid=`, (error, stdout) => {
          if (error || !stdout.trim()) {
            if (process.status !== 'stopped') {
              process.status = 'stopped';
              process.updatedAt = new Date().toISOString();
              updated = true;
            }
          } else if (process.status === 'stopping') {
            const stoppingDuration = new Date() - new Date(process.updatedAt);
            if (stoppingDuration > 30000) {
              exec(`kill -9 ${process.pid}`, () => {
                process.status = 'stopped';
                process.updatedAt = new Date().toISOString();
                updated = true;
              });
            }
          } else {
            safeExec(`ps -p ${process.pid} -o %cpu,%mem`, (error, stdout) => {
              if (!error && stdout) {
                const lines = stdout.trim().split('\n');
                if (lines.length > 1) {
                  const [cpu, mem] = lines[1].trim().split(/\s+/);
                  process.cpu = parseFloat(cpu);
                  process.memory = parseFloat(mem);
                  process.updatedAt = new Date().toISOString();
                  updated = true;
                }
              }
            });
          }
        });
      } catch (error) {
        process.status = 'stopped';
        process.updatedAt = new Date().toISOString();
        updated = true;
      }
    }
  }
  
  if (updated) {
    writeProcesses(processes);
  }
};

// Helper function to format uptime
const formatUptime = (ms) => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
};

// Helper function to color status
const getStatusWithColor = (status) => {
  switch (status) {
    case 'online':
      return chalk.green(status);
    case 'stopping':
      return chalk.yellow(status);
    case 'stopped':
      return chalk.red(status);
    default:
      return status;
  }
};

// Command line interface setup
program
  .version('1.0.0')
  .description('GTR Manager - Process Manager for GTR Applications');

// Start command
program
  .command('start <script>')
  .description('Start a GTR application')
  .option('-n, --name <name>', 'Application name')
  .option('-i, --instances <number>', 'Number of instances to start', '1')
  .option('-e, --env <items>', 'Environment variables (comma-separated key=value)', (val) => {
    return val.split(',').reduce((env, item) => {
      const [key, value] = item.split('=');
      if (key && value !== undefined) {
        env[key.trim()] = value.trim();
      }
      return env;
    }, {});
  }, {})
  .action((script, options) => {
    try {
      const name = options.name || path.basename(script, path.extname(script));
      startGTR(name, script, options);
    } catch (error) {
      console.error(chalk.red(`GTR Manager: Error starting application: ${error.message}`));
    }
  });

// Stop command
program
  .command('stop <identifier>')
  .description('Stop a GTR application by ID, PID, or name')
  .action((identifier) => {
    try {
      stopGTR(identifier);
    } catch (error) {
      console.error(chalk.red(`GTR Manager: Error stopping application: ${error.message}`));
    }
  });

// Restart command
program
  .command('restart <identifier>')
  .description('Restart a GTR application by ID, PID, or name')
  .action((identifier) => {
    try {
      const process = findProcess(identifier);
      
      if (!process) {
        console.log(chalk.red(`GTR Manager: Process ${identifier} not found`));
        return;
      }
      
      console.log(chalk.yellow(`GTR Manager: Restarting ${process.name}...`));
      
      stopGTR(process.id);
      
      setTimeout(() => {
        const updatedProcesses = readProcesses();
        const updatedProcess = updatedProcesses.find(p => p.id === process.id);
        
        if (!updatedProcess) {
          console.error(chalk.red(`GTR Manager: Process info for ${process.name} was lost during restart`));
          return;
        }
        
        const processIndex = updatedProcesses.findIndex(p => p.id === process.id);
        if (processIndex !== -1) {
          updatedProcesses.splice(processIndex, 1);
          writeProcesses(updatedProcesses);
        }
        
        startGTR(
          process.name, 
          process.script, 
          { 
            instances: process.instances,
            env: process.env || {},
            restarts: process.restarts,
            createdAt: process.createdAt
          },
          process.id
        );
      }, 2000);
    } catch (error) {
      console.error(chalk.red(`GTR Manager: Error restarting application: ${error.message}`));
    }
  });

// Delete command
program
  .command('delete <identifier>')
  .description('Delete a GTR application by ID, PID, or name from the process list')
  .option('--no-stop', 'Skip stopping the process before deletion')
  .action((identifier, options) => {
    try {
      const processes = readProcesses();
      const process = findProcess(identifier);
      
      if (!process) {
        console.log(chalk.red(`GTR Manager: Process ${identifier} not found`));
        return;
      }
      
      if (options.stop && process.status === 'online') {
        stopGTR(process.id);
        console.log(chalk.yellow(`GTR Manager: Waiting for process ${process.name} to stop...`));
        setTimeout(() => {
          const updatedProcesses = readProcesses();
          const processIndex = updatedProcesses.findIndex(p => p.id === process.id);
          if (processIndex !== -1) {
            updatedProcesses.splice(processIndex, 1);
            writeProcesses(updatedProcesses);
            console.log(chalk.yellow(`GTR Manager: Process ${process.name} (id: ${process.id}) deleted from process list`));
          }
        }, 1000);
      } else {
        const processIndex = processes.findIndex(p => p.id === process.id);
        processes.splice(processIndex, 1);
        writeProcesses(processes);
        console.log(chalk.yellow(`GTR Manager: Process ${process.name} (id: ${process.id}) deleted from process list`));
      }
    } catch (error) {
      console.error(chalk.red(`GTR Manager: Error deleting application: ${error.message}`));
    }
  });

// List command
program
  .command('list')
  .description('List all GTR applications')
  .action(() => {
    try {
      const processes = readProcesses();
      
      if (processes.length === 0) {
        console.log(chalk.yellow('No GTR applications registered'));
        return;
      }
      
      monitorProcesses();
      
      setTimeout(() => {
        const updatedProcesses = readProcesses();
        
        const table = new Table({
          head: ['ID', 'Name', 'PID', 'Status', 'CPU', 'Memory', 'Restarts', 'Uptime'],
          style: { head: ['cyan'] }
        });
        
        updatedProcesses.forEach(process => {
          let uptime = '0s';
          if (process.status === 'online') {
            uptime = formatUptime(new Date() - new Date(process.createdAt));
          }
          
          table.push([
            process.id,
            process.name,
            process.pid || 'N/A',
            getStatusWithColor(process.status),
            `${process.cpu.toFixed(1)}%`,
            `${process.memory.toFixed(1)}%`,
            process.restarts,
            uptime
          ]);
        });
        
        console.log(table.toString());
      }, 500);
    } catch (error) {
      console.error(chalk.red(`GTR Manager: Error listing applications: ${error.message}`));
    }
  });

// Show command
program
  .command('show <identifier>')
  .description('Show detailed information about a GTR application')
  .action((identifier) => {
    try {
      const process = findProcess(identifier);
      
      if (!process) {
        console.log(chalk.red(`GTR Manager: Process ${identifier} not found`));
        return;
      }
      
      console.log(chalk.cyan(`=== Process Details for ${process.name} ===`));
      console.log(chalk.white(`ID: ${process.id}`));
      console.log(chalk.white(`Name: ${process.name}`));
      console.log(chalk.white(`PID: ${process.pid || 'N/A'}`));
      console.log(chalk.white(`Status: ${getStatusWithColor(process.status)}`));
      console.log(chalk.white(`Script: ${process.script}`));
      console.log(chalk.white(`Instances: ${process.instances}`));
      console.log(chalk.white(`CPU: ${process.cpu.toFixed(1)}%`));
      console.log(chalk.white(`Memory: ${process.memory.toFixed(1)}%`));
      console.log(chalk.white(`Restarts: ${process.restarts}`));
      
      if (process.status === 'online') {
        console.log(chalk.white(`Uptime: ${formatUptime(new Date() - new Date(process.createdAt))}`));
      }
      
      console.log(chalk.white(`Created: ${new Date(process.createdAt).toLocaleString()}`));
      console.log(chalk.white(`Updated: ${new Date(process.updatedAt).toLocaleString()}`));
      
      console.log(chalk.white(`Log file: ${process.logFile}`));
      console.log(chalk.white(`Error log file: ${process.errorLogFile}`));
      
      if (Object.keys(process.env || {}).length > 0) {
        console.log(chalk.cyan(`Environment Variables:`));
        for (const [key, value] of Object.entries(process.env)) {
          console.log(chalk.white(`  ${key}: ${value}`));
        }
      }
    } catch (error) {
      console.error(chalk.red(`GTR Manager: Error showing application details: ${error.message}`));
    }
  });

// Logs command
program
  .command('logs <identifier>')
  .description('Display logs for a GTR application')
  .option('-e, --error', 'Display error logs')
  .option('-f, --follow', 'Follow logs')
  .option('-l, --lines <number>', 'Number of lines to display', '20')
  .option('-c, --clear', 'Clear logs before displaying')
  .action((identifier, options) => {
    try {
      const process = findProcess(identifier);
      
      if (!process) {
        console.log(chalk.red(`GTR Manager: Process ${identifier} not found`));
        return;
      }
      
      const logFile = options.error ? process.errorLogFile : process.logFile;
      
      if (!fs.existsSync(logFile)) {
        console.log(chalk.yellow(`No logs found for ${process.name}`));
        return;
      }

      if (options.clear) {
        fs.writeFileSync(logFile, '', 'utf8');
        console.log(chalk.green(`Logs cleared for ${process.name}`));
        if (!options.follow) {
          return;
        }
      }
      
      console.log(chalk.cyan(`=== ${options.error ? 'Error' : 'Output'} logs for ${process.name} (id: ${process.id}) ===`));
      
      const tailCommand = `tail ${options.follow ? '-f' : ''} -n ${options.lines} "${logFile}"`;
      
      const tail = spawn('sh', ['-c', tailCommand], { 
        stdio: 'inherit'
      });
      
      tail.on('error', (err) => {
        console.error(chalk.red(`GTR Manager: Error executing tail command: ${err.message}`));
      });
      
      if (!options.follow) {
        tail.on('close', (code) => {
          if (code !== 0) {
            console.error(chalk.red(`GTR Manager: Tail command exited with code ${code}`));
          }
        });
      } else {
        console.log(chalk.yellow('Following logs... Press Ctrl+C to exit'));
        
        process.on('SIGINT', () => {
          console.log(chalk.green('\nGTR Manager: Exiting logs view'));
          process.exit(0);
        });
      }
    } catch (error) {
      console.error(chalk.red(`GTR Manager: Error displaying logs: ${error.message}`));
    }
  });

// Monitor command
program
  .command('monitor')
  .description('Monitor GTR applications')
  .option('-i, --interval <seconds>', 'Update interval in seconds', '5')
  .action((options) => {
    try {
      const updateInterval = parseInt(options.interval, 10) * 1000;
      
      console.log(chalk.green(`GTR Manager: Monitoring GTR applications (refreshing every ${options.interval}s)`));
      console.log(chalk.yellow('Press Ctrl+C to exit'));
      
      const displayMonitorTable = () => {
        process.stdout.write('\x1Bc');
        
        console.log(chalk.green(`GTR Manager: Monitoring GTR applications (refreshing every ${options.interval}s)`));
        console.log(chalk.yellow('Press Ctrl+C to exit'));
        console.log(chalk.cyan(`Last update: ${new Date().toLocaleTimeString()}`));
        
        const processes = readProcesses();
        
        if (processes.length === 0) {
          console.log(chalk.yellow('No GTR applications registered'));
          return;
        }
        
        const table = new Table({
          head: ['ID', 'Name', 'PID', 'Status', 'CPU', 'Memory', 'Restarts', 'Uptime'],
          style: { head: ['cyan'] }
        });
        
        processes.forEach(process => {
          let uptime = '0s';
          if (process.status === 'online') {
            uptime = formatUptime(new Date() - new Date(process.createdAt));
          }
          
          table.push([
            process.id,
            process.name,
            process.pid || 'N/A',
            getStatusWithColor(process.status),
            `${process.cpu.toFixed(1)}%`,
            `${process.memory.toFixed(1)}%`,
            process.restarts,
            uptime
          ]);
        });
        
        console.log(table.toString());
      };
      
      monitorProcesses();
      displayMonitorTable();
      
      const monitorInterval = setInterval(() => {
        monitorProcesses();
        displayMonitorTable();
      }, updateInterval);
      
      process.on('SIGINT', () => {
        clearInterval(monitorInterval);
        console.log(chalk.green('\nGTR Manager: Exiting monitor mode'));
        process.exit(0);
      });
    } catch (error) {
      console.error(chalk.red(`GTR Manager: Error in monitoring: ${error.message}`));
    }
  });

// Save command
program
  .command('save')
  .description('Save the current process list for automatic restart')
  .action(() => {
    try {
      const processes = readProcesses();
      fs.writeFileSync(path.join(GTR_HOME, 'ecosystem.json'), JSON.stringify(processes, null, 2));
      console.log(chalk.green('GTR Manager: Process list saved for automatic restart'));
    } catch (error) {
      console.error(chalk.red(`GTR Manager: Error saving ecosystem: ${error.message}`));
    }
  });

// Resurrect command
program
  .command('resurrect')
  .description('Resurrect previously saved processes')
  .action(() => {
    try {
      const ecosystemFile = path.join(GTR_HOME, 'ecosystem.json');
      
      if (!fs.existsSync(ecosystemFile)) {
        console.log(chalk.yellow('No saved process list found'));
        return;
      }
      
      const processes = JSON.parse(fs.readFileSync(ecosystemFile, 'utf8'));
      
      if (processes.length === 0) {
        console.log(chalk.yellow('No processes in saved ecosystem'));
        return;
      }
      
      console.log(chalk.green(`GTR Manager: Resurrecting ${processes.length} processes`));
      
      processes.forEach(process => {
        if (fs.existsSync(process.script)) {
          console.log(chalk.green(`GTR Manager: Resurrecting ${process.name}`));
          startGTR(process.name, process.script, { 
            instances: process.instances,
            env: process.env || {}
          });
        } else {
          console.log(chalk.yellow(`GTR Manager: Cannot resurrect ${process.name}, script ${process.script} not found`));
        }
      });
    } catch (error) {
      console.error(chalk.red(`GTR Manager: Error resurrecting processes: ${error.message}`));
    }
  });

// Prune command
program
  .command('prune')
  .description('Remove all stopped processes from the list')
  .action(() => {
    try {
      const processes = readProcesses();
      const initialCount = processes.length;
      
      const activeProcesses = processes.filter(p => p.status === 'online');
      
      if (activeProcesses.length === initialCount) {
        console.log(chalk.yellow('No stopped processes to prune'));
        return;
      }
      
      writeProcesses(activeProcesses);
      console.log(chalk.green(`GTR Manager: Pruned ${initialCount - activeProcesses.length} stopped processes`));
    } catch (error) {
      console.error(chalk.red(`GTR Manager: Error pruning processes: ${error.message}`));
    }
  });

// Clear logs command
program
  .command('clearlogs [identifier]')
  .description('Clear logs for a specific or all processes')
  .option('-e, --error', 'Clear error logs')
  .option('-o, --output', 'Clear output logs')
  .option('-a, --all', 'Clear both error and output logs')
  .action((identifier, options) => {
    try {
      const processes = readProcesses();
      
      const clearError = options.all || options.error || (!options.output);
      const clearOutput = options.all || options.output || (!options.error);
      
      if (identifier) {
        const process = findProcess(identifier);
        
        if (!process) {
          console.log(chalk.red(`GTR Manager: Process ${identifier} not found`));
          return;
        }
        
        if (clearOutput && fs.existsSync(process.logFile)) {
          fs.writeFileSync(process.logFile, '', 'utf8');
          console.log(chalk.green(`Output logs cleared for ${process.name}`));
        }
        
        if (clearError && fs.existsSync(process.errorLogFile)) {
          fs.writeFileSync(process.errorLogFile, '', 'utf8');
          console.log(chalk.green(`Error logs cleared for ${process.name}`));
        }
      } else {
        let outputCleared = 0;
        let errorCleared = 0;
        
        processes.forEach(process => {
          if (clearOutput && fs.existsSync(process.logFile)) {
            fs.writeFileSync(process.logFile, '', 'utf8');
            outputCleared++;
          }
          
          if (clearError && fs.existsSync(process.errorLogFile)) {
            fs.writeFileSync(process.errorLogFile, '', 'utf8');
            errorCleared++;
          }
        });
        
        if (clearOutput) {
          console.log(chalk.green(`Output logs cleared for ${outputCleared} processes`));
        }
        
        if (clearError) {
          console.log(chalk.green(`Error logs cleared for ${errorCleared} processes`));
        }
      }
    } catch (error) {
      console.error(chalk.red(`GTR Manager: Error clearing logs: ${error.message}`));
    }
  });

// Parse command line arguments
program.parse(process.argv);

// If no arguments, display help
if (process.argv.length === 2) {
  program.help();
}