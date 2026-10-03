import { NextResponse, type NextRequest } from "next/server";
import webpush, { type PushSubscription } from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { phraseFor } from "@/lib/notification-copy";

type Rule = {
  id: string;
  user_id: string;
  task_id: string | null;
  kind: "daily_summary" | "task";
  title: string;
  weekdays: number[];
  time_of_day: string;
  phrase_index: number;
  last_sent_on: string | null;
  task?: { title: string; status: string } | null;
};

type StoredSubscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function saoPauloParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const pick = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const hour = Number(pick("hour"));
  const minute = Number(pick("minute"));
  return {
    date: `${pick("year")}-${pick("month")}-${pick("day")}`,
    weekday: weekdayMap[pick("weekday")] ?? 0,
    minuteOfDay: hour * 60 + minute,
  };
}

function timeToMinutes(value: string) {
  const [hour = "0", minute = "0"] = value.split(":");
  return Number(hour) * 60 + Number(minute);
}

function isDue(rule: Rule, current: ReturnType<typeof saoPauloParts>, windowMinutes: number) {
  if (rule.last_sent_on === current.date) return false;
  if (!rule.weekdays?.includes(current.weekday)) return false;
  const diff = current.minuteOfDay - timeToMinutes(rule.time_of_day);
  return diff >= 0 && diff <= windowMinutes;
}

function authorize(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) throw new Error("Configure VAPID na Vercel.");
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export async function GET(request: NextRequest) {
  if (!authorize(request)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  configureWebPush();
  const supabase = createAdminClient();
  const current = saoPauloParts();
  const windowMinutes = Number(process.env.NOTIFICATION_WINDOW_MINUTES ?? 90);

  const { data: rules, error: rulesError } = await supabase
    .from("aq_notification_rules")
    .select("id,user_id,task_id,kind,title,weekdays,time_of_day,phrase_index,last_sent_on,task:tasks(title,status)")
    .eq("active", true);

  if (rulesError) return NextResponse.json({ error: rulesError.message }, { status: 500 });

  const dueRules = ((rules ?? []) as unknown as Rule[]).filter(rule => isDue(rule, current, windowMinutes));
  let sent = 0;
  let failed = 0;

  for (const rule of dueRules) {
    if (rule.kind === "task" && rule.task?.status && rule.task.status !== "pending") continue;

    const { data: subscriptions } = await supabase
      .from("aq_push_subscriptions")
      .select("id,user_id,endpoint,p256dh,auth")
      .eq("user_id", rule.user_id)
      .is("revoked_at", null);

    if (!subscriptions?.length) continue;

    let pendingCount = 0;
    if (rule.kind === "daily_summary") {
      const { count } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", rule.user_id)
        .eq("status", "pending");
      pendingCount = count ?? 0;
    }

    const phrase = phraseFor(rule.phrase_index ?? 0);
    const body = rule.kind === "daily_summary"
      ? `${phrase} Você tem ${pendingCount} missão${pendingCount === 1 ? "" : "ões"} pendente${pendingCount === 1 ? "" : "s"}.`
      : `${phrase} Missão: ${rule.task?.title ?? rule.title}.`;

    const payload = JSON.stringify({
      title: rule.kind === "daily_summary" ? "AlyQuest · resumo do dia" : "AlyQuest · lembrete de missão",
      body,
      url: rule.kind === "daily_summary" ? "/" : "/tasks",
    });

    for (const subscription of subscriptions as StoredSubscription[]) {
      const pushSubscription: PushSubscription = {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      };
      try {
        await webpush.sendNotification(pushSubscription, payload);
        sent++;
      } catch (error) {
        failed++;
        const statusCode = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("aq_push_subscriptions").update({ revoked_at: new Date().toISOString() }).eq("id", subscription.id);
        }
      }
    }

    await supabase
      .from("aq_notification_rules")
      .update({ last_sent_on: current.date, phrase_index: (rule.phrase_index ?? 0) + 1 })
      .eq("id", rule.id);
  }

  return NextResponse.json({ ok: true, checked: dueRules.length, sent, failed, date: current.date });
}
