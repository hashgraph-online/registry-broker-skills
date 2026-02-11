import pc from 'picocolors';

const colors = pc.createColors(
  Boolean(process.stdout.isTTY) && !Boolean(process.env.NO_COLOR),
);

const originalConsoleError = console.error.bind(console);
const originalConsoleWarn = console.warn.bind(console);
const originalConsoleLog = console.log.bind(console);

let installed = false;

function colorizeConsolePrefix(value: unknown, kind: 'error' | 'warn') {
  if (typeof value !== 'string') return value;

  if (kind === 'error' && value.startsWith('Error:')) {
    return `${colors.bold(colors.red('Error:'))}${value.slice('Error:'.length)}`;
  }

  if (kind === 'warn' && value.startsWith('Warning:')) {
    return `${colors.bold(colors.yellow('Warning:'))}${value.slice(
      'Warning:'.length,
    )}`;
  }

  return value;
}

export function installConsoleStyling() {
  if (installed) return;
  installed = true;

  console.error = (...args: unknown[]) => {
    const [first, ...rest] = args;
    originalConsoleError(colorizeConsolePrefix(first, 'error'), ...rest);
  };

  console.warn = (...args: unknown[]) => {
    const [first, ...rest] = args;
    originalConsoleWarn(colorizeConsolePrefix(first, 'warn'), ...rest);
  };

  console.log = (...args: unknown[]) => {
    originalConsoleLog(...args);
  };
}

export const ui = {
  colors,
  ok: (value: string) => colors.green(value),
  info: (value: string) => colors.cyan(value),
  warn: (value: string) => colors.yellow(value),
  err: (value: string) => colors.red(value),
  bold: (value: string) => colors.bold(value),
  dim: (value: string) => colors.dim(value),
  code: (value: string) => colors.cyan(value),
};

