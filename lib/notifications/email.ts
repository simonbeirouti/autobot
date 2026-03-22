import "server-only";

import { Resend } from "resend";

import { NotificationEmail } from "@/components/emails/notification-email";

let resendClient: Resend | null = null;

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured.");
  }

  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }

  return resendClient;
}

export async function sendNotificationEmail(params: {
  actionLabel?: string | null;
  actionUrl?: string | null;
  body: string;
  recipientEmail: string;
  recipientName?: string | null;
  subject: string;
}) {
  const from = process.env.RESEND_FROM_EMAIL;

  if (!from) {
    throw new Error("RESEND_FROM_EMAIL is not configured.");
  }

  const resend = getResendClient();

  return resend.emails.send({
    from,
    to: params.recipientEmail,
    subject: params.subject,
    react: NotificationEmail({
      actionLabel: params.actionLabel,
      actionUrl: params.actionUrl,
      body: params.body,
      recipientName: params.recipientName,
      title: params.subject,
    }),
  });
}
