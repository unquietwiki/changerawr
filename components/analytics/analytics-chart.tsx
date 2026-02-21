'use client';

import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    Legend
} from 'recharts';
import { useTheme } from 'next-themes';
import { useTimezone } from '@/hooks/use-timezone';
import type { DailyAnalytics } from '@/lib/types/analytics';

interface AnalyticsChartProps {
    data: DailyAnalytics[];
    type?: 'line' | 'area';
    height?: number;
}

interface TooltipPayload {
    value: number;
    payload: {
        date: string;
        fullDate: string;
        views: number;
        uniqueVisitors: number;
    };
    color: string;
    name: string;
}

interface CustomTooltipProps {
    active?: boolean | undefined;
    payload?: TooltipPayload[] | null;
}

export function AnalyticsChart({
                                   data,
                                   type = 'area',
                                   height = 350
                               }: AnalyticsChartProps) {
    const { theme } = useTheme();
    const timezone = useTimezone();

    // Transform and prepare data for the chart
    const chartData = data
        .map(item => ({
            date: item.date,
            displayDate: new Date(item.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                timeZone: timezone,
            }),
            fullDate: new Date(item.date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                timeZone: timezone,
            }),
            views: item.views || 0,
            uniqueVisitors: item.uniqueVisitors || 0,
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) // Sort chronologically
        .slice(-30); // Show last 30 days max for readability

    // Theme-aware colors
    const isDark = theme === 'dark';
    const colors = {
        primary: isDark ? '#3b82f6' : '#2563eb',
        secondary: isDark ? '#64748b' : '#475569',
        grid: isDark ? '#374151' : '#e5e7eb',
        text: isDark ? '#f1f5f9' : '#1e293b',
        background: isDark ? '#1e293b' : '#ffffff',
    };

    // Custom tooltip
    const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-card border border-border rounded-lg shadow-lg p-3 min-w-[200px]">
                    <p className="font-medium text-card-foreground mb-2">
                        {data.fullDate}
                    </p>
                    <div className="space-y-1">
                        {payload.map((entry: TooltipPayload, index: number) => (
                            <div key={index} className="flex items-center justify-between gap-4 text-sm">
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: entry.color }}
                                    />
                                    <span className="text-muted-foreground">{entry.name}</span>
                                </div>
                                <span className="font-medium text-card-foreground">
                  {entry.value.toLocaleString()}
                </span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return null;
    };

    // Handle empty data
    if (!data || data.length === 0) {
        return (
            <div className="flex items-center justify-center h-80 text-muted-foreground">
                <div className="text-center space-y-2">
                    <div className="text-4xl mb-2">📊</div>
                    <p className="text-lg font-medium">No data available</p>
                    <p className="text-sm">Analytics data will appear here once you have visitors</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
                {type === 'area' ? (
                    <AreaChart
                        data={chartData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                        <defs>
                            <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={colors.primary} stopOpacity={0.4} />
                                <stop offset="95%" stopColor={colors.primary} stopOpacity={0.1} />
                            </linearGradient>
                            <linearGradient id="visitorsGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={colors.secondary} stopOpacity={0.4} />
                                <stop offset="95%" stopColor={colors.secondary} stopOpacity={0.1} />
                            </linearGradient>
                        </defs>

                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={colors.grid}
                            opacity={0.5}
                            vertical={false}
                        />

                        <XAxis
                            dataKey="displayDate"
                            stroke={colors.text}
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: colors.text }}
                            interval="preserveStartEnd"
                        />

                        <YAxis
                            stroke={colors.text}
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: colors.text }}
                            tickFormatter={(value) => value.toLocaleString()}
                            width={60}
                        />

                        <Tooltip content={<CustomTooltip />} />

                        <Legend
                            wrapperStyle={{
                                paddingTop: '20px',
                                color: colors.text
                            }}
                        />

                        <Area
                            type="monotone"
                            dataKey="views"
                            stackId="1"
                            stroke={colors.primary}
                            fill="url(#viewsGradient)"
                            strokeWidth={2}
                            name="Views"
                            dot={false}
                            activeDot={{
                                r: 4,
                                stroke: colors.primary,
                                strokeWidth: 2,
                                fill: colors.background
                            }}
                        />

                        <Area
                            type="monotone"
                            dataKey="uniqueVisitors"
                            stackId="2"
                            stroke={colors.secondary}
                            fill="url(#visitorsGradient)"
                            strokeWidth={2}
                            name="Unique Visitors"
                            dot={false}
                            activeDot={{
                                r: 4,
                                stroke: colors.secondary,
                                strokeWidth: 2,
                                fill: colors.background
                            }}
                        />
                    </AreaChart>
                ) : (
                    <LineChart
                        data={chartData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke={colors.grid}
                            opacity={0.5}
                            vertical={false}
                        />

                        <XAxis
                            dataKey="displayDate"
                            stroke={colors.text}
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: colors.text }}
                            interval="preserveStartEnd"
                        />

                        <YAxis
                            stroke={colors.text}
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: colors.text }}
                            tickFormatter={(value) => value.toLocaleString()}
                            width={60}
                        />

                        <Tooltip content={<CustomTooltip />} />

                        <Legend
                            wrapperStyle={{
                                paddingTop: '20px',
                                color: colors.text
                            }}
                        />

                        <Line
                            type="monotone"
                            dataKey="views"
                            stroke={colors.primary}
                            strokeWidth={3}
                            name="Views"
                            dot={{ fill: colors.primary, strokeWidth: 2, r: 4 }}
                            activeDot={{
                                r: 6,
                                stroke: colors.primary,
                                strokeWidth: 2,
                                fill: colors.background
                            }}
                        />

                        <Line
                            type="monotone"
                            dataKey="uniqueVisitors"
                            stroke={colors.secondary}
                            strokeWidth={3}
                            name="Unique Visitors"
                            dot={{ fill: colors.secondary, strokeWidth: 2, r: 4 }}
                            activeDot={{
                                r: 6,
                                stroke: colors.secondary,
                                strokeWidth: 2,
                                fill: colors.background
                            }}
                        />
                    </LineChart>
                )}
            </ResponsiveContainer>
        </div>
    );
}