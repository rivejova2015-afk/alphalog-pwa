/**
 * Outbound Email Send API
 * Sprint 13: Send encrypted emails via Postmark
 * 
 * Runtime: Node.js (required for Postmark SDK)
 * 
 * SECURITY CRITICAL:
 * - Verify user authentication
 * - Encrypt message with recipient's public key
 * - Log send event in audit trail
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ServerClient } from 'postmark';
import { encryptText } from '@/lib/security/encryption';
import { logAuditEvent } from '@/lib/security/auditLog';
import { sendEmailResponseSchema, sendEmailSchema, validatePayloadSafe, validationErrorResponse } from '@/lib/validation/schemas';
import { recordBugFromRequest } from '@/lib/security/bugRecorder';
import { retryAsync, isRetryableError } from '@/lib/security/retry';
import { autoFixSendEmail } from '@/lib/validation/autoFix';
import { enforceResponseContract } from '@/lib/validation/contractGuard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get auth token from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const rawBody = await request.json();
    const fixed = autoFixSendEmail(rawBody as Record<string, unknown>);

    if (fixed.changed) {
      logAuditEvent({
        userId: user.id,
        action: 'api_call',
        resourceType: 'secure_mail',
        status: 'partial',
        changes: { auto_fix: fixed.changes },
        ipHint: request.headers.get('x-forwarded-for') || 'unknown',
      }).catch(e => console.warn('[Audit] Failed to log auto-fix:', e));
    }

    const validation = validatePayloadSafe(sendEmailSchema, fixed.data);

    if (!validation.success) {
      logAuditEvent({
        userId: user.id,
        action: 'api_call',
        resourceType: 'secure_mail',
        status: 'failure',
        errorMessage: `Validation failed: ${Object.values(validation.errors).join("; ")}`,
        ipHint: request.headers.get('x-forwarded-for') || 'unknown',
      }).catch(e => console.warn('[Audit] Failed to log validation error:', e));

      return NextResponse.json(
        validationErrorResponse(validation.errors),
        { status: 400 }
      );
    }

    const { mailbox_id, to_email, subject_ciphertext, body_ciphertext, attachments } = validation.data;

    // Verify mailbox ownership
    const { data: mailbox, error: mailboxError } = await supabase
      .from('secure_mailboxes')
      .select('*')
      .eq('id', mailbox_id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (mailboxError || !mailbox) {
      return NextResponse.json({ error: 'Mailbox not found' }, { status: 404 });
    }

    // Check recipient has public key
    const { data: contactKey } = await supabase
      .from('secure_contacts_keys')
      .select('pgp_public_key')
      .eq('user_id', user.id)
      .eq('contact_email', to_email.toLowerCase())
      .is('deleted_at', null)
      .single();

    if (!contactKey) {
      return NextResponse.json(
        { error: 'Recipient public key not found. Add recipient to contacts first.' },
        { status: 400 }
      );
    }

    // Create message record
    const subjectCiphertextStored = encryptText(subject_ciphertext);
    const bodyCiphertextStored = encryptText(body_ciphertext);

    if (!subjectCiphertextStored || !bodyCiphertextStored) {
      return NextResponse.json({ error: 'Encryption key missing' }, { status: 500 });
    }

    const { data: message, error: messageError } = await supabase
      .from('secure_messages')
      .insert({
        user_id: user.id,
        mailbox_id: mailbox.id,
        from_email: mailbox.email_alias,
        to_email: to_email.toLowerCase(),
        subject_ciphertext: subjectCiphertextStored,
        body_ciphertext: bodyCiphertextStored,
        direction: 'outbound',
        status: 'queued',
      })
      .select()
      .single();

    if (messageError || !message) {
      console.error('Failed to create message record:', messageError);
      await recordBugFromRequest(request, {
        userId: user.id,
        status: 500,
        error: messageError || new Error('Missing message record'),
        payload: { mailbox_id, to_email },
      });
      return NextResponse.json({ error: 'Failed to create message' }, { status: 500 });
    }

    // Initialize Postmark client
    if (!process.env.POSTMARK_SERVER_TOKEN) {
      throw new Error('POSTMARK_SERVER_TOKEN not configured');
    }

    const client = new ServerClient(process.env.POSTMARK_SERVER_TOKEN);

    // Send email via Postmark
    try {
      const result = await retryAsync(
        () => client.sendEmail({
          From: mailbox.email_alias,
          To: to_email,
          Subject: subject_ciphertext, // Encrypted subject
          TextBody: body_ciphertext, // Encrypted body
          Attachments: attachments?.map((att) => ({
            Name: att.filename,
            Content: att.content_base64,
            ContentType: att.content_type,
            ContentID: null,
          })) as any,
        }),
        {
          retries: 2,
          minDelayMs: 400,
          maxDelayMs: 2000,
          shouldRetry: isRetryableError,
          onRetry: (error, attempt, delayMs) => {
            console.warn(`[SecureMail] Retry ${attempt} in ${delayMs}ms:`, error instanceof Error ? error.message : error);
          },
        }
      );

      // Update message status
      await supabase
        .from('secure_messages')
        .update({
          status: 'sent',
          provider_message_id: result.MessageID,
        })
        .eq('id', message.id);

      // Log send event
      await supabase.from('secure_message_access_audit').insert({
        user_id: user.id,
        message_id: message.id,
        event: 'send',
      });

      logAuditEvent({
        userId: user.id,
        action: 'create',
        resourceType: 'secure_mail',
        resourceId: message.id,
        changes: { to_email, subject_ciphertext: subject_ciphertext.slice(0, 50) },
        ipHint: request.headers.get('x-forwarded-for') || 'unknown',
      }).catch(e => console.warn('[Audit] Failed to log email send:', e));

      console.log('Email sent:', message.id, mailbox.email_alias, '→', to_email);

      const responsePayload = {
        success: true,
        message_id: message.id,
        provider_message_id: result.MessageID,
      };

      const responseCheck = enforceResponseContract(sendEmailResponseSchema, responsePayload);

      if (!responseCheck.ok) {
        await recordBugFromRequest(request, {
          userId: user.id,
          status: 500,
          error: new Error('Response contract violation'),
          payload: { errors: responseCheck.errors },
        });

        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }

      return NextResponse.json(responseCheck.data, { status: 200 });
    } catch (sendError) {
      console.error('Postmark send error:', sendError);
      await recordBugFromRequest(request, {
        userId: user.id,
        status: 500,
        error: sendError,
        payload: { mailbox_id, to_email, message_id: message.id },
      });

      // Update message status to failed
      await supabase
        .from('secure_messages')
        .update({ status: 'failed' })
        .eq('id', message.id);

      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }
  } catch (error) {
    console.error('Outbound send error:', error);
    await recordBugFromRequest(request, {
      userId: null,
      status: 500,
      error,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
