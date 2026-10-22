import Negotiator from "negotiator";

export const DEFAULT_LOCALE = "en-US";

/**
 * Picks the most preferred locale from an Accept-Language header that the
 * runtime's Intl implementation supports.
 */
export function negotiateLocale(acceptLanguage: string | null): string {
  const negotiator = new Negotiator({
    headers: { "accept-language": acceptLanguage ?? undefined },
  });

  for (const tag of negotiator.languages()) {
    if (tag === "*") {
      continue;
    }

    try {
      const [supported] = Intl.NumberFormat.supportedLocalesOf(tag);
      if (supported) {
        return supported;
      }
    } catch {
      // Malformed language tag, try the next one.
    }
  }

  return DEFAULT_LOCALE;
}
