export type TrustProxySetting = false | number;

export function applyTrustProxy(
  set: (key: string, value: TrustProxySetting) => void,
  hops: TrustProxySetting,
): void {
  if (hops === false) {
    set('trust proxy', false);
    return;
  }
  set('trust proxy', hops);
}
