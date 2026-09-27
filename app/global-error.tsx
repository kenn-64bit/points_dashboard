"use client";

// Replaces the entire root layout when an error escapes it, so it can't rely
// on ThemeProvider/Tailwind/Header being available — kept minimal and
// self-contained with inline styles (Island Day values from globals.css) so
// it always renders.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "ui-rounded, system-ui, sans-serif",
          background: "#ebdfb6",
          color: "#4a3b24",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            textAlign: "center",
            padding: 24,
            background: "#fffbee",
            border: "1px solid #d8c38e",
            borderRadius: 28,
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: "#6b5634", marginBottom: 16 }}>
            An unexpected error occurred. Reloading usually fixes this.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              border: "none",
              background: "#a9d2bd",
              color: "#1d4337",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
