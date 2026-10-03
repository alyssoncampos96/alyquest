"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { notificationPhrases } from "@/lib/notification-copy";

type PushState = "loading" | "unsupported" | "missing_config" | "default" | "denied" | "granted" | "active" | "error";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export function NotificationPermission() {
  const [state, setState] = useState<PushState>("loading");
  const [message, setMessage] = useState("");
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    async function load() {
      if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        setState("unsupported");
        return;
      }
      if (!publicKey) {
        setState("missing_config");
        return;
      }
      setState(Notification.permission);
      if (Notification.permission === "granted") {
        try {
          await navigator.serviceWorker.register("/sw.js");
          const subscription = await currentSubscription();
          setState(subscription ? "active" : "granted");
        } catch {
          setState("granted");
        }
      }
    }
    void load();
  }, [publicKey]);

  async function request() {
    setMessage("");
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (!publicKey) {
      setState("missing_config");
      return;
    }
    const result = await Notification.requestPermission();
    if (result !== "granted") {
      setState(result);
      return;
    }
    try {
      const registration = await navigator.serviceWorker.register("/sw.js");
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Não foi possível salvar este aparelho.");
      setState("active");
      setMessage("Este aparelho já pode receber lembretes do AlyQuest.");
      new Notification("AlyQuest", { body: notificationPhrases[0], icon: "/icon-192.png" });
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Não foi possível ativar notificações.");
    }
  }

  async function disable() {
    setMessage("");
    try {
      const subscription = await currentSubscription();
      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState(Notification.permission === "granted" ? "granted" : Notification.permission);
      setMessage("Notificações desativadas neste aparelho.");
    } catch {
      setMessage("Não consegui desativar automaticamente. Revise as permissões do navegador.");
    }
  }

  const label = state === "active"
    ? "Ativadas neste aparelho."
    : state === "granted"
      ? "Permissão concedida. Falta registrar este aparelho para Web Push."
      : state === "denied"
        ? "Bloqueadas nas permissões do navegador."
        : state === "unsupported"
          ? "Indisponíveis neste navegador."
          : state === "missing_config"
            ? "As chaves VAPID ainda não chegaram neste deploy."
            : state === "loading"
              ? "Verificando permissões..."
              : state === "error"
                ? "Não foi possível ativar neste aparelho."
                : "Prontas para ativar neste aparelho.";

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-violet-950 text-violet-200"><Bell size={18} /></div>
        <div className="flex-1">
          <h2 className="font-bold">Notificações do navegador</h2>
          <p className="mt-1 text-xs text-slate-400">{label}</p>
          <p className="mt-2 text-xs text-slate-500">No iPhone, abra pelo ícone adicionado à Tela de Início para receber avisos com o app fechado.</p>
          {message && <p className="mt-2 text-xs text-violet-200">{message}</p>}
        </div>
        {(state === "default" || state === "granted" || state === "error") && <button onClick={request} className="rounded-xl bg-violet-600 px-3 py-2 text-sm font-bold">Ativar</button>}
        {state === "active" && <button onClick={disable} className="rounded-xl bg-slate-800 px-3 py-2 text-sm font-bold text-slate-200">Desativar</button>}
      </div>
    </section>
  );
}
