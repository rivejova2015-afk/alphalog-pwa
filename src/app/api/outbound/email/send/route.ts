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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SendEmailRequest {
  mailbox_id: string;
  to_email: string;
  subject_ciphertext: string;
  body_ciphertext: string;
  attachments?: Array<{
    filename: string;
    content_base64: string;
    content_type: string;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: SendEmailRequest = await request.json();
    const { mailbox_id, to_email, subject_ciphertext, body_ciphertext, attachments } = body;

    // Validate input
    if (!mailbox_id || !to_email || !subject_ciphertext || !body_ciphertext) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

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
    const { data: message, error: messageError } = await supabase
      .from('secure_messages')
      .insert({
        user_id: user.id,
        mailbox_id: mailbox.id,
        from_email: mailbox.email_alias,
        to_email: to_email.toLowerCase(),
        subject_ciphertext,
        body_ciphertext,
        direction: 'outbound',
        status: 'queued',
      })
      .select()
      .single();

    if (messageError || !message) {
      console.error('Failed to create message record:', messageError);
      return NextResponse.json({ error: 'Failed to create message' }, { status: 500 });
    }

    // Initialize Postmark client
    if (!process.env.POSTMARK_SERVER_TOKEN) {
      throw new Error('POSTMARK_SERVER_TOKEN not configured');
    }

    const client = new ServerClient(process.env.POSTMARK_SERVER_TOKEN);

    // Send email via Postmark
    try {
      const result = await client.sendEmail({
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
      });

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

      console.log('Email sent:', message.id, mailbox.email_alias, '→', to_email);

      return NextResponse.json(
        {
          success: true,
          message_id: message.id,
          provider_message_id: result.MessageID,
        },
        { status: 200 }
      );
    } catch (sendError) {
      console.error('Postmark send error:', sendError);

      // Update message status to failed
      await supabase
        .from('secure_messages')
        .update({ status: 'failed' })
        .eq('id', message.id);

      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }
  } catch (error) {
    console.error('Outbound send error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
