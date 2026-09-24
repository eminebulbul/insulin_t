import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  UIManager,
  Dimensions,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { LineChart, BarChart } from "react-native-chart-kit";

import { Colors, FontSize, Spacing, Radius } from "@/constants/theme";
import {
  DayEntry,
  GlucoseMeasurement,
  BloodPressureMeasurement,
  DailyWater,
  getGroupedHistory,
  getGlucoseForChart,
  getBPForChart,
  getDailyWaterForChart,
} from "@/db/queries";
import {
  formatDateKey,
  formatTime,
  formatMealTag,
  relativeDayLabel,
  formatShortDate,
} from "@/utils/dateHelpers";

// Android'de LayoutAnimation için gerekli
if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const SCREEN_WIDTH = Dimensions.get("window").width;
const CHART_WIDTH = SCREEN_WIDTH - Spacing.xl * 2;

// ─── Üst sekme çubuğu ─────────────────────────────────────────────────────────

type Tab = "liste" | "grafik";

function TopTabBar({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <View style={tabStyles.container}>
      {(["liste", "grafik"] as Tab[]).map((t) => (
        <TouchableOpacity
          key={t}
          style={[tabStyles.tab, active === t && tabStyles.activeTab]}
          onPress={() => onChange(t)}
          activeOpacity={0.75}
        >
          <Text
            style={[tabStyles.label, active === t && tabStyles.activeLabel]}
          >
            {t === "liste" ? "📋 Liste" : "📈 Grafik"}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const tabStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: 4,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tab: {
    flex: 1,
    height: 48,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  activeTab: { backgroundColor: Colors.primary },
  label: {
    fontSize: FontSize.md,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  activeLabel: { color: "#fff" },
});

// ─── Ölçüm satırı ─────────────────────────────────────────────────────────────

function MeasurementRow({ m }: { m: GlucoseMeasurement | BloodPressureMeasurement }) {
  const isGlucose = m.type === "glucose";
  const icon = isGlucose ? "🩸" : "💊";
  const time = formatTime(m.recorded_at);
  const mealLabel = isGlucose ? formatMealTag(m.meal_tag) : null;

  const valueText = isGlucose
    ? `${(m as GlucoseMeasurement).glucose_mg} mg/dL`
    : `${(m as BloodPressureMeasurement).bp_systolic}/${(m as BloodPressureMeasurement).bp_diastolic} mmHg`;

  const noteText = isGlucose
    ? (m as GlucoseMeasurement).glucose_note
    : (m as BloodPressureMeasurement).bp_note;

  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.icon}>{icon}</Text>
      <View style={rowStyles.meta}>
        <Text style={rowStyles.time}>{time}</Text>
        {mealLabel ? (
          <Text style={rowStyles.tag}>{mealLabel}</Text>
        ) : null}
      </View>
      <View style={rowStyles.valueBox}>
        <Text
          style={[
            rowStyles.value,
            { color: isGlucose ? Colors.glucose : Colors.bloodPressure },
          ]}
        >
          {valueText}
        </Text>
        {noteText ? (
          <Text style={rowStyles.note}>{noteText}</Text>
        ) : null}
      </View>
    </View>
  );
}

function WaterRow({ ml, isoTime }: { ml: number; isoTime: string }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.icon}>💧</Text>
      <View style={rowStyles.meta}>
        <Text style={rowStyles.time}>{formatTime(isoTime)}</Text>
      </View>
      <View style={rowStyles.valueBox}>
        <Text style={[rowStyles.value, { color: "#58A6FF" }]}>{ml} ml</Text>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  icon: { fontSize: 20, minWidth: 28, marginTop: 2 },
  meta: { width: 90 },
  time: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  tag: {
    fontSize: FontSize.xs,
    color: Colors.textDisabled,
    marginTop: 2,
  },
  valueBox: { flex: 1 },
  value: {
    fontSize: FontSize.md,
    fontWeight: "700",
  },
  note: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    fontStyle: "italic",
  },
});

// ─── Günlük kart (katlanabilir) ───────────────────────────────────────────────

