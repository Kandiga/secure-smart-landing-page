import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
  }

  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    return NextResponse.json({ error: "Supabase service role not configured" }, { status: 503 });
  }

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: orders, error: selectError } = await supabase
    .from("orders")
    .select("id,created_at,status")
    .eq("status", "new")
    .lte("created_at", cutoff)
    .limit(200);

  if (selectError) {
    return NextResponse.json({ error: selectError.message }, { status: 500 });
  }

  const ids = (orders ?? []).map((order: any) => order.id).filter(Boolean);
  if (!ids.length) {
    return NextResponse.json({ ok: true, released: 0, cutoff });
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("orders")
    .update({ status: "review", updated_at: now })
    .in("id", ids);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await supabase.from("order_events").insert(ids.map((orderId: string) => ({
    order_id: orderId,
    event_type: "order_released_to_operations_after_48h",
    metadata: { cutoff, releasedAt: now, previousStatus: "new", nextStatus: "review" },
  })));

  return NextResponse.json({ ok: true, released: ids.length, cutoff, releasedAt: now });
}
