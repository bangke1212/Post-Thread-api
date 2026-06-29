"use strict";
// src/shutdown.ts — process shutdown helpers
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSignalExitCode = getSignalExitCode;
const os_1 = require("os");
const SIGNAL_EXIT_CODE_OFFSET = 128;
function getSignalExitCode(signal) {
    const signalNumbers = os_1.constants.signals;
    const signalNumber = signalNumbers[signal];
    return signalNumber ? SIGNAL_EXIT_CODE_OFFSET + signalNumber : 1;
}
