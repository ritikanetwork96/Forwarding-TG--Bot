import dns from 'node:dns';
import { logger } from '../utils/logger.js';

/**
 * Configure DNS resolution for Node.js.
 *
 * Background:
 * Node.js c-ares DNS resolver queries nameservers directly over UDP/TCP port 53 for SRV records.
 * On Windows systems with multiple network adapters (e.g. inactive virtual adapters or VPNs with
 * lower interface metrics), c-ares can default to loopback (127.0.0.1) when the primary metric
 * interface has no DNS configured, causing mongodb+srv:// lookups to fail with querySrv ECONNREFUSED.
 *
 * Resolution flow:
 * 1. Honors explicit DNS_SERVERS configured via environment variables (e.g. DNS_SERVERS=1.1.1.1,8.8.8.8).
 * 2. As a fallback outside business logic, if running on Windows and system DNS is stuck on loopback (127.0.0.1)
 *    while attempting to resolve an SRV cluster, it applies public resolvers (1.1.1.1, 8.8.8.8) to maintain resilience.
 */
export function configureDns(dnsServersConfig?: string, mongodbUri?: string): void {
  // 1. Explicitly configured DNS servers via environment
  if (dnsServersConfig) {
    const servers = dnsServersConfig
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    if (servers.length > 0) {
      dns.setServers(servers);
      logger.info(`DNS servers configured from environment: [${servers.join(', ')}]`);
      return;
    }
  }

  // 2. Windows c-ares loopback fallback for mongodb+srv://
  if (process.platform === 'win32' && mongodbUri?.startsWith('mongodb+srv://')) {
    const currentServers = dns.getServers();
    const isOnlyLoopback = currentServers.every(
      (server) => server === '127.0.0.1' || server === '::1'
    );

    if (isOnlyLoopback) {
      const fallbackServers = ['1.1.1.1', '8.8.8.8'];
      dns.setServers(fallbackServers);
      logger.warn(
        `Node.js DNS resolver defaulted to loopback (127.0.0.1) on Windows. ` +
          `Applied fallback DNS servers [${fallbackServers.join(', ')}] for MongoDB Atlas SRV resolution. ` +
          `You can override this by setting DNS_SERVERS in .env.`
      );
    }
  }
}
