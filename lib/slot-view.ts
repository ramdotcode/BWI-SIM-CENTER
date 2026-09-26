// Tampilan slot per audiens. Peserta/publik TIDAK pernah menerima nama peserta lain.
export type ViewStatus = "free" | "busy" | "mine" | "maint" | "done" | "noshow";

export function viewStatus(status: string, registrationId: number | null, mine?: number | null): ViewStatus {
  if (status === "AVAILABLE") return "free";
  if (status === "MAINTENANCE") return "maint";
  if (mine && registrationId === mine) return status === "COMPLETED" ? "done" : status === "NO_SHOW" ? "noshow" : "mine";
  return "busy";
}

export type PublicSlot = { sim: string; date: string; start: string; end: string; v: ViewStatus; instructor?: string | null; reason?: string | null };
