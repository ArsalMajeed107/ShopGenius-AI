import { useState } from "react";
import { Package } from "lucide-react";
import { resolveProductImage } from "../lib/productImages";

interface SmartImageProps {
  imageKey: string;
  alt: string;
  className?: string;
}

export function SmartImage({ imageKey, alt, className = "w-full h-full object-cover" }: SmartImageProps) {
  const [errored, setErrored] = useState(false);
  const src = resolveProductImage(imageKey);

  if (errored || !src) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 text-slate-500 dark:text-slate-400 p-4 text-center">
        <Package className="w-8 h-8 mb-2 opacity-60" />
        <span className="text-xs font-medium line-clamp-2">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setErrored(true)}
      className={className}
    />
  );
}
