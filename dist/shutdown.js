// src/shutdown.ts — process shutdown helpers
import { constants } from 'os';
const SIGNAL_EXIT_CODE_OFFSET = 128;
export function getSignalExitCode(signal) {
    const signalNumbers = constants.signals;
    const signalNumber = signalNumbers[signal];
    return signalNumber ? SIGNAL_EXIT_CODE_OFFSET + signalNumber : 1;
}
//# sourceMappingURL=shutdown.js.map