/**
 * Soupz Usage Instrumentation
 * 
 * This module tracks first-run friction points and core user interactions.
 * In production-market-ready state, these events would be synced to an analytics 
 * service (e.g., PostHog or Mixpanel). For now, we store them in localStorage
 * for local auditing and feedback.
 */

const INSTRUMENTATION_KEY = 'soupz_telemetry_events';
const SESSION_ID = Math.random().toString(36).slice(2, 11);

export function trackEvent(name, properties = {}) {
  try {
    const event = {
      name,
      properties,
      timestamp: new Date().toISOString(),
      sessionId: SESSION_ID,
      url: window.location.pathname,
    };

    // Log to console in development
    if (import.meta.env.DEV) {
      console.log(`[Telemetry] ${name}`, properties);
    }

    const events = JSON.parse(localStorage.getItem(INSTRUMENTATION_KEY) || '[]');
    events.push(event);
    
    // Keep only the last 100 events to avoid bloating localStorage
    const trimmed = events.slice(-100);
    localStorage.setItem(INSTRUMENTATION_KEY, JSON.stringify(trimmed));
  } catch (err) {
    // Silent fail for telemetry
  }
}

/**
 * Common friction points to track:
 * - setup_wizard_started
 * - setup_wizard_completed
 * - pairing_started
 * - pairing_failed
 * - first_order_sent
 * - agent_not_found
 * - docs_viewed
 */
