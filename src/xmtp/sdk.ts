import { BASE_URL } from '../config';

let xmtpNodeSdkModule: typeof import('@xmtp/node-sdk') | null = null;

export async function loadXmtpNodeSdk() {
  if (xmtpNodeSdkModule) return xmtpNodeSdkModule;
  xmtpNodeSdkModule = await import('@xmtp/node-sdk');
  return xmtpNodeSdkModule;
}

export function resolveXmtpEnv() {
  const raw = process.env.XMTP_ENV ? process.env.XMTP_ENV.trim().toLowerCase() : '';
  if (raw === 'dev' || raw === 'local' || raw === 'production') return raw;

  const baseUrl = (process.env.REGISTRY_BROKER_API_URL ?? BASE_URL).toLowerCase();
  if (
    baseUrl.includes('registry-staging.hol.org') ||
    baseUrl.includes('localhost') ||
    baseUrl.includes('127.0.0.1')
  ) {
    return 'dev';
  }

  return 'production';
}
