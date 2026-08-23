"use client"

import { useEffect } from "react"
import { RefreshCwIcon, TriangleAlertIcon } from "lucide-react"

type GlobalErrorProps = {
  error: Error & { digest?: string }
  retry: () => void
}

const globalErrorStyles = `
  :root {
    color-scheme: light dark;
    font-family: Geist, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: #fafafa;
    color: #18181b;
  }
  * { box-sizing: border-box; }
  body { min-height: 100vh; margin: 0; background: #fafafa; color: #18181b; }
  .global-error-main {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 32px 20px;
  }
  .global-error-card {
    width: min(100%, 480px);
    border: 1px solid #e4e4e7;
    border-radius: 18px;
    background: #ffffff;
    padding: 40px;
    text-align: center;
    box-shadow: 0 18px 50px rgba(24, 24, 27, 0.08);
  }
  .global-error-icon {
    width: 48px;
    height: 48px;
    margin: 0 auto 20px;
    display: grid;
    place-items: center;
    border-radius: 14px;
    background: #fef2f2;
    color: #dc2626;
    border: 1px solid #fee2e2;
  }
  .global-error-card h1 { margin: 0; font-size: 24px; line-height: 1.3; letter-spacing: -0.025em; }
  .global-error-card p { margin: 10px auto 0; max-width: 360px; color: #71717a; font-size: 15px; line-height: 1.65; }
  .global-error-button {
    min-height: 40px;
    margin-top: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    border: 0;
    border-radius: 10px;
    padding: 9px 16px;
    background: #18181b;
    color: #ffffff;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 150ms ease, transform 150ms ease;
  }
  .global-error-button:hover { background: #3f3f46; }
  .global-error-button:active { transform: translateY(1px); }
  .global-error-button:focus-visible { outline: 3px solid rgba(24, 24, 27, 0.25); outline-offset: 3px; }
  .global-error-reference { margin-top: 18px !important; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px !important; }
  @media (max-width: 520px) {
    .global-error-card { padding: 32px 24px; }
  }
  @media (prefers-color-scheme: dark) {
    :root, body { background: #09090b; color: #fafafa; }
    .global-error-card { background: #18181b; border-color: #3f3f46; box-shadow: 0 18px 50px rgba(0, 0, 0, 0.3); }
    .global-error-card p { color: #a1a1aa; }
    .global-error-icon { background: rgba(220, 38, 38, 0.12); border-color: rgba(248, 113, 113, 0.2); color: #f87171; }
    .global-error-button { background: #fafafa; color: #18181b; }
    .global-error-button:hover { background: #e4e4e7; }
    .global-error-button:focus-visible { outline-color: rgba(250, 250, 250, 0.3); }
  }
`

export default function GlobalError({ error, retry }: GlobalErrorProps) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="en">
      <head>
        <title>Something went wrong</title>
        <style>{globalErrorStyles}</style>
      </head>
      <body>
        <main className="global-error-main">
          <section className="global-error-card" role="alert">
            <div className="global-error-icon" aria-hidden="true">
              <TriangleAlertIcon size={22} strokeWidth={1.8} />
            </div>
            <h1>We hit an unexpected problem</h1>
            <p>
              The application could not recover on its own. Try loading it again
              to continue.
            </p>
            <button className="global-error-button" type="button" onClick={retry}>
              <RefreshCwIcon size={16} aria-hidden="true" />
              Try again
            </button>
            {error.digest ? (
              <p className="global-error-reference">
                Error reference: {error.digest}
              </p>
            ) : null}
          </section>
        </main>
      </body>
    </html>
  )
}
