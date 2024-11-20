import { isAndroid, isDesktopWebKit, isSafariWebKit, isWebKit, isWebKit616OrNewer } from './_util';


export interface Confidence {

  /**
   * A number between 0 and 1 that tells how much the agent is sure about the visitor identifier.
   * The higher the number, the higher the chance of the visitor identifier to be true.
   */
  score: number;

  /**
   * Additional details about the score as a human-readable text
   */
  comment?: string;
}


export function getConfidenceScore(components: { platform: string | { value: string } }): number {
  if(isAndroid()) return 0.4;
  if(isWebKit()) return isDesktopWebKit() && !(isWebKit616OrNewer() && isSafariWebKit()) ? 0.5 : 0.3;

  const platform = typeof components.platform === 'object' && 'value' in components.platform ? components.platform.value : components.platform;

  if(/^Win/.test(platform)) return 0.6;
  if(/^Mac/.test(platform)) return 0.5;
  
  return 0.7;
}
