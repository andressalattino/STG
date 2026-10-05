import { FileText } from "lucide-react";
import { type ImgHTMLAttributes, useEffect, useState } from "react";
import { documentUrl, isLocalFile, readLocalFile } from "../lib/local-files";

function useAsset(reference: string) {
  const [local, setLocal] = useState<{ reference: string; url: string } | null>(
    null,
  );
  useEffect(() => {
    if (!isLocalFile(reference)) return;
    let disposed = false;
    let url = "";
    void readLocalFile(reference)
      .then((file) => {
        if (disposed) return;
        url = URL.createObjectURL(file);
        setLocal({ reference, url });
      })
      .catch(() => setLocal(null));
    return () => {
      disposed = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [reference]);
  return isLocalFile(reference)
    ? local?.reference === reference
      ? local.url
      : ""
    : reference;
}

export function MediaImage({
  src = "",
  alt,
  ...props
}: Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { src?: string }) {
  const url = useAsset(src);
  // biome-ignore lint/performance/noImgElement: Existing media may be local IndexedDB blobs or arbitrary administrator uploads.
  return <img {...props} src={url || "/logo-stg.png"} alt={alt} />;
}

export function PdfLink({ value }: { value: string }) {
  const reference = documentUrl(value);
  const url = useAsset(reference || "");
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
