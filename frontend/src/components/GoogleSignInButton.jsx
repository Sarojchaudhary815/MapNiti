import React, { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { GOOGLE_CLIENT_ID } from "../constants/googleAuth";
import { loginWithGoogle } from "../api/authApi";
import { getErrorMessage } from "../utils/errors";
import { afterLoginPath } from "../utils/afterLogin";

const GSI_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

function loadGsiScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const existing = document.querySelector(`script[src="${GSI_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google script")));
      return;
    }
    const script = document.createElement("script");
    script.src = GSI_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google script"));
    document.head.appendChild(script);
  });
}

const GoogleSignInButton = ({ onError }) => {
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState(false);
  const tokenClientRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadGsiScript()
      .then(() => {
        if (cancelled) return;
        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: "openid email profile",
          callback: async (response) => {
            if (response.error) {
              setLoading(false);
              onError?.("Google sign-in was cancelled.");
              return;
            }
            try {
              await loginWithGoogle(response.access_token);
              window.location.href = afterLoginPath();
            } catch (err) {
              setLoading(false);
              onError?.(getErrorMessage(err, "Google sign-in failed. Please try again."));
            }
          },
        });
      })
      .catch(() => onError?.("Could not load Google sign-in. Please try again."));
    return () => { cancelled = true; };
  }, [onError]);

  const handleClick = () => {
    if (!tokenClientRef.current) return;
    setLoading(true);
    tokenClientRef.current.requestAccessToken();
  };

  return (
    <div className="relative w-full">
      <button
        type="button"
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        disabled={loading}
        className="relative w-full flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-3.5 font-bold text-slate-700"
      >
        {loading ? (
          <Loader2 size={18} className="animate-spin text-slate-400" />
        ) : (
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
            <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
            <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
            <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
          </svg>
        )}
        {loading ? "Signing in..." : "Continue with Google"}
      </button>

      {/* The entire border stays lit at all times — only the hues flow
          around it. Uses pathLength=100 so the repeating gradient tile
          distributes evenly along the button's true perimeter (unlike a
          rotating conic-gradient, which sweeps by angle-from-center and
          distorts unevenly on a wide rectangle). */}
      <svg
        className="pointer-events-none absolute inset-0 w-full h-full"
        style={{ overflow: "visible" }}
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id="google-flow-gradient"
            gradientUnits="userSpaceOnUse"
            x1="0" y1="0" x2="25" y2="0"
            spreadMethod="repeat"
          >
            <stop offset="0%" stopColor="#4285F4" />
            <stop offset="25%" stopColor="#EA4335" />
            <stop offset="50%" stopColor="#FBBC05" />
            <stop offset="75%" stopColor="#34A853" />
            <stop offset="100%" stopColor="#4285F4" />
            <animateTransform
              attributeName="gradientTransform"
              type="translate"
              from="0 0"
              to="-25 0"
              dur="3s"
              repeatCount="indefinite"
            />
          </linearGradient>
        </defs>
        <rect
          x="1"
          y="1"
          width="calc(100% - 2px)"
          height="calc(100% - 2px)"
          rx="11"
          ry="11"
          pathLength="100"
          fill="none"
          stroke="url(#google-flow-gradient)"
          strokeWidth={hovered ? 2.5 : 1.5}
          style={{
            filter: hovered
              ? "blur(0.3px) drop-shadow(0 0 4px rgba(66,133,244,0.8)) drop-shadow(0 0 4px rgba(52,168,83,0.5))"
              : "blur(0.3px) drop-shadow(0 0 2px rgba(66,133,244,0.45))",
            transition: "stroke-width 0.3s, filter 0.3s",
          }}
        />
      </svg>
    </div>
  );
};

export default GoogleSignInButton;
