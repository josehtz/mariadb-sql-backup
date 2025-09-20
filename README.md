# MariaDB Discord Backup System

This script automates periodic backups of a MariaDB database, compresses them into `.zip` files, sends them to a Discord channel via webhook, and deletes old backups based on a retention policy.

---

## Features

- Scheduled MariaDB backups (default: every 3 hours)
- `.sql` dump files compressed into `.zip`
- Sends backups to Discord via webhook
- Automatically deletes old backups based on configured retention days
- Fully configurable via a single `config` object

---

## Prerequisites

- **MariaDB** installed with access to `mysqldump`
- **Bun v1.2.21** or higher installed → [Install Bun](https://bun.sh/docs/installation)
- Discord webhook URL (for receiving backups)

---

## Setup

1. Clone or download this repository.

2. Install dependencies using Bun:

```bash
npm install
```

3. Configure your backup settings by editing the config object at the top of index.js. Here's an example:
```js
const config = {
  database: {
    user: "root",
    password: "root",
    name: "your_database_name",
    dumpPath: "C:\\Program Files\\MariaDB 11.6\\bin\\mysqldump.exe" // Adjust this path
  },
  backup: {
    directory: "backup/",
    retentionDays: 4 // Number of days to keep old backups
  },
  discord: {
    webhookUrl: "https://discord.com/api/webhooks/your_webhook_here",
    botName: "MariaDB Backup Bot"
  },
  schedule: "0 */3 * * *" // Cron syntax: runs every 3 hours
};
```

- Make sure the dumpPath points to your actual mysqldump.exe location, and that your webhook URL is correct.

---
## Running the Backup Script

Start the script using Bun:

```bash
npm start
```

This will:

Immediately create a backup

Continue running scheduled backups every 3 hours (or based on your cron expression)