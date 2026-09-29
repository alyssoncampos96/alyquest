"use client";
import { useId, useRef, useState, useEffect, type ReactNode } from 'react';
export function FormDialog({label,children,compact=false}:{label:string;children:ReactNode;compact?:boolean}) {
 const [open,setOpen]=useState(false);
 const ref=useRef<HTMLDialogElement>(null),id=useId();
 useEffect(()=>{if(open)ref.current?.showModal();},[open]);
 return <><button type="button" onClick={()=>setOpen(true)} className={compact?"shrink-0 rounded-lg border border-slate-700 px-2.5 py-2 text-xs font-semibold":"shrink-0 rounded-xl bg-violet-600 px-3 py-2 text-sm font-bold"}>{label}</button><dialog onClose={()=>setOpen(false)} ref={ref} aria-labelledby={id} className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl border border-slate-700 bg-slate-950 p-4 text-white backdrop:bg-black/70"><div className="mb-3 flex items-center justify-between gap-3"><h2 id={id} className="font-bold">{label}</h2><button type="button" aria-label="Fechar formulário" onClick={()=>ref.current?.close()} className="rounded-lg border border-slate-600 px-3 py-2">✕</button></div>{open&&children}</dialog></>;
}
