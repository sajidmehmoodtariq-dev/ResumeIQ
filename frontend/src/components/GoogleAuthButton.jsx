import { useEffect, useRef, useState } from 'react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

function waitForGoogle(timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    function check() {
      if (window.google?.accounts?.id) {
        resolve(window.google.accounts.id);
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        reject(new Error('Google sign-in script did not load'));
        return;
      }

      window.setTimeout(check, 100);
    }

    check();
  });
}

export default function GoogleAuthButton({ onCredential, label = 'Continue with Google' }) {
  const buttonRef = useRef(null);
  const onCredentialRef = useRef(onCredential);
  const [error, setError] = useState(null);

  useEffect(() => {
    onCredentialRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      if (!GOOGLE_CLIENT_ID) {
        setError('Set VITE_GOOGLE_CLIENT_ID to enable Google login.');
        return;
      }

      try {
        const googleId = await waitForGoogle();
        if (cancelled || !buttonRef.current) return;

        const buttonWidth = Math.max(240, Math.min(400, buttonRef.current.clientWidth || 400));

        googleId.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response) => {
            try {
              await onCredentialRef.current(response.credential);
            } catch (err) {
              setError(err?.message || 'Google sign-in failed');
            }
          },
        });

        googleId.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          width: buttonWidth,
          text: 'signin_with',
          logo_alignment: 'left',
        });
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Google sign-in unavailable');
        }
      }
    }

    setup();

    return () => {
      cancelled = true;
      if (buttonRef.current) {
        buttonRef.current.innerHTML = '';
      }
    };
  }, []);

  return (
    <div className="auth-google-shell">
      <div ref={buttonRef} className="auth-google-button" aria-label={label} />
      {error && <div className="auth-google-error">{error}</div>}
    </div>
  );
}