"use client";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div className="pub" style={{ maxWidth: 560, paddingTop: 80, textAlign: "center" }}>
      <div className="card pad" style={{ padding: 32 }}>
        <h2>Terjadi kesalahan · Something went wrong</h2>
        <p className="muted small" style={{ marginTop: 10 }}>{error.digest ? `Ref: ${error.digest}` : null}</p>
        <button className="btn" style={{ marginTop: 18 }} onClick={reset}>Coba lagi · Retry</button>
      </div>
    </div>
  );
}
