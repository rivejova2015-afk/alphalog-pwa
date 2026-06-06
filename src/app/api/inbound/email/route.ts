/**
 * Inbound Email Webhook (Postmark)
 * Sprint 13: Receive encrypted emails via Postmark Inbound
 * 
 * Runtime: Node.js (required for crypto validation)
 * 
 * SECURITY CRITICAL:
 * - Validate webhook signature
 * - Reject unauthorized senders
 * - Store only ciphertext
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { encryptText } from '@/lib/security/encryption';
import { logError, logInfo, logWarn } from '@/lib/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PostmarkInboundMessage {
  MessageID: string;
  From: string;
  FromName: string;
  To: string;
  Cc?: string;
  Bcc?: string;
  Subject: string;
  TextBody: string;
  HtmlBody: string;
  Date: string;
  StrippedTextReply?: string;
  Tag?: string;
  Headers: Array<{ Name: string; Value: string }>;
  Attachments: Array<{
    Name: string;
    Content: string; // base64
    ContentType: string;
    ContentLength: number;
  }>;
}

function validateWebhookSignature(body: string, signature: string | null): boolean {
  if (!signature || !process.env.POSTMARK_INBOUND_WEBHOOK_SECRET) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', process.env.POSTMARK_INBOUND_WEBHOOK_SECRET)
    .update(body)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-postmark-signature');

    // Validate webhook signature
    if (!validateWebhookSignature(body, signature)) {
      logError('InboundEmail', { component: 'postmark.signatureValidation', message: 'Invalid webhook signature' });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const inboundMessage: PostmarkInboundMessage = JSON.parse(body);

    // Extract sender and recipient
    const fromEmail = inboundMessage.From.toLowerCase();
    const toEmail = inboundMessage.To.toLowerCase();

    // Initialize Supabase client (server)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Find mailbox
    const { data: mailbox, error: mailboxError } = await supabase
      .from('secure_mailboxes')
      .select('*')
      .eq('email_alias', toEmail)
      .is('deleted_at', null)
      .single();

    if (mailboxError || !mailbox) {
      logError('InboundEmail', { component: 'postmark.resolveMailbox', message: `Mailbox not found for ${toEmail}`, toEmail });
      return NextResponse.json({ error: 'Mailbox not found' }, { status: 404 });
    }

    // Check if sender is allowed
    const { data: allowedSender, error: allowedError } = await supabase
      .from('secure_allowed_senders')
      .select('*')
      .eq('mailbox_id', mailbox.id)
      .eq('sender_email', fromEmail)
      .eq('is_active', true)
      .is('deleted_at', null)
      .single();

    if (allowedError || !allowedSender) {
      logWarn("InboundEmail", "Unauthorized sender rejected", { component: "inbound.email.unauthorizedSender", fromEmail, toEmail });
      // REJECT: Do not store, do not notify
      return NextResponse.json({ message: 'Sender not authorized' }, { status: 200 });
    }

    // Store message (already encrypted by sender, we just store ciphertext)
    const subjectCiphertext = encryptText(inboundMessage.Subject);
    const bodyCiphertext = encryptText(inboundMessage.TextBody || inboundMessage.HtmlBody);

    if (!subjectCiphertext || !bodyCiphertext) {
      return NextResponse.json({ error: 'Encryption key missing' }, { status: 500 });
    }

    const { data: message, error: messageError } = await supabase
      .from('secure_messages')
      .insert({
        user_id: mailbox.user_id,
        mailbox_id: mailbox.id,
        provider_message_id: inboundMessage.MessageID,
        from_email: fromEmail,
        to_email: toEmail,
        subject_ciphertext: subjectCiphertext,
        body_ciphertext: bodyCiphertext,
        received_at: new Date(inboundMessage.Date).toISOString(),
        direction: 'inbound',
        status: 'received',
        meta: {
          from_name: inboundMessage.FromName,
          headers: inboundMessage.Headers,
        },
      })
      .select()
      .single();

    if (messageError || !message) {
      logError('InboundEmail', { component: 'postmark.storeMessage', message: messageError?.message ?? 'message insert returned no row' });
      return NextResponse.json({ error: 'Failed to store message' }, { status: 500 });
    }

    // Store attachments (encrypted)
    if (inboundMessage.Attachments && inboundMessage.Attachments.length > 0) {
      const maxSize = parseInt(process.env.SECURE_MAIL_MAX_EMAIL_ATTACHMENT_BYTES || '10485760');

      for (const attachment of inboundMessage.Attachments) {
        if (attachment.ContentLength > maxSize) {
          logWarn("InboundEmail", "Attachment too large", { component: "inbound.email.attachmentTooLarge", name: attachment.Name, size: attachment.ContentLength });
          continue;
        }

        const attachmentData = Buffer.from(attachment.Content, 'base64');
        const storagePath = `${mailbox.user_id}/${message.id}/${crypto.randomUUID()}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('secure-mail')
          .upload(storagePath, attachmentData, {
            contentType: attachment.ContentType,
            cacheControl: '3600',
          });

        if (uploadError) {
          logError('InboundEmail', { component: 'postmark.uploadAttachment', message: uploadError instanceof Error ? uploadError.message : String(uploadError) });
          continue;
        }

        // Store attachment metadata
        const filenameCiphertext = encryptText(attachment.Name);
        if (!filenameCiphertext) {
          logWarn("InboundEmail", "Skipping attachment due to encryption error", { component: "inbound.email.attachmentEncryptionError", name: attachment.Name });
          continue;
        }

        await supabase.from('secure_attachments').insert({
          user_id: mailbox.user_id,
          message_id: message.id,
          filename_ciphertext: filenameCiphertext,
          mime_type: attachment.ContentType,
          size_bytes: attachment.ContentLength,
          storage_path: storagePath,
        });
      }
    }

    logInfo("InboundEmail", "Inbound message stored", { component: "inbound.email.stored", messageId: message.id, fromEmail, toEmail });

    return NextResponse.json({ message: 'Message received' }, { status: 200 });
  } catch (error) {
    logError('InboundEmail', { component: 'postmark.handler', message: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
