"use client";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

const Ctx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState("");
  const [on, setOn] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    setOn(true);
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => setOn(false), 3600);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div className={`toast ${on ? "on" : ""}`} role="status" aria-live="polite">
        <i />
        <span>{msg}</span>
      </div>
    </Ctx.Provider>
  );
}
