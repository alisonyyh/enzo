import { useState, useMemo } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import {
  format,
  subDays,
  subMonths,
  startOfDay,
  isSameDay,
  differenceInDays,
} from 'date-fns';
import type { WeightLog } from '../../lib/database.types';
import { LogWeightSheet } from './LogWeightSheet';

// ─── Types ───

type TimeRange = 'W' | 'M' | '6M' | 'Y';

interface WeightHistoryProps {
  weightLogs: WeightLog[];
  puppyId: string;
  userId: string;
  puppyCreatedAt: string;
  defaultUnit: string;
  onBack: () => void;
  onAddWeight: (data: {
    weight_value: number;
    weight_unit: string;
    logged_at: string;
    note: string | null;
  }) => Promise<void>;
  onEditWeight: (
    id: string,
    data: {
      weight_value?: number;
      weight_unit?: string;
      logged_at?: string;
      note?: string | null;
    }
  ) => Promise<void>;
  onDeleteWeight: (id: string) => Promise<void>;
}

// ─── Helpers ───

function convertWeight(value: number, fromUnit: string, toUnit: string): number {
  if (fromUnit === toUnit) return value;
  if (fromUnit === 'lbs' && toUnit === 'kg') return value * 0.453592;
  if (fromUnit === 'kg' && toUnit === 'lbs') return value / 0.453592;
  return value;
}

function getDateRange(range: TimeRange): { start: Date; end: Date } {
  const end = startOfDay(new Date());
  switch (range) {
    case 'W':
      return { start: subDays(end, 6), end };
    case 'M':
      return { start: subDays(end, 29), end };
    case '6M':
      return { start: subMonths(end, 6), end };
    case 'Y':
      return { start: subMonths(end, 12), end };
  }
}

function formatDateRange(range: TimeRange, start: Date, end: Date): string {
  const startMonth = format(start, 'MMM');
  const endMonth = format(end, 'MMM');
  const endYear = format(end, 'yyyy');

  if (range === 'W') {
    if (startMonth === endMonth) {
      return `${format(start, 'd')}–${format(end, 'd')} ${endMonth} ${endYear}`;
    }
    return `${format(start, 'd')} ${startMonth} – ${format(end, 'd')} ${endMonth} ${endYear}`;
  }
  if (range === 'M') {
    if (startMonth === endMonth) {
      return `${format(start, 'd')}–${format(end, 'd')} ${endMonth} ${endYear}`;
    }
    return `${format(start, 'd MMM')} – ${format(end, 'd MMM')} ${endYear}`;
  }
  if (format(start, 'yyyy') === endYear) {
    return `${startMonth} – ${endMonth} ${endYear}`;
  }
  return `${startMonth} ${format(start, 'yyyy')} – ${endMonth} ${endYear}`;
}

/** Generate nice Y-axis tick values that encompass the data range */
function computeYTicks(minVal: number, maxVal: number): number[] {
  const rawRange = maxVal - minVal;
  // Determine step size: 0.5, 1, 2, 5, 10, etc.
  let step = 1;
  if (rawRange <= 2) step = 0.5;
  else if (rawRange <= 5) step = 1;
  else if (rawRange <= 15) step = 2;
  else if (rawRange <= 30) step = 5;
  else step = 10;

  const tickMin = Math.floor(minVal / step) * step;
  const tickMax = Math.ceil(maxVal / step) * step;
  const ticks: number[] = [];
  for (let v = tickMin; v <= tickMax + step * 0.01; v += step) {
    ticks.push(Math.round(v * 10) / 10);
  }
  // Ensure at least 3 ticks
  if (ticks.length < 3) {
    ticks.unshift(ticks[0] - step);
    ticks.push(ticks[ticks.length - 1] + step);
  }
  return ticks;
}

/** Get x-axis labels based on time range */
function getXAxisLabels(
  range: TimeRange,
  start: Date,
  end: Date
): { label: string; date: Date }[] {
  const labels: { label: string; date: Date }[] = [];
  const totalDays = differenceInDays(end, start);

  if (range === 'W') {
    // Each day of the week
    for (let i = 0; i <= 6; i++) {
      const d = subDays(end, 6 - i);
      labels.push({ label: format(d, 'EEE'), date: d });
    }
  } else if (range === 'M') {
    // ~5 labels across the month
    const step = Math.max(1, Math.floor(totalDays / 5));
    for (let i = 0; i <= totalDays; i += step) {
      const d = subDays(end, totalDays - i);
      labels.push({ label: format(d, 'MMM d'), date: d });
    }
    // Always include the end date if not already there
    const last = labels[labels.length - 1];
    if (!isSameDay(last.date, end)) {
      labels.push({ label: format(end, 'MMM d'), date: end });
    }
  } else {
    // 6M or Y — show month labels
    const months = range === '6M' ? 6 : 12;
    const step = range === 'Y' ? 2 : 1;
    for (let i = months; i >= 0; i -= step) {
      const d = subMonths(end, i);
      labels.push({ label: format(d, 'MMM'), date: startOfDay(d) });
    }
  }

  return labels;
}

