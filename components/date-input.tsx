"use client";
import type { InputHTMLAttributes } from "react";

export function DateInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} type="date" className={`aq-date mt-2 block w-full min-w-0 max-w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-white ${className}`} />;
}
