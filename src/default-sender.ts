import { loadIdentity } from './identity';

export function getDefaultSenderUaid(excludeUaid: string | null = null) {
  const identity = loadIdentity();
  if ((identity as any)?.claimedAgents?.length > 0) {
    if (excludeUaid) {
      const available = (identity as any).claimedAgents.filter(
        (u: string) => u !== excludeUaid,
      );
      if (available.length > 0) {
        return available[0];
      }
    }
    return (identity as any).claimedAgents[0] as string;
  }
  return null;
}

