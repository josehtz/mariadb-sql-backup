const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const schedule = require("node-schedule");
const archiver = require("archiver");
const axios = require("axios");
const FormData = require("form-data");

const config = {
  database: {
    user: "usernamme",
    password: "password",
    name: "database name",
    dumpPath: "C:\\Program Files\\MariaDB 11.6\\bin\\mysqldump.exe" // Maria db mysqldump.exe path maybe may work with other database managers
  },
  backup: {
    directory: "backup/",  
    retentionDays: 4
  },
  discord: {
    webhookUrl: "YOUR-DISCORD-WEBHOOK", // Yours discord webhook
    botName: "josehtz backup database"
  },
  schedule: "0 */3 * * *"
};
class DatabaseBackupSystem {
  constructor(config) {
    this.config = config;
    this.validateConfig();
    this.initBackupDir();
  }

  validateConfig() {
    const required = [
      'database.user', 'database.password', 'database.name', 'database.dumpPath',
      'backup.directory', 'backup.retentionDays', 'discord.webhookUrl', 
      'discord.botName', 'schedule'
    ];
    
    const missing = required.filter(field => {
      const keys = field.split('.');
      return !keys.reduce((obj, key) => obj?.[key], this.config);
    });

    if (missing.length) {
      console.error("ERROR: Missing required configuration fields:");
      missing.forEach(field => console.error(`  - ${field}`));
      console.error("\nPlease provide all required configuration values.");
      process.exit(1);
    }
  }

  initBackupDir() {
    if (!fs.existsSync(this.config.backup.directory)) {
      fs.mkdirSync(this.config.backup.directory, { recursive: true });
    }
  }

  async sendToDiscord(filePath, message = "") {
    try {
      const form = new FormData();
      const fileName = path.basename(filePath);
      const sizeMB = (fs.statSync(filePath).size / 1024 / 1024).toFixed(2);

      const embed = {
        title: "Database Backup Created",
        description: [
          `**Database:** \`${this.config.database.name}\``,
          `**File:** \`${fileName}\``,
          `**Size:** \`${sizeMB} MB\``,
          `**Date:** <t:${Math.floor(Date.now() / 1000)}:f>`
        ].join("\n"),
        color: 0x5865F2,
        footer: { text: "Automated Database Backup System" },
        author: { name: this.config.discord.botName },
        timestamp: new Date().toISOString()
      };

      form.append("file", fs.createReadStream(filePath), fileName);
      form.append("payload_json", JSON.stringify({
        content: message || null,
        embeds: [embed]
      }));

      await axios.post(this.config.discord.webhookUrl, form, {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      console.log(`SUCCESS: Backup sent to Discord - ${fileName}`);
    } catch (error) {
      console.error(`ERROR: Failed to send backup to Discord - ${error.response?.data || error.message}`);
    }
  }

  compressFile(sqlPath, zipPath) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(zipPath);
      const archive = archiver("zip", { zlib: { level: 9 } });

      output.on("close", resolve);
      archive.on("error", reject);
      archive.pipe(output);
      archive.file(sqlPath, { name: path.basename(sqlPath) });
      archive.finalize();
    });
  }

  async createBackup() {
    try {
      const timestamp = new Date().toISOString().replace(/[:]/g, "-").replace("T", "_").split(".")[0];
      const sqlPath = path.join(this.config.backup.directory, `${this.config.database.name}_${timestamp}.sql`);
      const zipPath = sqlPath.replace(".sql", ".zip");

      const { user, password, name, dumpPath } = this.config.database;
      const cmd = `"${dumpPath}" -u${user} -p${password} ${name} > "${sqlPath}"`;

      await new Promise((resolve, reject) => {
        exec(cmd, error => error ? reject(error) : resolve());
      });

      await this.compressFile(sqlPath, zipPath);
      fs.unlinkSync(sqlPath);
      await this.sendToDiscord(zipPath);
      
      console.log(`SUCCESS: Backup created and sent - ${path.basename(zipPath)}`);
    } catch (error) {
      console.error(`ERROR: Backup process failed - ${error.message}`);
    }
  }

  async cleanup() {
    try {
      const files = fs.readdirSync(this.config.backup.directory);
      const cutoffDate = new Date(Date.now() - this.config.backup.retentionDays * 24 * 60 * 60 * 1000);

      for (const file of files.filter(f => f.endsWith(".zip"))) {
        const filePath = path.join(this.config.backup.directory, file);
        
        if (fs.statSync(filePath).mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          console.log(`INFO: Deleted old backup - ${file}`);
          await this.sendToDiscord(filePath, "Old backup file deleted due to retention policy");
        }
      }
    } catch (error) {
      console.error(`ERROR: Cleanup process failed - ${error.message}`);
    }
  }

  async run() {
    console.log("INFO: Starting scheduled backup and cleanup tasks");
    await this.createBackup();
    await this.cleanup();
    console.log("INFO: Scheduled tasks completed");
  }

  start() {
    console.log("INFO: Database Backup System initialized");
    console.log("INFO: Scheduled to run every 3 hours");
    
    this.run();
    schedule.scheduleJob(this.config.schedule, () => this.run());
  }
}



new DatabaseBackupSystem(config).start();