"use client";

import { useEffect, useState } from "react";
import { BarChart3, Download, RotateCcw, TrendingUp } from "lucide-react";
import {
  calculateABTestResults,
  getVariantRecommendation,
  exportABTestResults,
  resetABTestData,
  type ABTestResults,
} from "@/lib/securities/cybersec/adhd-ab-testing";

interface Props {
  showRawData?: boolean;
}

export function ABTestingDashboard({ showRawData = false }: Props) {
  const [results, setResults] = useState<ABTestResults | null>(null);
  const [recommendation, setRecommendation] = useState<any>(null);

  useEffect(() => {
    const testResults = calculateABTestResults();
    setResults(testResults);

    const rec = getVariantRecommendation();
    setRecommendation(rec);
  }, []);

  const handleDownload = () => {
    const data = exportABTestResults();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ab-test-results-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    if (confirm("⚠️ Reset all A/B test data? This cannot be undone.")) {
      resetABTestData();
      setResults(null);
      setRecommendation(null);
    }
  };

  if (!results) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
        <p className="text-sm text-slate-400">No session data yet.</p>
      </div>
    );
  }

  const { summary } = results;
  const hasData =
    summary.controlMetrics.length > 0 || summary.treatmentMetrics.length > 0;

  if (!hasData) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
        <p className="text-sm text-slate-400">
          Run some quiz sessions to start collecting A/B test data.
        </p>
      </div>
    );
  }

  const getMetricColor = (value: number): string => {
    if (value > 10) return "text-green-400";
    if (value > 0) return "text-cyan-400";
    if (value > -10) return "text-amber-400";
    return "text-red-400";
  };

  const getMetricBg = (value: number): string => {
    if (value > 10) return "bg-green-500/10";
    if (value > 0) return "bg-cyan-500/10";
    if (value > -10) return "bg-amber-500/10";
    return "bg-red-500/10";
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={18} className="text-cyan-400" />
          <h3 className="text-sm font-bold text-slate-200">A/B Test Results</h3>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDownload}
            className="text-xs px-2 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 transition-colors flex items-center gap-1"
          >
            <Download size={12} />
            Export
          </button>
          <button
            onClick={handleReset}
            className="text-xs px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors flex items-center gap-1"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        </div>
      </div>

      {/* Recommendation */}
      {recommendation && (
        <div
          className={`rounded-lg p-3 border ${
            recommendation.recommendation === "treatment"
              ? "border-green-500/30 bg-green-500/5"
              : "border-blue-500/30 bg-blue-500/5"
          }`}
        >
          <div className="flex items-start gap-2">
            <TrendingUp
              size={16}
              className={recommendation.recommendation === "treatment" ? "text-green-400" : "text-blue-400"}
            />
            <div>
              <p className="text-sm font-bold text-slate-100">
                🎯 {recommendation.recommendation === "treatment" ? "Treatment" : "Control"}{" "}
                Recommended
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {recommendation.reason}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Confidence: {recommendation.confidence.toFixed(0)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Session Counts */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-slate-700/30 p-2 border border-slate-700">
          <p className="text-xs text-slate-400">Control Sessions</p>
          <p className="text-lg font-bold text-slate-200">
            {summary.controlMetrics.length}
          </p>
        </div>
        <div className="rounded-lg bg-slate-700/30 p-2 border border-slate-700">
          <p className="text-xs text-slate-400">Treatment Sessions</p>
          <p className="text-lg font-bold text-slate-200">
            {summary.treatmentMetrics.length}
          </p>
        </div>
      </div>

      {/* Key Metrics Comparison */}
      <div className="space-y-2">
        {/* Accuracy */}
        <div className="rounded-lg p-3 border border-slate-700 bg-slate-700/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300">
              Accuracy
            </span>
            <span
              className={`text-xs font-bold ${getMetricColor(
                summary.accuracyImprovement
              )}`}
            >
              {summary.accuracyImprovement > 0 ? "+" : ""}
              {summary.accuracyImprovement.toFixed(1)}%
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <span className="text-slate-400">
              Control: {(summary.avgAccuracyControl * 100).toFixed(1)}%
            </span>
            <span className="text-slate-400">
              Treatment: {(summary.avgAccuracyTreatment * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* XP Earned */}
        <div className="rounded-lg p-3 border border-slate-700 bg-slate-700/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300">
              XP Earned
            </span>
            <span
              className={`text-xs font-bold ${getMetricColor(summary.xpImprovement)}`}
            >
              {summary.xpImprovement > 0 ? "+" : ""}
              {summary.xpImprovement.toFixed(1)}%
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <span className="text-slate-400">
              Control: {summary.avgXpControl.toFixed(0)} XP
            </span>
            <span className="text-slate-400">
              Treatment: {summary.avgXpTreatment.toFixed(0)} XP
            </span>
          </div>
        </div>

        {/* Badge Unlock Rate */}
        <div className="rounded-lg p-3 border border-slate-700 bg-slate-700/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300">
              Badge Unlock Rate
            </span>
            <span
              className={`text-xs font-bold ${getMetricColor(
                summary.badgeUnlockImprovement
              )}`}
            >
              {summary.badgeUnlockImprovement > 0 ? "+" : ""}
              {summary.badgeUnlockImprovement.toFixed(1)}%
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <span className="text-slate-400">
              Control: {summary.badgeUnlockRateControl.toFixed(2)} /session
            </span>
            <span className="text-slate-400">
              Treatment: {summary.badgeUnlockRateTreatment.toFixed(2)} /session
            </span>
          </div>
        </div>

        {/* Session Duration */}
        <div className="rounded-lg p-3 border border-slate-700 bg-slate-700/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-300">
              Avg Duration
            </span>
            <span
              className={`text-xs font-bold ${getMetricColor(
                -summary.durationImprovement
              )}`}
            >
              {-summary.durationImprovement > 0 ? "+" : ""}
              {(-summary.durationImprovement).toFixed(1)}%
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <span className="text-slate-400">
              Control:{" "}
              {(summary.avgSessionDurationControl / 1000 / 60).toFixed(1)} min
            </span>
            <span className="text-slate-400">
              Treatment:{" "}
              {(summary.avgSessionDurationTreatment / 1000 / 60).toFixed(1)} min
            </span>
          </div>
        </div>

        {/* Satisfaction */}
        {(summary.avgSatisfactionControl > 0 ||
          summary.avgSatisfactionTreatment > 0) && (
          <div className="rounded-lg p-3 border border-slate-700 bg-slate-700/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300">
                User Satisfaction
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <span className="text-slate-400">
                Control: {summary.avgSatisfactionControl.toFixed(2)} /5
              </span>
              <span className="text-slate-400">
                Treatment: {summary.avgSatisfactionTreatment.toFixed(2)} /5
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Statistical Significance */}
      <div className="text-xs text-slate-400 pt-2 border-t border-slate-700">
        <p>
          📊{" "}
          {summary.statisticalSignificance
            ? "✓ Results show statistical significance (p < 0.05)"
            : "△ Not statistically significant yet. Continue collecting data."}
        </p>
      </div>

      {/* Raw Data Toggle */}
      {showRawData && results.controlMetrics.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-slate-400 hover:text-slate-300">
            🔍 View Raw Data
          </summary>
          <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
            <pre className="text-[9px] bg-slate-900 p-2 rounded overflow-x-auto">
              {JSON.stringify(
                {
                  control: results.controlMetrics.slice(0, 3),
                  treatment: results.treatmentMetrics.slice(0, 3),
                },
                null,
                2
              )}
            </pre>
          </div>
        </details>
      )}
    </div>
  );
}
