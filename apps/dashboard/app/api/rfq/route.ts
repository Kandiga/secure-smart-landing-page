import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const rfqSchema = z.object({
  customerId: z.string().uuid().optional(),
  companyId: z.string().uuid().optional(),
  source: z.string().default("website"),
  language: z.string().default("en"),
  items: z.array(z.object({
    sku: z.string().min(1).max(120),
    quantity: z.number().int().positive().max(100000),
    notes: z.string().max(1000).optional(),
  })).min(1).max(200),
});

export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-secure-smart-signature");
  const secret = process.env.SECURE_SMART_WEBHOOK_SECRET;

  // Phase 1 guard: require a configured secret before accepting external webhook traffic.
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }
  if (!signature || signature !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = rfqSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid RFQ payload", issues: parsed.error.flatten() }, { status: 400 });
  }

  // TODO Phase 6: replace placeholder with Supabase insert into quote_carts, quote_cart_items, orders, order_items, order_events.
  return NextResponse.json({ ok: true, receivedItems: parsed.data.items.length });
}
