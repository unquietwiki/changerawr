import React, { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";
import {
    ChevronRight, Check, AlertTriangle, Loader2,
    RefreshCw, Sparkles, Tag, Calendar, Info, ChevronsUpDown,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Badge } from "@/components/ui/badge";
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

// ===== Types =====

type VersionType = 'major' | 'minor' | 'patch' | 'custom';
type TabMode = 'semver' | 'custom';

interface ProcessedVersion {
    value: string;
    type: VersionType;
    isStandard: boolean;
    isConflict: boolean;
    isCurrent: boolean;
}

interface ResolvedTemplate {
    value: string;
    label: string;
    isConflict: boolean;
    isCurrent: boolean;
}

interface TimezoneResponse {
    timezone: string;
    customDateTemplates?: { format: string; label: string }[] | null;
}

interface VersionSelectorProps {
    version: string;
    onVersionChange: (version: string) => void;
    projectId: string;
    entryId?: string;
    onConflictDetected?: (hasConflict: boolean) => void;
    disabled?: boolean;
}

interface State {
    input: string;
    tab: TabMode;
    isOpen: boolean;
    showPrevious: boolean;
    hasConflict: boolean;
    isValidating: boolean;
}

type Action =
    | Partial<State>
    | { type: 'reset' }
    | { type: 'toggle-previous' };

// ===== Constants =====

const TYPE_CONFIG: Record<VersionType, { dot: string; label: string; badge: string }> = {
    patch:  { dot: 'bg-blue-500',    label: 'Patch',  badge: 'text-blue-600 dark:text-blue-400' },
    minor:  { dot: 'bg-emerald-500', label: 'Minor',  badge: 'text-emerald-600 dark:text-emerald-400' },
    major:  { dot: 'bg-orange-500',  label: 'Major',  badge: 'text-orange-600 dark:text-orange-400' },
    custom: { dot: 'bg-muted-foreground', label: 'Custom', badge: 'text-muted-foreground' },
};

const BUILT_IN_TEMPLATES: { format: string; label: string }[] = [
    { format: 'v{YYYY}.{MM}.{DD}', label: 'Date (dotted)' },
    { format: 'v{YYYY}.{MM}.{DD}.1', label: 'Date (rev)' },
    { format: 'v{YYYY}{MM}{DD}', label: 'Date (compact)' },
];

// ===== Helpers =====

function reducer(state: State, action: Action): State {
    if (typeof action === 'object' && 'type' in action) {
        if (action.type === 'reset') return { ...state, hasConflict: false, isValidating: false };
        if (action.type === 'toggle-previous') return { ...state, showPrevious: !state.showPrevious };
        return state;
    }
    return { ...state, ...action };
}

function isSemVer(v: string): boolean {
    if (!v) return false;
    const n = v.startsWith('v') ? v.substring(1) : v;
    const p = n.split('.');
    return p.length === 3 && p.every(x => /^\d+$/.test(x));
}

function stripV(v: string): string {
    return v.startsWith('v') ? v.substring(1) : v;
}

function addV(v: string): string {
    if (!v) return '';
    const t = v.trim();
    return t.startsWith('v') ? t : `v${t}`;
}

function getType(v: string): VersionType {
    if (!isSemVer(v)) return 'custom';
    const s = stripV(v);
    if (s.endsWith('.0.0')) return 'major';
    if (/\.\d+\.0$/.test(s)) return 'minor';
    return 'patch';
}

function parseSemVer(v: string): [number, number, number] | null {
    const parts = stripV(v).split('.').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    return parts as [number, number, number];
}

function resolveTemplate(
    format: string,
    tz: string,
    latestParts: [number, number, number] | null,
): string {
    const now = new Date();

    const dp = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(now);
    const tp = new Intl.DateTimeFormat('en-GB', {
        timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).formatToParts(now);

    const Y = dp.find(p => p.type === 'year')?.value ?? '2026';
    const M = dp.find(p => p.type === 'month')?.value ?? '01';
    const D = dp.find(p => p.type === 'day')?.value ?? '01';
    const h = tp.find(p => p.type === 'hour')?.value ?? '00';
    const m = tp.find(p => p.type === 'minute')?.value ?? '00';
    const s = tp.find(p => p.type === 'second')?.value ?? '00';

    const [maj, min, pat] = latestParts ?? [0, 0, 0];

    return format
        .replace(/\{YYYY}/g, Y)
        .replace(/\{YY}/g, Y.slice(-2))
        .replace(/\{MM}/g, M)
        .replace(/\{DD}/g, D)
        .replace(/\{hh}/g, h)
        .replace(/\{mm}/g, m)
        .replace(/\{ss}/g, s)
        .replace(/\{MAJOR}/g, String(maj))
        .replace(/\{MINOR}/g, String(min))
        .replace(/\{PATCH}/g, String(pat))
        .replace(/\{VERSION}/g, `${maj}.${min}.${pat}`)
        .replace(/\{NEXT_PATCH}/g, String(pat + 1))
        .replace(/\{NEXT_MINOR}/g, String(min + 1))
        .replace(/\{NEXT_MAJOR}/g, String(maj + 1));
}

// ===== Component =====

const VersionSelector: React.FC<VersionSelectorProps> = ({
    version,
    onVersionChange,
    projectId,
    entryId,
    onConflictDetected,
    disabled = false,
}) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef('');

    const [state, dispatch] = useReducer(reducer, {
        input: version || '',
        tab: 'semver' as TabMode,
        isOpen: false,
        showPrevious: false,
        hasConflict: false,
        isValidating: false,
    });

    const { input, tab, isOpen, showPrevious, hasConflict, isValidating } = state;

    // ----- Data fetching -----

    const { data: tzData } = useQuery<TimezoneResponse>({
        queryKey: ['system-timezone'],
        queryFn: async () => {
            const r = await fetch('/api/config/timezone');
            if (!r.ok) return { timezone: 'UTC' };
            return r.json();
        },
        staleTime: 300_000,
    });

    const tz = tzData?.timezone ?? 'UTC';
    const adminTemplates = tzData?.customDateTemplates;
    const hasAdminTemplates = Array.isArray(adminTemplates) && adminTemplates.length > 0;

    const {
        data: versionData,
        isLoading: versionsLoading,
        refetch: refetchVersions,
    } = useQuery<{ versions: string[] }>({
        queryKey: ['project-versions', projectId],
        queryFn: async () => {
            const r = await fetch(`/api/projects/${projectId}/versions`);
            if (!r.ok) throw new Error('Failed');
            return r.json();
        },
        staleTime: 60_000,
    });

    const existingSet = useMemo(
        () => new Set(versionData?.versions || []),
        [versionData?.versions],
    );

    // ----- Debounced conflict check -----

    useEffect(() => {
        const t = setTimeout(() => {
            debounceRef.current = input;
            if (input.trim()) dispatch({ isValidating: true });
        }, 300);
        return () => clearTimeout(t);
    }, [input]);

    const { data: conflictResult } = useQuery({
        queryKey: ['version-conflict', projectId, debounceRef.current, entryId],
        queryFn: () => {
            const v = debounceRef.current;
            if (!v.trim()) return { hasConflict: false };
            const fv = addV(v);
            if (fv === addV(version)) return { hasConflict: false };
            return { hasConflict: existingSet.has(fv) || existingSet.has(stripV(fv)) };
        },
        enabled: Boolean(debounceRef.current && versionData),
        staleTime: 0,
    });

    useEffect(() => {
        if (conflictResult) {
            dispatch({ hasConflict: conflictResult.hasConflict, isValidating: false });
            onConflictDetected?.(conflictResult.hasConflict);
        }
    }, [conflictResult, onConflictDetected]);

    // ----- Focus + reset -----

    useEffect(() => {
        if (isOpen && inputRef.current) {
            const t = setTimeout(() => inputRef.current?.focus(), 80);
            return () => clearTimeout(t);
        }
    }, [isOpen, tab]);

    useEffect(() => {
        if (isOpen) dispatch({ type: 'reset' });
    }, [isOpen, version]);

    useEffect(() => {
        if (version && !isSemVer(version)) dispatch({ tab: 'custom' });
    }, [version]);

    // ----- Processed versions -----

    const processed = useMemo((): ProcessedVersion[] => {
        const cv = addV(version);
        return (versionData?.versions || []).map(v => ({
            value: v,
            type: getType(v),
            isStandard: isSemVer(v),
            isConflict: false,
            isCurrent: v === cv,
        }));
    }, [versionData?.versions, version]);

    const semverVersions = useMemo(() => processed.filter(v => v.isStandard), [processed]);
    const customVersions = useMemo(() => processed.filter(v => !v.isStandard), [processed]);

    const latestParts = useMemo((): [number, number, number] | null => {
        if (!semverVersions.length) return null;
        return parseSemVer(semverVersions[0].value);
    }, [semverVersions]);

    // ----- Suggestions -----

    const suggestions = useMemo((): ProcessedVersion[] => {
        if (!latestParts) {
            return [{ value: 'v1.0.0', type: 'major', isStandard: true, isConflict: false, isCurrent: false }];
        }

        const [maj, min, pat] = latestParts;
        const cv = addV(version);

        const next = (bM: number, bm: number, bp: number, type: VersionType): ProcessedVersion => {
            let cM = bM, cm = bm, cp = bp;
            for (let i = 0; i < 10; i++) {
                const candidate = `v${cM}.${cm}.${cp}`;
                const isCurr = candidate === cv;
                if (!isCurr && !existingSet.has(candidate) && !existingSet.has(stripV(candidate))) {
                    return { value: candidate, type, isStandard: true, isConflict: false, isCurrent: false };
                }
                if (isCurr) return { value: candidate, type, isStandard: true, isConflict: false, isCurrent: true };
                if (type === 'patch') cp++;
                else if (type === 'minor') { cm++; cp = 0; }
                else { cM++; cm = 0; cp = 0; }
            }
            return { value: `v${cM}.${cm}.${cp}`, type, isStandard: true, isConflict: true, isCurrent: false };
        };

        return [
            next(maj, min, pat + 1, 'patch'),
            next(maj, min + 1, 0, 'minor'),
            next(maj + 1, 0, 0, 'major'),
        ];
    }, [latestParts, existingSet, version]);

    // ----- Templates -----

    const templates = useMemo((): ResolvedTemplate[] => {
        const source = hasAdminTemplates ? adminTemplates! : BUILT_IN_TEMPLATES;
        const cv = addV(version);

        return source.map(t => {
            const resolved = resolveTemplate(t.format, tz, latestParts);
            const isCurr = resolved === cv;
            const conflict = !isCurr && (existingSet.has(resolved) || existingSet.has(stripV(resolved)));
            return { value: resolved, label: t.label, isConflict: conflict, isCurrent: isCurr };
        });
    }, [hasAdminTemplates, adminTemplates, tz, latestParts, existingSet, version]);

    // ----- Handlers -----

    const selectVersion = useCallback((v: string) => {
        const fv = addV(v);
        const cv = addV(version);
        if (fv === cv) {
            onVersionChange(fv);
            dispatch({ isOpen: false, hasConflict: false });
            return;
        }
        if (existingSet.has(fv) || existingSet.has(stripV(fv))) {
            dispatch({ hasConflict: true });
            return;
        }
        onVersionChange(fv);
        dispatch({ isOpen: false, hasConflict: false });
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }, [onVersionChange, existingSet, version]);

    const submitInput = useCallback(() => {
        if (input.trim() && !hasConflict) selectVersion(input);
    }, [input, hasConflict, selectVersion]);

    const onKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && input.trim() && !hasConflict) {
            e.preventDefault();
            selectVersion(input);
        }
    }, [input, hasConflict, selectVersion]);

    // ----- Derived -----

    const vt = version ? getType(version) : null;
    const vtConfig = vt ? TYPE_CONFIG[vt] : null;
    const previousVersions = tab === 'semver' ? semverVersions : customVersions;

    // Check if user input matches any suggestion/template (to avoid showing redundant "use as" row)
    const inputMatchesSuggestion = useMemo(() => {
        if (!input.trim()) return true;
        const fv = addV(input);
        if (tab === 'semver') return suggestions.some(s => s.value === fv);
        return templates.some(t => t.value === fv);
    }, [input, tab, suggestions, templates]);

    return (
        <TooltipProvider>
            <Popover open={isOpen} onOpenChange={o => !disabled && dispatch({ isOpen: o })}>
                <PopoverTrigger asChild>
                    <Button variant="outline" disabled={disabled} className="h-8 border-dashed gap-1.5 min-w-0 max-w-full overflow-hidden">
                        <Tag className="h-4 w-4 shrink-0" />
                        {version ? (
                            <>
                                <span className="font-mono text-sm max-w-[120px] truncate">
                                    {version}
                                </span>
                                <Separator orientation="vertical" className="mx-0.5 h-4" />
                                <Badge variant="secondary" className="rounded-sm px-1 font-normal">
                                    <span className={cn("h-1.5 w-1.5 rounded-full mr-1 inline-block", vtConfig?.dot)} />
                                    {vtConfig?.label}
                                </Badge>
                            </>
                        ) : (
                            <span className="text-muted-foreground">Set version</span>
                        )}
                        <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/50 ml-0.5 shrink-0" />
                    </Button>
                </PopoverTrigger>

                <PopoverContent className="w-[350px] p-0" align="start">
                    {/* Header */}
                    <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                        <div className="flex items-center gap-2">
                            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-sm font-medium">Version</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                            {/* Tab toggle */}
                            <div className="flex items-center rounded-md border bg-background p-0.5">
                                <button
                                    onClick={() => dispatch({ tab: 'semver' })}
                                    className={cn(
                                        "px-2 py-0.5 rounded-[3px] text-[11px] font-medium transition-all",
                                        tab === 'semver'
                                            ? "bg-primary text-primary-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    SemVer
                                </button>
                                <button
                                    onClick={() => dispatch({ tab: 'custom' })}
                                    className={cn(
                                        "px-2 py-0.5 rounded-[3px] text-[11px] font-medium transition-all",
                                        tab === 'custom'
                                            ? "bg-primary text-primary-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    Custom
                                </button>
                            </div>

                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onClick={() => refetchVersions()}
                                        disabled={versionsLoading}
                                    >
                                        <RefreshCw className={cn("h-3 w-3", versionsLoading && "animate-spin")} />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">Refresh versions</TooltipContent>
                            </Tooltip>
                        </div>
                    </div>

                    {/* Conflict banner */}
                    <AnimatePresence>
                        {hasConflict && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                            >
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 text-destructive text-xs border-b">
                                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                    <span className="flex-1">This version already exists</span>
                                    <button
                                        onClick={() => dispatch({ hasConflict: false, input: '' })}
                                        className="underline underline-offset-2 hover:no-underline text-[11px]"
                                    >
                                        Clear
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <Command shouldFilter={false}>
                        <CommandInput
                            placeholder={tab === 'semver' ? "Type a version..." : "Type any name..."}
                            value={input}
                            onValueChange={v => dispatch({ input: v, isValidating: Boolean(v.trim()) })}
                            onKeyDown={onKeyDown}
                            ref={inputRef}
                        />

                        <CommandList>
                            <CommandEmpty>
                                {versionsLoading ? (
                                    <div className="py-6 text-center text-xs text-muted-foreground">
                                        <span className="flex items-center justify-center gap-1.5">
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
                                        </span>
                                    </div>
                                ) : input.trim() ? (
                                    <div className="py-3 px-4 text-center space-y-1.5">
                                        {hasConflict ? (
                                            <p className="text-xs text-destructive flex items-center justify-center gap-1">
                                                <AlertTriangle className="h-3 w-3" /> Already exists
                                            </p>
                                        ) : (
                                            <p className="text-xs text-muted-foreground">
                                                Press <kbd className="px-1 py-0.5 rounded border bg-muted text-[10px] font-mono">Enter</kbd> to use <code className="font-mono text-foreground">{addV(input)}</code>
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="py-6 text-center text-xs text-muted-foreground">
                                        {tab === 'semver' ? 'No versions yet' : 'Type a name or pick a template'}
                                    </div>
                                )}
                            </CommandEmpty>

                            {/* ===== SemVer Tab ===== */}
                            {tab === 'semver' && (
                                <>
                                    {/* Use-as row for typed input that doesn't match suggestions */}
                                    {input.trim() && !inputMatchesSuggestion && (
                                        <CommandGroup heading="Use as typed">
                                            <CommandItem
                                                value={`typed-${input}`}
                                                onSelect={submitInput}
                                                disabled={hasConflict || isValidating}
                                                className={cn(hasConflict && "opacity-40")}
                                            >
                                                <Sparkles className="h-3.5 w-3.5 mr-2 text-primary shrink-0" />
                                                <span className="font-mono flex-1">{addV(input)}</span>
                                                {isValidating ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                                ) : hasConflict ? (
                                                    <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                                                ) : (
                                                    <span className="text-[10px] text-muted-foreground">Enter</span>
                                                )}
                                            </CommandItem>
                                        </CommandGroup>
                                    )}

                                    <CommandGroup heading="Recommended">
                                        {suggestions.map(s => {
                                            const c = TYPE_CONFIG[s.type];
                                            return (
                                                <CommandItem
                                                    key={s.value}
                                                    value={s.value}
                                                    onSelect={() => !s.isConflict && selectVersion(s.value)}
                                                    disabled={s.isConflict}
                                                    className={cn(
                                                        s.isCurrent && "bg-primary/5",
                                                        s.isConflict && "opacity-40",
                                                    )}
                                                >
                                                    <span className={cn("h-2 w-2 rounded-full mr-2 shrink-0", c.dot)} />
                                                    <span className="font-mono flex-1">{s.value}</span>
                                                    <Badge variant="outline" className={cn("text-[10px] px-1.5 h-5 font-normal", c.badge)}>
                                                        {c.label}
                                                    </Badge>
                                                    {s.isCurrent && <Check className="h-3.5 w-3.5 text-primary ml-1" />}
                                                    {s.isConflict && <AlertTriangle className="h-3.5 w-3.5 text-destructive ml-1" />}
                                                </CommandItem>
                                            );
                                        })}
                                    </CommandGroup>

                                    <div className="px-3 py-1.5">
                                        <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                                            <Info className="h-2.5 w-2.5 shrink-0" />
                                            <code className="font-mono bg-muted/50 px-0.5 rounded">vMAJOR.MINOR.PATCH</code>
                                        </p>
                                    </div>
                                </>
                            )}

                            {/* ===== Custom Tab ===== */}
                            {tab === 'custom' && (
                                <>
                                    {/* Use custom name */}
                                    {input.trim() && !inputMatchesSuggestion && (
                                        <CommandGroup heading="Custom Name">
                                            <CommandItem
                                                value={`custom-${input}`}
                                                onSelect={submitInput}
                                                disabled={hasConflict || isValidating}
                                                className={cn(hasConflict && "opacity-40")}
                                            >
                                                <Sparkles className="h-3.5 w-3.5 mr-2 text-primary shrink-0" />
                                                <span className="font-mono flex-1">{addV(input)}</span>
                                                {isValidating ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                                                ) : hasConflict ? (
                                                    <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                                                ) : (
                                                    <span className="text-[10px] text-muted-foreground">Enter</span>
                                                )}
                                            </CommandItem>
                                        </CommandGroup>
                                    )}

                                    <CommandGroup heading={hasAdminTemplates ? 'Templates' : 'Date Formats'}>
                                        {templates.map((t, i) => (
                                            <CommandItem
                                                key={i}
                                                value={`tpl-${i}-${t.value}`}
                                                onSelect={() => !t.isConflict && selectVersion(t.value)}
                                                disabled={t.isConflict}
                                                className={cn(
                                                    t.isCurrent && "bg-primary/5",
                                                    t.isConflict && "opacity-40",
                                                )}
                                            >
                                                <Calendar className="h-3.5 w-3.5 mr-2 text-muted-foreground shrink-0" />
                                                <span className="font-mono flex-1">{t.value}</span>
                                                <span className="text-[11px] text-muted-foreground ml-2">{t.label}</span>
                                                {t.isCurrent && <Check className="h-3.5 w-3.5 text-primary ml-1" />}
                                                {t.isConflict && <AlertTriangle className="h-3.5 w-3.5 text-destructive ml-1" />}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>

                                    <div className="px-3 py-1.5">
                                        <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
                                            <Info className="h-2.5 w-2.5 shrink-0" />
                                            Type anything: <code className="font-mono bg-muted/50 px-0.5 rounded">beta-1</code>,{' '}
                                            <code className="font-mono bg-muted/50 px-0.5 rounded">rc1</code>,{' '}
                                            <code className="font-mono bg-muted/50 px-0.5 rounded">nightly</code>
                                        </p>
                                    </div>
                                </>
                            )}

                            {/* ===== Previous versions ===== */}
                            {previousVersions.length > 0 && (
                                <>
                                    <CommandSeparator />
                                    <button
                                        onClick={() => dispatch({ type: 'toggle-previous' })}
                                        className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                                    >
                                        <motion.div animate={{ rotate: showPrevious ? 90 : 0 }} transition={{ duration: 0.15 }}>
                                            <ChevronRight className="h-3 w-3" />
                                        </motion.div>
                                        Previous {tab === 'semver' ? 'versions' : 'custom versions'}
                                        <Badge variant="secondary" className="ml-auto h-4 text-[10px] px-1.5 rounded-sm font-mono">
                                            {previousVersions.length}
                                        </Badge>
                                    </button>

                                    <AnimatePresence>
                                        {showPrevious && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.15 }}
                                            >
                                                <CommandGroup>
                                                    <div className="max-h-[150px] overflow-y-auto">
                                                        {previousVersions.map(v => {
                                                            const c = TYPE_CONFIG[v.type];
                                                            return (
                                                                <CommandItem
                                                                    key={v.value}
                                                                    value={v.value}
                                                                    onSelect={() => selectVersion(v.value)}
                                                                    className={cn(
                                                                        "text-muted-foreground hover:text-foreground",
                                                                        v.isCurrent && "bg-primary/5 text-foreground",
                                                                    )}
                                                                >
                                                                    <span className={cn("h-1.5 w-1.5 rounded-full mr-2 shrink-0", c.dot)} />
                                                                    <span className="font-mono flex-1 text-[13px]">{v.value}</span>
                                                                    {v.isCurrent && <Check className="h-3.5 w-3.5 text-primary" />}
                                                                </CommandItem>
                                                            );
                                                        })}
                                                    </div>
                                                </CommandGroup>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </>
                            )}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </TooltipProvider>
    );
};

export default VersionSelector;
