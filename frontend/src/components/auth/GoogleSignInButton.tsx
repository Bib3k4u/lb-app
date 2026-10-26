"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

// Public value from Google Cloud Console (OAuth 2.0 Web client). Blank hides
// the button entirely, so the existing email + password login is unaffected.
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

interface GoogleIdentityApi {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string;
        callback: (response: { credential?: string }) => void;
      }) => void;
      renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityApi;
  }
}

/** "Sign in with Google" — hands the ID token to onCredential; the caller
 *  decides what happens next. Renders nothing when no client ID is set. */
export function GoogleSignInButton({
  onCredential,
  text = "signin_with",
}: {
  onCredential: (idToken: string) => void;
  text?: "signin_with" | "signup_with" | "continue_with";
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(
    () => typeof window !== "undefined" && Boolean(window.google?.accounts?.id),
  );
  const callbackRef = useRef(onCredential);

  useEffect(() => {
    callbackRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    const gsi = window.google?.accounts.id;
    if (!ready || !gsi || !holder.current) return;
    gsi.initialize({
      client_id: CLIENT_ID,
      callback: (response) => {
        if (response.credential) callbackRef.current(response.credential);
      },
    });
    gsi.renderButton(holder.current, {
      type: "standard",
      theme: "outline",
      size: "large",
      shape: "pill",
      text,
      width: 320,
    });
  }, [ready, text]);

  if (!CLIENT_ID) return null;

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => setReady(true)} />
      <div ref={holder} className="flex min-h-11 justify-center" />
    </>
  );
}
