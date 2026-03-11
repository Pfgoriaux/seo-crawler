import chalk from 'chalk';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

let currentLogLevel = LogLevel.INFO;

export function setLogLevel(level: LogLevel): void {
  currentLogLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLogLevel;
}

const timestamp = (): string => {
  return new Date().toISOString().substring(11, 19);
};

export const logger = {
  debug: (message: string, ...args: unknown[]): void => {
    if (currentLogLevel <= LogLevel.DEBUG) {
      console.log(chalk.gray(`[${timestamp()}] DEBUG:`), message, ...args);
    }
  },

  info: (message: string, ...args: unknown[]): void => {
    if (currentLogLevel <= LogLevel.INFO) {
      console.log(chalk.blue(`[${timestamp()}]`), message, ...args);
    }
  },

  success: (message: string, ...args: unknown[]): void => {
    if (currentLogLevel <= LogLevel.INFO) {
      console.log(chalk.green(`[${timestamp()}] ✓`), message, ...args);
    }
  },

  warn: (message: string, ...args: unknown[]): void => {
    if (currentLogLevel <= LogLevel.WARN) {
      console.log(chalk.yellow(`[${timestamp()}] ⚠`), message, ...args);
    }
  },

  error: (message: string, ...args: unknown[]): void => {
    if (currentLogLevel <= LogLevel.ERROR) {
      console.error(chalk.red(`[${timestamp()}] ✗`), message, ...args);
    }
  },

  progress: (current: number, total: number, message: string): void => {
    if (currentLogLevel <= LogLevel.INFO) {
      const percentage = Math.round((current / total) * 100);
      const bar = createProgressBar(percentage);
      process.stdout.write(
        `\r${chalk.blue(`[${timestamp()}]`)} ${bar} ${percentage}% ${message}`
      );
      if (current === total) {
        process.stdout.write('\n');
      }
    }
  },

  newLine: (): void => {
    if (currentLogLevel <= LogLevel.INFO) {
      console.log();
    }
  },

  divider: (): void => {
    if (currentLogLevel <= LogLevel.INFO) {
      console.log(chalk.gray('─'.repeat(60)));
    }
  },

  header: (title: string): void => {
    if (currentLogLevel <= LogLevel.INFO) {
      console.log();
      console.log(chalk.bold.cyan(`  ${title}`));
      console.log(chalk.gray('─'.repeat(60)));
    }
  },

  table: (data: Record<string, string | number>[]): void => {
    if (currentLogLevel <= LogLevel.INFO) {
      console.table(data);
    }
  },
};

function createProgressBar(percentage: number): string {
  const width = 20;
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
}

export default logger;
