/**
 * Parse exact monitoring commands before the broader slash-command handlers.
 * Keeping this small and pure prevents `/fleet view` from being interpreted as
 * a request to spawn a fleet with the prompt "view".
 */
export function parseMonitoringCommand(input) {
    const command = String(input ?? '').trim().replace(/\s+/g, ' ');
    if (command === '/meter') return 'meter';
    if (command === '/fleet view') return 'fleet-view';
    return null;
}
