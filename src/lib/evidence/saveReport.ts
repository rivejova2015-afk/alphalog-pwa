import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import type { ReportBuild } from "@/lib/reports/types";
import { renderReportPdf } from "@/lib/reports/renderPdf";
import { encryptText } from "@/lib/security/encryption";

type SaveReportInput = {
  userId: string;
  instrumentId?: string | null;
  report: ReportBuild;
};

const getAdminClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase admin configuration");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
};

export const saveReportEvidence = async ({
  userId,
  instrumentId,
  report,
}: SaveReportInput) => {
  const supabase = getAdminClient();

  const { data: reportRow, error: reportError } = await supabase
    .from("terminal_evidence_reports")
    .insert({
      user_id: userId,
      instrument_id: instrumentId ?? null,
      title: encryptText(report.title),
      content: encryptText(report.markdown),
    })
    .select()
    .single();

  if (reportError || !reportRow) {
    throw new Error(reportError?.message || "Failed to save report");
  }

  const reportId = reportRow.id as string;

  const htmlBuffer = Buffer.from(report.html, "utf-8");
  const pdfBuffer = await renderReportPdf(report);

  const attachments = [
    {
      filename: `${report.asset}_report.html`,
      mimeType: "text/html",
      data: htmlBuffer,
    },
    {
      filename: `${report.asset}_report.pdf`,
      mimeType: "application/pdf",
      data: pdfBuffer,
    },
  ];

  for (const attachment of attachments) {
    const uuid = randomUUID();
    const path = `${userId}/terminal/evidence/${reportId}/${uuid}_${attachment.filename}`;
    const { error: uploadError } = await supabase.storage
      .from("log_attachments")
      .upload(path, attachment.data, {
        cacheControl: "3600",
        upsert: false,
        contentType: attachment.mimeType,
      });

    if (uploadError) {
      throw new Error(uploadError.message || "Failed to upload attachment");
    }

    const { error: attachmentError } = await supabase
      .from("terminal_evidence_attachments")
      .insert({
        user_id: userId,
        report_id: reportId,
        path,
        filename: attachment.filename,
        mime_type: attachment.mimeType,
        size_bytes: attachment.data.length,
      });

    if (attachmentError) {
      await supabase.storage.from("log_attachments").remove([path]);
      throw new Error(
        attachmentError.message || "Failed to save attachment record"
      );
    }
  }

  return { reportId };
};
