"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { notificationPhrases } from "@/lib/notification-copy";

export function NotificationPermission() {
  const [state, setState] = useState<"default" | "denied" | "granted" | "unsupported">("unsupported");
  useEffect(() => {
    setState("Notification" in window ? Notification.permission : "unsupported");
  }, []);
  async function request() {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setState(result);
    if (result === "granted") new Notification("AlyQuest", { body: notificationPhrases[0] });
  }
  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-950 text-violet-200"><Bell size={18} /></div>
        <div className="flex-1">
          <h2 className="font-bold">Notificações do navegador</h2>
          <p className="mt-1 text-xs text-slate-400">{state === "granted" ? "Ativadas neste aparelho." : state === "denied" ? "Bloqueadas nas permissões do navegador." : state === "unsupported" ? "Indisponíveis neste navegador." : "Prontas para ativar neste aparelho."}</p>
        </div>
        {state === "default" && <button onClick={request} className="rounded-xl bg-violet-600 px-3 py-2 text-sm font-bold">Ativar</button>}
      </div>
    </section>
  );
}
