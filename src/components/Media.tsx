import { FileText, ImageOff, LoaderCircle } from "lucide-react";
import Image from "next/image";
import { type ImgHTMLAttributes, useEffect, useRef, useState } from "react";
import { canOptimizeImage, imageSource } from "../lib/image-sources";
import { documentUrl, isLocalFile, readLocalFile } from "../lib/local-files";

const localAssets = new Map<string, { url: Promise<string>; users: number }>();

function acquireLocalAsset(reference: string) {
  let asset = localAssets.get(reference);
  if (!asset) {
    asset = {
      url: readLocalFile(reference).then((file) => URL.createObjectURL(file)),
      users: 0,
    };
    localAssets.set(reference, asset);
  }
  const entry = asset;
  entry.users++;
  return {
    url: entry.url,
    release() {
      if (--entry.users > 0) return;
      if (localAssets.get(reference) === entry) localAssets.delete(reference);
      void entry.url.then(
        (url) => URL.revokeObjectURL(url),
        () => {},
      );
    },
  };
}

function useAsset(reference: string) {
  const [local, setLocal] = useState<{ reference: string; url: string } | null>(
    null,
  );
  useEffect(() => {
    if (!isLocalFile(reference)) return;
    let disposed = false;
    const asset = acquireLocalAsset(reference);
    void asset.url
      .then((url) => {
        if (disposed) return;
        setLocal({ reference, url });
      })
      .catch(() => {
        if (!disposed) setLocal({ reference, url: "" });
      });
    return () => {
      disposed = true;
      asset.release();
    };
  }, [reference]);
  if (!isLocalFile(reference)) return { url: reference, pending: false };
  return local?.reference === reference
    ? { url: local.url, pending: false }
    : { url: "", pending: true };
}

export function MediaImage({
  src = "",
  alt = "",
  fallbackSrc = "/logo-stg.png",
  loading = "lazy",
  decoding = "async",
  sizes = "(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 640px",
  width = 1200,
  height = 800,
  showLoading = false,
  className,
  style,
  onLoad,
  onError,
  ...props
}: Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet"> & {
  src?: string;
  fallbackSrc?: string;
  showLoading?: boolean;
}) {
  const { url, pending } = useAsset(imageSource(src));
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const [loadedResource, setLoadedResource] = useState<string | null>(null);
  const [unavailableResource, setUnavailableResource] = useState<string | null>(
    null,
  );
  const imageRef = useRef<HTMLImageElement>(null);
  const source = url && failedSource !== url ? url : fallbackSrc;
  const resource = `${src}|${source}|${pending}`;
  const ready = !pending && loadedResource === resource;
  const unavailable = unavailableResource === resource;

  useEffect(() => {
    if (!showLoading || pending) return;
    const image = imageRef.current;
    // Cached images can finish before hydration attaches their load handler.
    if (!image?.complete || !image.naturalWidth) return;
    let disposed = false;
    void image
      .decode()
      .catch(() => {})
      .then(() => {
        if (!disposed) setLoadedResource(resource);
      });
    return () => {
      disposed = true;
    };
  }, [resource, pending, showLoading]);

  const handleLoad: ImgHTMLAttributes<HTMLImageElement>["onLoad"] = (event) => {
    onLoad?.(event);
    if (!showLoading || pending) return;
    const image = event.currentTarget;
    void image
      .decode()
      .catch(() => {})
      .then(() => {
        if (image.isConnected && image.naturalWidth)
          setLoadedResource(resource);
      });
  };
  const handleError: ImgHTMLAttributes<HTMLImageElement>["onError"] = (
    event,
  ) => {
    if (source !== fallbackSrc) setFailedSource(url);
    else if (!pending) setUnavailableResource(resource);
    onError?.(event);
  };
  const image = canOptimizeImage(source) ? (
    <Image
      {...props}
      key={resource}
      ref={imageRef}
      src={source}
      alt={alt}
      width={Number(width)}
      height={Number(height)}
      sizes={sizes}
      loading={loading}
      decoding={decoding}
      className={showLoading ? "media-image__picture" : className}
      style={showLoading ? undefined : style}
      onLoad={handleLoad}
      onError={handleError}
    />
  ) : (
    // biome-ignore lint/performance/noImgElement: Blob URLs, SVGs and arbitrary external URLs must keep working without the image optimizer.
    <img
      {...props}
      key={resource}
      ref={imageRef}
      src={source}
      alt={alt}
      loading={loading}
      decoding={decoding}
      className={showLoading ? "media-image__picture" : className}
      style={showLoading ? undefined : style}
      onLoad={handleLoad}
      onError={handleError}
    />
  );

  if (!showLoading) return image;
  return (
    <span
      className={`media-image ${className || ""}`}
      style={style}
      data-loaded={ready}
      aria-busy={!ready && !unavailable}
    >
      {image}
      {!ready && (
        <span className="media-image__placeholder" aria-hidden="true">
          {unavailable ? (
            <>
              <ImageOff size={28} strokeWidth={1.5} />
              <span>Imagen no disponible</span>
            </>
          ) : (
            <>
              <LoaderCircle
                className="media-image__spinner"
                size={28}
                strokeWidth={2}
              />
              <span>Cargando imagen…</span>
            </>
          )}
        </span>
      )}
    </span>
  );
}

export function PdfLink({ value }: { value: string }) {
  const reference = documentUrl(value);
  const { url } = useAsset(reference || "");
  return reference && url ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="btn-dark px-4 py-2"
    >
      <FileText size={17} />
      Mas informacion
    </a>
  ) : (
    <span className="inline-flex items-center gap-2 px-2 py-2 text-sm text-muted">
      <FileText size={17} />
      PDF no disponible
    </span>
  );
}
