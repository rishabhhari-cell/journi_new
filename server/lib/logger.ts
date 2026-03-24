type LogLevel = "info" | "warn" | "error";

function write(level: LogLevel, message: string, metadata?: Record<string, unknown>) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(metadata ? { metadata } : {}),
  };
  const serialized = JSON.stringify(payload);
  if (level === "error") {
    console.error(serialized);
    return;
  }
  if (level === "warn") {
    console.warn(serialized);
    return;
  }
  console.log(serialized);
}

export const logger = {
  info(message: string, metadata?: Record<string, unknown>) {
    write("info", message, metadata);
  },
  warn(message: string, metadata?: Record<string, unknown>) {
    write("warn", message, metadata);
  },
  error(message: string, metadata?: Record<string, unknown>) {
    write("error", message, metadata);
  },
};