function DayCard({
  day,
  defaultOpen,
}: {
  day: DayEntry;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const glucoseCount = day.measurements.filter((m) => m.type === "glucose").length;
  const glucoseVals = day.measurements
    .filter((m): m is GlucoseMeasurement => m.type === "glucose")
    .map((m) => m.glucose_mg);
  const avgGlucose =
    glucoseVals.length > 0
      ? Math.round(glucoseVals.reduce((a, b) => a + b, 0) / glucoseVals.length)
      : null;

  const bpCount = day.measurements.filter((m) => m.type === "blood_pressure").length;
  const waterTotal = day.waterEntries.reduce((s, w) => s + w.water_ml, 0);
  const totalCount = day.measurements.length + day.waterEntries.length;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  };

  // Tüm kayıtları zamana göre sırala (ölçüm + su karışık)
  type AnyEntry =
    | { kind: "measurement"; data: GlucoseMeasurement | BloodPressureMeasurement }
    | { kind: "water"; data: { id: number; recorded_at: string; water_ml: number } };

  const allEntries: AnyEntry[] = [
    ...day.measurements.map((m) => ({ kind: "measurement" as const, data: m })),
    ...day.waterEntries.map((w) => ({ kind: "water" as const, data: w })),
  ].sort((a, b) => a.data.recorded_at.localeCompare(b.data.recorded_at));

  const relLabel = relativeDayLabel(day.dateKey);

  return (
    <View style={dayStyles.card}>
      {/* Başlık (her zaman görünür) */}
      <TouchableOpacity
        style={dayStyles.header}
        onPress={toggle}
        activeOpacity={0.75}
        accessibilityLabel={`${formatDateKey(day.dateKey)}, ${open ? "kapat" : "aç"}`}
      >
        <View style={dayStyles.headerLeft}>
          <Text style={dayStyles.chevron}>{open ? "▼" : "›"}</Text>
          <View>
            <Text style={dayStyles.dateText}>{formatDateKey(day.dateKey)}</Text>
            <Text style={dayStyles.relLabel}>{relLabel}</Text>
          </View>
        </View>
        <View style={dayStyles.summary}>
          {avgGlucose !== null && (
            <Text style={dayStyles.summaryText}>
              <Text style={{ color: Colors.glucose }}>●</Text> Ort: {avgGlucose} mg/dL
            </Text>
          )}
          <Text style={dayStyles.summaryCount}>{totalCount} kayıt</Text>
        </View>
      </TouchableOpacity>

      {/* Detaylar (açıksa) */}
      {open && (
        <View style={dayStyles.body}>
          {allEntries.length === 0 ? (
            <Text style={dayStyles.empty}>Bu gün kayıt yok.</Text>
          ) : (
            allEntries.map((entry, i) =>
              entry.kind === "measurement" ? (
                <MeasurementRow key={`m-${entry.data.id}`} m={entry.data as GlucoseMeasurement | BloodPressureMeasurement} />
              ) : (
                <WaterRow
                  key={`w-${entry.data.id}`}
                  ml={entry.data.water_ml}
                  isoTime={entry.data.recorded_at}
                />
              )
            )
          )}
          {/* Gün özeti alt satır */}
          <View style={dayStyles.footer}>
            {glucoseCount > 0 && (
              <Text style={dayStyles.footerChip}>🩸 {glucoseCount} şeker</Text>
            )}
            {bpCount > 0 && (
              <Text style={dayStyles.footerChip}>💊 {bpCount} tansiyon</Text>
            )}
            {waterTotal > 0 && (
              <Text style={dayStyles.footerChip}>💧 {waterTotal} ml</Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const dayStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.lg,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    flex: 1,
  },
  chevron: {
    fontSize: 20,
    color: Colors.textSecondary,
    marginTop: 2,
    width: 20,
  },
  dateText: {
    fontSize: FontSize.md,
    fontWeight: "700",
    color: Colors.textPrimary,
    textTransform: "capitalize",
  },
  relLabel: {
    fontSize: FontSize.xs,
    color: Colors.textDisabled,
    marginTop: 2,
  },
  summary: { alignItems: "flex-end" },
  summaryText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  summaryCount: {
    fontSize: FontSize.xs,
    color: Colors.textDisabled,
    marginTop: 2,
  },
  body: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  empty: {
    fontSize: FontSize.sm,
    color: Colors.textDisabled,
    paddingVertical: Spacing.md,
    textAlign: "center",
  },
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  footerChip: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    backgroundColor: Colors.surfaceAlt,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});

// ─── Grafik ortak ayarlar ─────────────────────────────────────────────────────

const chartConfig = {
  backgroundGradientFrom: Colors.surface,
  backgroundGradientTo: Colors.surface,
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(88, 166, 255, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(139, 148, 158, ${opacity})`,
  style: { borderRadius: Radius.md },
  propsForDots: { r: "5", strokeWidth: "2", stroke: Colors.primary },
};

// ─── Grafik sekmesi ───────────────────────────────────────────────────────────

type ChartDays = 7 | 30;

function ChartTab() {
  const [days, setDays] = useState<ChartDays>(7);
  const [glucose, setGlucose] = useState<GlucoseMeasurement[]>([]);
  const [bp, setBp] = useState<BloodPressureMeasurement[]>([]);
  const [water, setWater] = useState<DailyWater[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (d: ChartDays) => {
    setLoading(true);
    try {
      const [g, b, w] = await Promise.all([
        getGlucoseForChart(d),
        getBPForChart(d),
        getDailyWaterForChart(d),
      ]);
      setGlucose(g);
      setBp(b);
      setWater(w);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(days);
  }, [days, load]);

  const handleDaysChange = (d: ChartDays) => {
    setDays(d);
  };

  // ─ Şeker grafik verisi ─
  const glucoseHasData = glucose.length > 0;
  const glucoseData = glucoseHasData
    ? {
        labels: glucose.map((g) => formatTime(g.recorded_at)),
        datasets: [{ data: glucose.map((g) => g.glucose_mg), color: () => Colors.glucose }],
      }
    : null;

  // ─ Tansiyon grafik verisi ─
  const bpHasData = bp.length > 0;
  const bpData = bpHasData
    ? {
        labels: bp.map((b) => formatTime(b.recorded_at)),
        datasets: [
          {
            data: bp.map((b) => b.bp_systolic),
            color: () => Colors.danger,
            strokeWidth: 2,
          },
          {
            data: bp.map((b) => b.bp_diastolic),
            color: () => Colors.bloodPressure,
            strokeWidth: 2,
          },
        ],
      }
    : null;

  // ─ Su bar chart verisi ─
  const waterHasData = water.length > 0;
  const waterData = waterHasData
    ? {
        labels: water.map((w) => formatShortDate(w.dateKey)),
        datasets: [{ data: water.map((w) => w.total_ml) }],
      }
    : null;

  return (
    <View>
      {/* Filtre butonları */}
      <View style={chartStyles.filterRow}>
        {([7, 30] as ChartDays[]).map((d) => (
          <TouchableOpacity
            key={d}
            style={[
              chartStyles.filterBtn,
              days === d && chartStyles.filterBtnActive,
            ]}
            onPress={() => handleDaysChange(d)}
          >
            <Text
              style={[
                chartStyles.filterLabel,
                days === d && chartStyles.filterLabelActive,
              ]}
            >
              Son {d} gün
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={chartStyles.loadingBox}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <>
          {/* Şeker grafiği */}
          <View style={chartStyles.section}>
            <Text style={chartStyles.sectionTitle}>🩸 Kan Şekeri</Text>
            {glucoseData ? (
              <>
                <LineChart
                  data={glucoseData}
                  width={CHART_WIDTH}
                  height={200}
                  chartConfig={{
                    ...chartConfig,
                    color: (opacity = 1) => `rgba(247, 129, 102, ${opacity})`,
                    propsForDots: {
                      r: "5",
                      strokeWidth: "2",
                      stroke: Colors.glucose,
                    },
                  }}
                  bezier
                  style={chartStyles.chart}
                  withInnerLines={false}
                  withOuterLines
                  yAxisSuffix=" mg"
                />
                {/* Öğün renk açıklaması */}
                <View style={chartStyles.legendRow}>
                  {["Açlık", "Tokluk", "Yatmadan Önce", "Diğer"].map((l) => (
                    <Text key={l} style={chartStyles.legendItem}>
                      {l}
                    </Text>
                  ))}
                </View>
              </>
            ) : (
              <EmptyChart message={`Son ${days} günde şeker ölçümü yok`} />
            )}
          </View>

          {/* Tansiyon grafiği */}
          <View style={chartStyles.section}>
            <Text style={chartStyles.sectionTitle}>💊 Tansiyon</Text>
            {bpData ? (
              <>
                <LineChart
                  data={bpData}
                  width={CHART_WIDTH}
                  height={200}
                  chartConfig={{
                    ...chartConfig,
                    color: (opacity = 1) => `rgba(248, 81, 73, ${opacity})`,
                  }}
                  bezier
                  style={chartStyles.chart}
                  withInnerLines={false}
                  yAxisSuffix=" mmHg"
                />
                <View style={chartStyles.legendRow}>
                  <Text style={[chartStyles.legendItem, { color: Colors.danger }]}>
                    ── Sistolik (büyük)
                  </Text>
                  <Text
                    style={[chartStyles.legendItem, { color: Colors.bloodPressure }]}
                  >
                    ── Diastolik (küçük)
                  </Text>
                </View>
              </>
            ) : (
              <EmptyChart message={`Son ${days} günde tansiyon ölçümü yok`} />
            )}
          </View>

          {/* Su bar chart */}
          <View style={chartStyles.section}>
            <Text style={chartStyles.sectionTitle}>💧 Günlük Su</Text>
            {waterData ? (
              <BarChart
                data={waterData}
                width={CHART_WIDTH}
                height={200}
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1) => `rgba(88, 166, 255, ${opacity})`,
                }}
                style={chartStyles.chart}
                withInnerLines={false}
                yAxisSuffix=" ml"
                yAxisLabel=""
                showValuesOnTopOfBars
              />
            ) : (
              <EmptyChart message={`Son ${days} günde su kaydı yok`} />
            )}
          </View>
        </>
      )}
    </View>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <View style={chartStyles.emptyBox}>
      <Text style={chartStyles.emptyText}>{message}</Text>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  filterRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  filterBtn: {
    flex: 1,
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterLabel: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    color: Colors.textSecondary,
  },
  filterLabelActive: { color: "#fff" },
  loadingBox: {
    height: 200,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  chart: {
    borderRadius: Radius.md,
    overflow: "hidden",
  },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  legendItem: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  emptyBox: {
    height: 120,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textDisabled,
  },
});

// ─── Liste sekmesi ─────────────────────────────────────────────────────────────

function ListTab() {
  const [days, setDays] = useState<DayEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getGroupedHistory(30);
      setDays(result);
    } finally {
      setLoading(false);
    }
  }, []);

  // Ekrana her dönüşte yenile (yeni giriş yapılmış olabilir)
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return (
      <View style={listStyles.loading}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  if (days.length === 0) {
    return (
      <View style={listStyles.emptyContainer}>
        <Text style={listStyles.emptyIcon}>📋</Text>
        <Text style={listStyles.emptyTitle}>Henüz kayıt yok</Text>
        <Text style={listStyles.emptyHint}>
          "Giriş" sekmesinden şeker veya tansiyon ölçümü ekleyin.
        </Text>
      </View>
    );
  }

  return (
    <>
      <Text style={listStyles.subtitle}>Son 30 günün kayıtları</Text>
      {days.map((day, i) => (
        <DayCard key={day.dateKey} day={day} defaultOpen={i === 0} />
      ))}
    </>
  );
}

const listStyles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 200,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xxxl,
  },
  emptyIcon: { fontSize: 56, marginBottom: Spacing.lg },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: "700",
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  emptyHint: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 26,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textDisabled,
    marginBottom: Spacing.md,
  },
});

// ─── Ana ekran ────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const [activeTab, setActiveTab] = useState<Tab>("liste");

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <TopTabBar active={activeTab} onChange={setActiveTab} />
      {activeTab === "liste" ? <ListTab /> : <ChartTab />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  content: {
    padding: Spacing.xl,
    paddingBottom: 80,
  },
});
