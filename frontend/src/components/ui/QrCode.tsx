"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrCode({ value, size = 220 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { width: size, margin: 2, errorCorrectionLevel: "H" })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!dataUrl) {
    return <div className="lb-skeleton rounded-[var(--radius-lb-field)]" style={{ width: size, height: size }} />;
  }

  // eslint-disable-next-line @next/next/no-img-element -- a locally-generated data: URL, not a remote/optimizable image
  return <img src={dataUrl} alt="Check-in QR code" width={size} height={size} className="rounded-[var(--radius-lb-field)]" />;
}
