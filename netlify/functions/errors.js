// netlify/functions/errors.js
export class RunLockError extends Error {
  constructor(message = 'Another run is in progress') {
    super(message);
    this.name = 'RunLockError';
  }
}
