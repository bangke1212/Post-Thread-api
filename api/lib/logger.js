"use strict";
// src/logger.ts — minimal structured logger
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    critical: 4,
};
const minLevel = process.env['LOG_LEVEL'] ?? 'info';
function emit(level, message, meta) {
    if (LEVELS[level] < LEVELS[minLevel])
        return;
    const entry = {
        ts: new Date().toISOString(),
        level,
        message,
        ...meta,
    };
    const line = JSON.stringify(entry);
    if (level === 'error' || level === 'critical') {
        process.stderr.write(line + '\n');
    }
    else {
        process.stdout.write(line + '\n');
    }
}
exports.logger = {
    debug: (message, meta) => emit('debug', message, meta),
    info: (message, meta) => emit('info', message, meta),
    warn: (message, meta) => emit('warn', message, meta),
    error: (message, meta) => emit('error', message, meta),
    critical: (message, meta) => emit('critical', message, meta),
};
