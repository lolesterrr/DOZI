import { getNetworkStateAsync, NetworkStateType } from 'expo-network';

import type { ConnectionKind } from './logic';

/** The phone's connection right now (expo-network). Wired ethernet counts as Wi-Fi. */
export async function currentConnection(): Promise<ConnectionKind> {
  try {
    const state = await getNetworkStateAsync();
    if (state.isConnected === false || state.type === NetworkStateType.NONE) return 'none';
    if (state.type === NetworkStateType.WIFI || state.type === NetworkStateType.ETHERNET) {
      return 'wifi';
    }
    if (state.type === NetworkStateType.CELLULAR) return 'cellular';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}
