/**
 * Calendar export (.ics) and Data Export/Account tools
 */
import { type Task } from "@/lib/tasks";

export function exportTasksToICS(tasks: Task[], calendarTitle = "Pinboard Tasks"): void {
  const events: string[] = [];

  for (const t of tasks) {
    if (!t.scheduled_date && !t.due_date) continue;
    const dateStr = (t.scheduled_date || t.due_date)!.replace(/-/g, "");

    let dtStart = `VALUE=DATE:${dateStr}`;
    let dtEnd = `VALUE=DATE:${dateStr}`;

    if (t.start_time && t.scheduled_date) {
      const [h = "00", m = "00"] = t.start_time.split(":");
      const dtFormatted = `${dateStr}T${h.padStart(2, "0")}${m.padStart(2, "0")}00`;
      dtStart = dtFormatted;

      const dur = t.duration_minutes || 30;
      const endMinutes = parseInt(h, 10) * 60 + parseInt(m, 10) + dur;
      const endH = String(Math.floor(endMinutes / 60) % 24).padStart(2, "0");
      const endM = String(endMinutes % 60).padStart(2, "0");
      dtEnd = `${dateStr}T${endH}${endM}00`;
    }

    const cleanTitle = t.title.replace(/[,;\\]/g, " ");
    const cleanNotes = (t.notes || "").replace(/\n/g, "\\n").replace(/[,;\\]/g, " ");

    events.push(
      [
        "BEGIN:VEVENT",
        `UID:${t.id}@pinboard.app`,
        `SUMMARY:${cleanTitle}`,
        `DESCRIPTION:${cleanNotes}`,
        `STATUS:${t.status === "done" ? "COMPLETED" : "CONFIRMED"}`,
        `DTSTART;${dtStart}`,
        `DTEND;${dtEnd}`,
        "END:VEVENT",
      ].join("\r\n"),
    );
  }

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pinboard App//EN",
    `X-WR-CALNAME:${calendarTitle}`,
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pinboard-${calendarTitle.toLowerCase().replace(/\s+/g, "-")}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportAllDataAsJSON(data: {
  tasks: unknown[];
  goals: unknown[];
  updates: unknown[];
  settings: unknown;
}): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pinboard-export-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
