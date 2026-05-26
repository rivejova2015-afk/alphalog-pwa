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
      console.error('Invalid webhook signature');
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
      console.error('Mailbox not found:', toEmail);
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
      console.warn('Unauthorized sender rejected:', fromEmail, '→', toEmail);
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
      console.error('Failed to store message:', messageError);
      return NextResponse.json({ error: 'Failed to store message' }, { status: 500 });
    }

    // Store attachments (encrypted)
    if (inboundMessage.Attachments && inboundMessage.Attachments.length > 0) {
      const maxSize = parseInt(process.env.SECURE_MAIL_MAX_EMAIL_ATTACHMENT_BYTES || '10485760');

      for (const attachment of inboundMessage.Attachments) {
        if (attachment.ContentLength > maxSize) {
          console.warn('Attachment too large:', attachment.Name, attachment.ContentLength);
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
          console.error('Failed to upload attachment:', uploadError);
          continue;
        }

        // Store attachment metadata
        const filenameCiphertext = encryptText(attachment.Name);
        if (!filenameCiphertext) {
          console.warn('Skipping attachment due to encryption error:', attachment.Name);
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

    console.log('Inbound message stored:', message.id, fromEmail, '→', toEmail);

    return NextResponse.json({ message: 'Message received' }, { status: 200 });
  } catch (error) {
    console.error('Inbound webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
