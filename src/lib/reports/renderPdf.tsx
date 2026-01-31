import React from "react";
import { Document, Page, StyleSheet, Text, View, pdf } from "@react-pdf/renderer";
import type { ReportBuild } from "./types";

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: "#0f172a",
  },
  title: {
    fontSize: 18,
    marginBottom: 8,
    fontWeight: 700,
  },
  summary: {
    marginBottom: 16,
    color: "#334155",
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    marginBottom: 6,
    fontWeight: 600,
  },
  bullet: {
    marginBottom: 4,
    marginLeft: 10,
  },
});
const toNodeBuffer = async (data: unknown): Promise<Buffer> => {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) return Buffer.from(data);
  if (data instanceof ArrayBuffer) return Buffer.from(new Uint8Array(data));
  if (data && typeof (data as { getReader?: () => unknown }).getReader === "function") {
    const reader = (data as ReadableStream<Uint8Array>).getReader();
    const chunks: Uint8Array[] = [];
    let result = await reader.read();
    while (!result.done) {
      if (result.value) chunks.push(result.value);
      result = await reader.read();
    }
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
  }
  throw new Error("Unsupported PDF buffer type");
};
export const renderReportPdf = async (report: ReportBuild): Promise<Buffer> => {
  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{report.title}</Text>
        <Text style={styles.summary}>{report.summary}</Text>
        {report.sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.bullets.map((bullet, idx) => (
              <Text key={`${section.title}-${idx}`} style={styles.bullet}>
                • {bullet}
              </Text>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );

  const instance = pdf(doc);
  const buffer = await instance.toBuffer();
  return toNodeBuffer(buffer);
};
