'use client';
// Last resort when the root layout itself fails: no providers or translations are available,
// so the page is plain and bilingual.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F6F1E7',
          color: '#1B2420',
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          padding: 24,
        }}
      >
        <main>
          <h1 style={{ fontSize: 28, margin: 0 }}>Something went wrong</h1>
          <p lang="ar" dir="rtl" style={{ fontSize: 20, margin: '8px 0 24px' }}>
            حدث خطأ ما
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: '#1E4D45',
              color: '#F6F1E7',
              border: 0,
              borderRadius: 8,
              padding: '10px 20px',
              fontSize: 16,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