// ─── Time Range Selector ───

function TimeRangeSelector({
  value,
  onChange,
}: {
  value: TimeRange;
  onChange: (r: TimeRange) => void;
}) {
  const options: { value: TimeRange; label: string }[] = [
    { value: 'W', label: 'W' },
    { value: 'M', label: 'M' },
    { value: '6M', label: '6M' },
    { value: 'Y', label: 'Y' },
  ];

  return (
    <div className="flex bg-accent rounded-xl p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
            value === opt.value
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Apple Health–Style Chart ───

function HealthChart({
  logs,
  range,
  displayUnit,
}: {
  logs: WeightLog[];
  range: TimeRange;
  displayUnit: string;
}) {
  const { start, end } = getDateRange(range);
  const totalDays = differenceInDays(end, start) || 1;

  // Filter logs to range, convert to display unit, sort chronologically
  const dataPoints = useMemo(() => {
    return logs
      .filter((log) => {
        const d = startOfDay(new Date(log.logged_at + 'T00:00:00'));
        return d >= startOfDay(start) && d <= startOfDay(end);
      })
      .map((log) => ({
        date: startOfDay(new Date(log.logged_at + 'T00:00:00')),
        value: convertWeight(log.weight_value, log.weight_unit, displayUnit),
        id: log.id,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [logs, start, end, displayUnit]);

  // De-duplicate by day (keep last entry per day)
  const dedupedPoints = useMemo(() => {
    const map = new Map<string, (typeof dataPoints)[0]>();
    for (const p of dataPoints) {
      const key = format(p.date, 'yyyy-MM-dd');
      map.set(key, p); // last one wins
    }
    return Array.from(map.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );
  }, [dataPoints]);

  const xLabels = getXAxisLabels(range, start, end);

  // Chart dimensions
  const W = 342;
  const H = 380;
  const PAD_L = 36;
  const PAD_R = 12;
  const PAD_T = 12;
  const PAD_B = 28;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  // Y-axis range
  const values = dedupedPoints.map((p) => p.value);
  const dataMin = values.length > 0 ? Math.min(...values) : 0;
  const dataMax = values.length > 0 ? Math.max(...values) : 10;
  const yTicks = computeYTicks(dataMin, dataMax);
  const yMin = yTicks[0];
  const yMax = yTicks[yTicks.length - 1];
  const yRange = yMax - yMin || 1;

  // Map date to x coordinate
  const dateToX = (date: Date) => {
    if (range === 'W') {
      // Column-based: 7 evenly-spaced columns
      const dayIndex = differenceInDays(date, start);
      const clampedIndex = Math.max(0, Math.min(6, dayIndex));
      return PAD_L + (clampedIndex / 6) * chartW;
    }
    // Continuous positioning for longer ranges
    const dayOffset = differenceInDays(date, start);
    return PAD_L + (dayOffset / totalDays) * chartW;
  };

  // Map value to y coordinate
  const valueToY = (val: number) => {
    return PAD_T + chartH - ((val - yMin) / yRange) * chartH;
  };

  // Build line path
  const coords = dedupedPoints.map((p) => ({
    x: dateToX(p.date),
    y: valueToY(p.value),
  }));

  const linePath =
    coords.length >= 2
      ? coords.map((c, i) => (i === 0 ? `M ${c.x} ${c.y}` : `L ${c.x} ${c.y}`)).join(' ')
      : '';

  // X-axis label positions
  const xLabelPositions = xLabels.map((lbl) => ({
    label: lbl.label,
    x: dateToX(lbl.date),
  }));

  // Empty state
  if (dedupedPoints.length === 0) {
    return (
      <div style={{ height: H }} className="flex flex-col items-center justify-center">
        <p className="text-4xl mb-3">⚖️</p>
        <p className="text-muted-foreground">No data for this period</p>
        <p className="text-sm text-muted-foreground mt-1">
          Try a longer time range or log a weight
        </p>
      </div>
    );
  }

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ overflow: 'visible' }}
    >
      {/* Horizontal grid lines */}
      {yTicks.map((tick) => {
        const y = valueToY(tick);
        return (
          <line
            key={tick}
            x1={PAD_L}
            y1={y}
            x2={W - PAD_R}
            y2={y}
            stroke="var(--color-border)"
            strokeWidth="0.5"
            opacity="0.6"
          />
        );
      })}

      {/* Y-axis labels */}
      {yTicks.map((tick) => {
        const y = valueToY(tick);
        return (
          <text
            key={`y-${tick}`}
            x={PAD_L - 8}
            y={y + 4}
            textAnchor="end"
            fill="var(--color-muted-foreground)"
            fontSize="11"
            fontFamily="Inter, sans-serif"
          >
            {Number.isInteger(tick) ? tick : tick.toFixed(1)}
          </text>
        );
      })}

      {/* X-axis labels */}
      {xLabelPositions.map((lbl, i) => (
        <text
          key={`x-${i}`}
          x={lbl.x}
          y={H - 4}
          textAnchor="middle"
          fill="var(--color-muted-foreground)"
          fontSize="11"
          fontFamily="Inter, sans-serif"
        >
          {lbl.label}
        </text>
      ))}

      {/* Data line */}
      {linePath && (
        <path
          d={linePath}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* Data points */}
      {coords.map((c, i) => (
        <circle
          key={i}
          cx={c.x}
          cy={c.y}
          r="5"
          fill="var(--color-primary)"
          stroke="white"
          strokeWidth="2"
        />
      ))}

      {/* Single point label */}
      {dedupedPoints.length === 1 && (
        <text
          x={coords[0].x}
          y={coords[0].y - 14}
          textAnchor="middle"
          fill="var(--color-foreground)"
          fontSize="13"
          fontWeight="600"
          fontFamily="Inter, sans-serif"
        >
          {dedupedPoints[0].value.toFixed(1)} {displayUnit}
        </text>
      )}
    </svg>
  );
}

// ─── Main Component ───

export function WeightHistory({
  weightLogs,
  puppyId,
  userId,
  puppyCreatedAt,
  defaultUnit,
  onBack,
  onAddWeight,
  onEditWeight,
  onDeleteWeight,
}: WeightHistoryProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('W');
  const [displayUnit] = useState(defaultUnit || 'lbs');
  const [showLogSheet, setShowLogSheet] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WeightLog | null>(null);

  // Date range for selected time range
  const { start, end } = useMemo(() => getDateRange(timeRange), [timeRange]);
  const dateRangeLabel = useMemo(
    () => formatDateRange(timeRange, start, end),
    [timeRange, start, end]
  );

  // Filter logs to selected range
  const filteredLogs = useMemo(() => {
    return weightLogs.filter((log) => {
      const d = startOfDay(new Date(log.logged_at + 'T00:00:00'));
      return d >= startOfDay(start) && d <= startOfDay(end);
    });
  }, [weightLogs, start, end]);

  // Average weight for the period
  const averageWeight = useMemo(() => {
    if (filteredLogs.length === 0) return null;
    const sum = filteredLogs.reduce(
      (acc, log) => acc + convertWeight(log.weight_value, log.weight_unit, displayUnit),
      0
    );
    return sum / filteredLogs.length;
  }, [filteredLogs, displayUnit]);

  // All logs sorted newest-first (for the history list, unfiltered)
  const sortedLogs = useMemo(
    () =>
      [...weightLogs].sort((a, b) => {
        const dateCmp = b.logged_at.localeCompare(a.logged_at);
        if (dateCmp !== 0) return dateCmp;
        return b.created_at.localeCompare(a.created_at);
      }),
    [weightLogs]
  );

  // Compute deltas (chronological order)
  const chronological = useMemo(
    () => [...weightLogs].sort((a, b) => a.logged_at.localeCompare(b.logged_at)),
    [weightLogs]
  );

  const deltaMap = useMemo(() => {
    const map: Record<string, number | null> = {};
    for (let i = 0; i < chronological.length; i++) {
      if (i === 0) {
        map[chronological[i].id] = null;
      } else {
        const prev = chronological[i - 1];
        const curr = chronological[i];
        const prevVal = convertWeight(prev.weight_value, prev.weight_unit, displayUnit);
        const currVal = convertWeight(curr.weight_value, curr.weight_unit, displayUnit);
        map[curr.id] = currVal - prevVal;
      }
    }
    return map;
  }, [chronological, displayUnit]);

  // Handlers
  const handleAddSave = async (data: {
    weight_value: number;
    weight_unit: string;
    logged_at: string;
    note: string | null;
  }) => {
    await onAddWeight(data);
    setShowLogSheet(false);
  };

  const handleEditSave = async (data: {
    weight_value: number;
    weight_unit: string;
    logged_at: string;
    note: string | null;
  }) => {
    if (!editingEntry) return;
    await onEditWeight(editingEntry.id, data);
    setEditingEntry(null);
  };

  const handleDelete = async () => {
    if (!editingEntry) return;
    await onDeleteWeight(editingEntry.id);
    setEditingEntry(null);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-0">
      <div
        className="w-[390px] h-screen bg-background flex flex-col"
        style={{ paddingTop: '48px', paddingBottom: '34px' }}
      >
        {/* ── Header ── */}
        <div className="px-5 pb-3 flex items-center justify-between">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-accent flex items-center justify-center hover:opacity-80 transition-opacity"
            aria-label="Go back"
          >
            <ArrowLeft className="size-5 text-foreground" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Weight</h1>
          <button
            onClick={() => setShowLogSheet(true)}
            className="w-10 h-10 rounded-full bg-accent flex items-center justify-center hover:opacity-80 transition-opacity"
            aria-label="Log weight"
          >
            <Plus className="size-5 text-foreground" />
          </button>
        </div>

        {/* ── Content (scrollable) ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-5 space-y-4">
            {/* Time Range Tabs */}
            <TimeRangeSelector value={timeRange} onChange={setTimeRange} />

            {/* Average Summary */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#4A9B7F]">
                Average
              </p>
              {averageWeight !== null ? (
                <>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-4xl font-bold text-foreground leading-tight">
                      {averageWeight.toFixed(1)}
                    </span>
                    <span className="text-lg text-muted-foreground font-medium">
                      {displayUnit}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {dateRangeLabel}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-muted-foreground mt-1">—</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {dateRangeLabel}
                  </p>
                </>
              )}
            </div>

            {/* Chart */}
            <HealthChart
              logs={weightLogs}
              range={timeRange}
              displayUnit={displayUnit}
            />

            {/* History List */}
            {sortedLogs.length > 0 && (
              <div className="pt-2 pb-4">
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-1">
                  All Entries
                </h3>
                <div className="space-y-2">
                  {sortedLogs.map((log) => {
                    const displayValue = convertWeight(
                      log.weight_value,
                      log.weight_unit,
                      displayUnit
                    );
                    const delta = deltaMap[log.id];

                    return (
                      <button
                        key={log.id}
                        onClick={() => setEditingEntry(log)}
                        className="w-full bg-card rounded-2xl p-4 text-left hover:bg-accent transition-colors"
                        style={{
                          boxShadow: '0 2px 8px rgba(45, 27, 14, 0.06)',
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-foreground">
                            {format(
                              new Date(log.logged_at + 'T00:00:00'),
                              'MMM d, yyyy'
                            )}
                          </span>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-base font-medium text-foreground">
                              {displayValue.toFixed(1)} {displayUnit}
                            </span>
                            {log.is_onboarding ? (
                              <span className="text-xs text-muted-foreground italic">
                                onboarding
                              </span>
                            ) : delta !== null ? (
                              <span
                                className={`text-xs font-medium ${
                                  delta >= 0
                                    ? 'text-[#4A9B5E]'
                                    : 'text-destructive'
                                }`}
                              >
                                {delta >= 0 ? '+' : ''}
                                {delta.toFixed(1)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        {log.note && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                            {log.note}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom Sheets ── */}
        {showLogSheet && (
          <LogWeightSheet
            defaultUnit={displayUnit}
            minDate={puppyCreatedAt}
            onSave={handleAddSave}
            onClose={() => setShowLogSheet(false)}
          />
        )}

        {editingEntry && (
          <LogWeightSheet
            editingEntry={editingEntry}
            defaultUnit={displayUnit}
            minDate={puppyCreatedAt}
            onSave={handleEditSave}
            onDelete={handleDelete}
            onClose={() => setEditingEntry(null)}
          />
        )}
      </div>
    </div>
  );
}
