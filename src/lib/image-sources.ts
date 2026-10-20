const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

export const imageRemotePatterns: {
  protocol: "https";
  hostname: string;
  port: string;
  pathname: string;
}[] = [
  {
    protocol: "https",
    hostname: "images.unsplash.com",
    port: "",
    pathname: "/**",
  },
];

if (storageUrl) {
  try {
    const url = new URL(storageUrl);
    if (url.protocol === "https:") {
      for (const bucket of ["trip-images", "passenger-images"]) {
        imageRemotePatterns.push({
          protocol: "https",
          hostname: url.hostname,
          port: url.port,
          pathname: `/storage/v1/object/public/${bucket}/**`,
        });
      }
    }
  } catch {
    // An incomplete local setup should still be able to display local photos.
  }
}

export function imageSource(source: string) {
  // Old starter trips can remain in localStorage after the source is corrected.
  if (
    source.startsWith(
      "https://images.unsplash.com/photo-1598791503410-0c0872a3edb1?",
    )
  ) {
    return "/images/destinations/bariloche.webp";
  }
  if (
    source.startsWith(
      "https://images.unsplash.com/photo-1601042879364-f3947d3f9c16?",
    )
  ) {
    return "/images/destinations/norte.webp";
  }
  return source;
}

export function canOptimizeImage(source: string) {
  if (/\.svg(?:\?|$)/i.test(source) || source === "/logo-stg.png") return false;
  if (source.startsWith("/") && !source.startsWith("//")) return true;
  try {
    const url = new URL(source);
    return imageRemotePatterns.some(
      (pattern) =>
        url.protocol === `${pattern.protocol}:` &&
        url.hostname === pattern.hostname &&
        url.port === pattern.port &&
        url.pathname.startsWith(pattern.pathname.slice(0, -2)),
    );
  } catch {
    return false;
  }
}
