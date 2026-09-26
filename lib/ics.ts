// Berkas kalender .ics untuk email jadwal.
import { wibInstant } from "./format";

type IcsEvent = { uid: string; date: string; start: string; end: string; title: string; location: string; description: string };

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

export function buildIcs(events: IcsEvent[], calName = "BWI Sim Center"): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//BWI Aviation//Sim Center//ID", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(calName)}`];
  const now = stamp(new Date());
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${stamp(wibInstant(e.date, e.start))}`,
      `DTEND:${stamp(wibInstant(e.date, e.end))}`,
      `SUMMARY:${esc(e.title)}`,
      `LOCATION:${esc(e.location)}`,
      `DESCRIPTION:${esc(e.description)}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT90M",
      "ACTION:DISPLAY",
      `DESCRIPTION:${esc(e.title)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
