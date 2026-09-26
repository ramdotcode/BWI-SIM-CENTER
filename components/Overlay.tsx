"use client";
import { useEffect, type ReactNode } from "react";

function useEsc(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEsc(open, onClose);
  if (!open) return null;
  return (
    <div className="modal on" role="dialog" aria-modal="true">
      <div className="bg" onClick={onClose} />
      <div className={`box ${wide ? "wide" : ""}`}>
        <div className="mh">
          <h3>{title}</h3>
          <button className="x" onClick={onClose} aria-label="Tutup">✕</button>
        </div>
        <div className="mb">{children}</div>
        {footer && <div className="mf">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, head, children, footer }: { open: boolean; onClose: () => void; head: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEsc(open, onClose);
  if (!open) return null;
  return (
    <div className="drawer on" role="dialog" aria-modal="true">
      <div className="bg" onClick={onClose} />
      <div className="pnl">
        <div className="ph">
          {head}
          <button className="x" onClick={onClose} aria-label="Tutup">✕</button>
        </div>
        <div className="pb">{children}</div>
        {footer && <div className="pf">{footer}</div>}
      </div>
    </div>
  );
}

export function Lightbox({ src, mime, onClose }: { src: string | null; mime?: string; onClose: () => void }) {
  useEsc(!!src, onClose);
  if (!src) return null;
  return (
    <div className="lightbox" onClick={onClose} role="dialog" aria-modal="true">
      <button className="x" onClick={onClose} aria-label="Tutup">✕</button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {mime === "application/pdf" ? <iframe src={src} title="Dokumen" onClick={(e) => e.stopPropagation()} /> : <img src={src} alt="Dokumen" onClick={(e) => e.stopPropagation()} />}
    </div>
  );
}
