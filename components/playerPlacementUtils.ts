export const DEFAULT_PLACEMENT_SLUG = 'webradio';
export const AUDIO_PREROLL_SUFFIX = 'audio_preroll';
export const VIDEO_PREROLL_SUFFIX = 'video_preroll';

export const stripSlashes = (value: string) => value.trim().replace(/^\/+/g, '').replace(/\/+$/g, '');

export const buildPlacement = (network: string, slug: string, suffix: string) => {
  const sanitizedNetwork = stripSlashes(network);
  const sanitizedSlug = stripSlashes(slug);

  if (!sanitizedNetwork || !sanitizedSlug) {
    return '';
  }

  return `/${sanitizedNetwork}/${sanitizedSlug}/${suffix}`;
};

const parsePlacementSegments = (placement: string | undefined, suffix: string) => {
  if (!placement) {
    return [] as string[];
  }

  const trimmed = placement.trim();
  if (!trimmed) {
    return [] as string[];
  }

  const withoutPrefix = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  const suffixToken = `/${suffix}`;

  if (!withoutPrefix.endsWith(suffixToken)) {
    return [] as string[];
  }

  const withoutSuffix = withoutPrefix.slice(0, withoutPrefix.length - suffixToken.length);

  return withoutSuffix
    .split('/')
    .map(segment => stripSlashes(segment))
    .filter(Boolean);
};

export const extractSlugFromPlacement = (placement: string | undefined, suffix: string | string[]) => {
  const suffixes = Array.isArray(suffix) ? suffix : [suffix];

  for (const candidate of suffixes) {
    const segments = parsePlacementSegments(placement, candidate);

    if (segments.length > 1) {
      return segments.slice(1).join('/');
    }
  }

  return '';
};

export const extractNetworkFromPlacement = (placement: string | undefined, suffix: string | string[]) => {
  const suffixes = Array.isArray(suffix) ? suffix : [suffix];

  for (const candidate of suffixes) {
    const segments = parsePlacementSegments(placement, candidate);

    if (segments.length > 0) {
      return segments[0];
    }
  }

  return '';
};
