# GTR Manager

A process manager for GTR applications, similar to PM2 but specifically designed for GTR applications.

## Installation

### Quick Installation (recommended)

 # Install globally
1 -
```bash
npm install gtr
```

1 - Or 
```bash
git clone https://github.com/GTR-MANAGER-1972/GTR-MANAGER.git
```

2 -

```bash
npm install
```
3-

```bash
gtr help
```

### Starting an application

```bash
gtr start app.js
```

With options:

```bash
gtr start app.js --name my-app --instances 2 --env PORT=3000,NODE_ENV=production
```

### Managing applications

List all applications:

```bash
gtr list
```

Stop an application:

```bash
gtr stop <app_id or app_name>
```

Restart an application:

```bash
gtr restart <app_id or app_name>
```

Delete an application from the process list:

```bash
gtr delete <app_id or app_name>
```

### Viewing logs

View standard output logs:

```bash
gtr logs <app_id or app_name>
```

View error logs:

```bash
gtr logs <app_id or app_name> --error
```

Follow logs in real-time:

```bash
gtr logs <app_id or app_name> --follow
```

### Process monitoring

Monitor CPU and memory usage:

```bash
gtr monitor
```

### Save and restore

Save the current process list for later restoration:

```bash
gtr save
```

Restore previously saved processes:

```bash
gtr resurrect
```

## Configuration

GTR Manager stores its configuration in `~/.gtr-manager/` directory:

- Process list: `~/.gtr-manager/processes.json`
- Application logs: `~/.gtr-manager/<app-name>.log`
- Error logs: `~/.gtr-manager/<app-name>-error.log`
- Saved process list: `~/.gtr-manager/ecosystem.json`

## Features

- Process management (start, stop, restart, delete)
- Multiple instances support
- Process monitoring (CPU, memory, status)
- Log management
- Automatic restart on system boot (using the resurrect command)
- Environment variable configuration

## License

MIT
