"use client";

import { useActionState } from "react";
import { approveProfile, promoteProfile, rejectProfile } from "./actions";

const initial = {} as { error?: string; success?: string };

function State({ state }: { state: { error?: string; success?: string } }) {
  if (state.error) return <span className="inline-status error">{state.error}</span>;
  if (state.success) return <span className="inline-status success">{state.success}</span>;
  return null;
}

export function ApprovalButtons({ profileId }: { profileId: string }) {
  const [approveState, approveAction, approvePending] = useActionState(approveProfile, initial);
  const [rejectState, rejectAction, rejectPending] = useActionState(rejectProfile, initial);
  const [promoteState, promoteAction, promotePending] = useActionState(promoteProfile, initial);

  return (
    <div className="approval-actions">
      <form action={approveAction}><input type="hidden" name="profileId" value={profileId} /><button className="btn primary" disabled={approvePending}>אשר לקוח</button><State state={approveState} /></form>
      <form action={rejectAction}><input type="hidden" name="profileId" value={profileId} /><button className="btn" disabled={rejectPending}>דחה</button><State state={rejectState} /></form>
      <form action={promoteAction}>
        <input type="hidden" name="profileId" value={profileId} />
        <select name="role" aria-label="בחר תפקיד"><option value="admin">Admin</option><option value="super_admin">Super Admin</option><option value="customer">Customer pending</option></select>
        <button className="btn" disabled={promotePending}>עדכן תפקיד</button><State state={promoteState} />
      </form>
    </div>
  );
}
