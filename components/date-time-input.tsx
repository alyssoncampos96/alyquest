"use client";
import { useState } from "react";
import { DateInput } from "@/components/date-input";

export function DateTimeInput({ name, defaultValue, required = false }: { name: string; defaultValue: string; required?: boolean }) {
  const [day, setDay] = useState(defaultValue.slice(0, 10));
  const [time, setTime] = useState(defaultValue.slice(11, 16));
  return <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2">
    <label className="min-w-0 text-xs text-slate-400">Data<DateInput required={required} value={day} onChange={event => setDay(event.target.value)} /></label>
    <label className="min-w-0 text-xs text-slate-400">Hora<input type="time" required={required} value={time} onChange={event => setTime(event.target.value)} className="aq-date mt-2 block w-full min-w-0 max-w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-white" /></label>
    <input type="hidden" name={name} value={day && time ? `${day}T${time}` : ""} readOnly />
  </div>;
}
