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
  return Buffer.from(buffer);
};
