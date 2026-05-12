"use client";

import { useActionState, useState } from "react";
import { approveProfile, approveTradeApplication, promoteProfile, rejectProfile, rejectTradeApplication } from "./actions";

const initial = {} as { error?: string; success?: string; inviteLink?: string; emailSent?: boolean; emailProvider?: string };

function State({ state }: { state: typeof initial }) {
  const [copied, setCopied] = useState(false);
  if (state.error) return <span className="inline-status error">{state.error}</span>;
  if (!state.success) return null;
  return (
    <span className="inline-status success">
      {state.success}
      {state.inviteLink ? (
        <span className="invite-link-box">
          <input readOnly value={state.inviteLink} aria-label="Secure one-time invite link" />
          <button
            className="btn"
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(state.inviteLink || "");
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy customer link"}
          </button>
        </span>
      ) : null}
    </span>
  );
}

export function TradeApplicationButtons({ applicationId }: { applicationId: string }) {
  const [approveState, approveAction, approvePending] = useActionState(approveTradeApplication, initial);
  const [rejectState, rejectAction, rejectPending] = useActionState(rejectTradeApplication, initial);

  return (
    <div className="approval-actions">
      <form action={approveAction}>
        <input type="hidden" name="applicationId" value={applicationId} />
        <button className="btn primary" disabled={approvePending}>Approve and send invite</button>
        <State state={approveState} />
      </form>
      <form action={rejectAction}>
        <input type="hidden" name="applicationId" value={applicationId} />
        <button className="btn" disabled={rejectPending}>Reject request</button>
        <State state={rejectState} />
      </form>
    </div>
  );
}

export function ApprovalButtons({ profileId, role, accountStatus, isAllowedStaff }: { profileId: string; role: string; accountStatus: string; isAllowedStaff: boolean }) {
  const [approveState, approveAction, approvePending] = useActionState(approveProfile, initial);
  const [rejectState, rejectAction, rejectPending] = useActionState(rejectProfile, initial);
  const [promoteState, promoteAction, promotePending] = useActionState(promoteProfile, initial);
  const isStaff = role === "admin" || role === "super_admin";
  const canShowStaffRoleControl = isAllowedStaff && isStaff;
  const isCustomer = role === "customer";
  const isPendingCustomer = isCustomer && accountStatus !== "approved";

  return (
    <div className="approval-actions">
      {isPendingCustomer ? (
        <>
          <form action={approveAction}><input type="hidden" name="profileId" value={profileId} /><button className="btn primary" disabled={approvePending}>Approve customer</button><State state={approveState} /></form>
          <form action={rejectAction}><input type="hidden" name="profileId" value={profileId} /><button className="btn" disabled={rejectPending}>Reject</button><State state={rejectState} /></form>
        </>
      ) : null}
      {isCustomer && accountStatus === "approved" ? <span className="muted">Customer account</span> : null}
      {canShowStaffRoleControl ? (
        <form action={promoteAction}>
          <input type="hidden" name="profileId" value={profileId} />
          <select name="role" aria-label="Select staff role" defaultValue={role}><option value="admin">Admin</option><option value="super_admin">Super Admin</option></select>
          <button className="btn" disabled={promotePending}>Update staff role</button><State state={promoteState} />
        </form>
      ) : null}
      {!isCustomer && !canShowStaffRoleControl ? <span className="muted">Protected staff account</span> : null}
    </div>
  );
}
