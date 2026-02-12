import React, { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronDown, Check, Info, Calendar, Tag, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertActions } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

// ===== Type Definitions =====

type VersionFormat = 'semver' | 'custom';
type VersionType = 'major' | 'minor' | 'patch' | 'custom';

interface BaseVersion {
    value: string;
    type: VersionType;
    isStandard: boolean;
}

interface ProcessedVersion extends BaseVersion {
    isConflict: boolean;
    isCurrent: boolean;
}

interface VersionTemplate {
    value: string;
    isConflict: boolean;
    isCurrent: boolean;
}

interface VersionData {
    versions: string[];
}

interface ConflictCheckResult {
    hasConflict: boolean;
}

interface VersionManagerState {
    input: string;
    activeTab: VersionFormat;
    isOpen: boolean;
    showPrevious: boolean;
    hasConflict: boolean;
    isValidating: boolean;
}

type VersionManagerAction =
    | Partial<VersionManagerState>
    | { type: 'reset' }
    | { type: 'toggle-previous' };

interface VersionSelectorProps {
    version: string;
    onVersionChange: (version: string) => void;
    projectId: string;
    entryId?: string;
    onConflictDetected?: (hasConflict: boolean) => void;
    disabled?: boolean;
}

// ===== Constants =====

const CACHE_TIME = 60000; // 1 minute
const DEBOUNCE_TIME = 300; // 300ms
const CONFLICT_CHECK_SAFETY_LIMIT = 10;

const VERSION_TYPE_CONFIG = {
    major: {
        label: 'Major',
        description: 'Breaking changes (1.0.0 → 2.0.0)',
        className: 'bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-300',
        priority: 2
    },
    minor: {
        label: 'Minor',
        description: 'New features (1.0.0 → 1.1.0)',
        className: 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300',
        priority: 1
    },
    patch: {
        label: 'Patch',
        description: 'Bug fixes (1.0.0 → 1.0.1)',
        className: 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300',
        priority: 0
    },
    custom: {
        label: 'Custom',
        description: 'Custom version format',
        className: 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300',
        priority: 3
    }
} as const;

// ===== Reducer =====

function versionManagerReducer(
    state: VersionManagerState,
    action: VersionManagerAction
): VersionManagerState {
    if (typeof action === 'object' && 'type' in action) {
        switch (action.type) {
            case 'reset':
                return {
                    ...state,
                    input: state.input, // Keep current input but reset conflict state
                    hasConflict: false,
                    isValidating: false,
                };
            case 'toggle-previous':
                return {
                    ...state,
                    showPrevious: !state.showPrevious,
                };
            default:
                return state;
        }
    }

    return { ...state, ...action };
}

// ===== Main Component =====

const VersionSelector: React.FC<VersionSelectorProps> = ({
                                                             version,
                                                             onVersionChange,
                                                             projectId,
                                                             entryId,
                                                             onConflictDetected,
                                                             disabled = false,
                                                         }) => {
    // ===== Refs =====
    const inputRef = useRef<HTMLInputElement>(null);
    const debouncedInputRef = useRef<string>('');

    // ===== State Management =====
    const [state, dispatch] = useReducer(versionManagerReducer, {
        input: version || '',
        activeTab: 'semver' as VersionFormat,
        isOpen: false,
        showPrevious: true,
        hasConflict: false,
        isValidating: false,
    });

    const { input, activeTab, isOpen, showPrevious, hasConflict, isValidating } = state;

    // ===== Debounced Input =====
    useEffect(() => {
        const timer = setTimeout(() => {
            debouncedInputRef.current = input;
            if (input.trim()) {
                dispatch({ isValidating: true });
            }
        }, DEBOUNCE_TIME);

        return () => clearTimeout(timer);
    }, [input]);

    // ===== Version Utilities =====
    const versionUtils = useMemo(() => ({
        isSemVer: (v: string): boolean => {
            if (!v) return false;
            const versionNumber = v.startsWith('v') ? v.substring(1) : v;
            const parts = versionNumber.split('.');
            return parts.length === 3 && parts.every(part => /^\d+$/.test(part));
        },

        isValidVersion: (v: string): boolean => {
            return Boolean(v?.trim());
        },

        formatVersion: (v: string): string => {
            if (!v) return '';
            const trimmed = v.trim();
            return trimmed.startsWith('v') ? trimmed : `v${trimmed}`;
        },

        stripPrefix: (v: string): string => {
            return v.startsWith('v') ? v.substring(1) : v;
        },

        getVersionType: (v: string): VersionType => {
            if (!versionUtils.isSemVer(v)) return 'custom';
            if (v.endsWith('.0.0')) return 'major';
            if (v.match(/\.\d+\.0$/)) return 'minor';
            return 'patch';
        },
    }), []);

    // ===== Data Fetching =====
    const {
        data: versionData,
        isLoading: isVersionsLoading,
        refetch: refetchVersions,
    } = useQuery<VersionData>({
        queryKey: ['project-versions', projectId],
        queryFn: async (): Promise<VersionData> => {
            const response = await fetch(`/api/projects/${projectId}/versions`);
            if (!response.ok) {
                throw new Error('Failed to fetch versions');
            }
            return response.json();
        },
        staleTime: CACHE_TIME,
    });

    const { data: conflictCheck } = useQuery<ConflictCheckResult>({
        queryKey: ['version-conflict', projectId, debouncedInputRef.current, entryId],
        queryFn: async (): Promise<ConflictCheckResult> => {
            const debouncedInput = debouncedInputRef.current;
            if (!debouncedInput.trim()) {
                return { hasConflict: false };
            }

            const formattedVersion = versionUtils.formatVersion(debouncedInput);
            const existingVersions = versionData?.versions || [];

            // Don't consider it a conflict if it's the current version
            const currentFormattedVersion = versionUtils.formatVersion(version);
            if (formattedVersion === currentFormattedVersion) {
                return { hasConflict: false };
            }

            // Check if this version already exists
            const hasConflict = existingVersions.some(v =>
                v === formattedVersion || v === formattedVersion.replace(/^v/, '')
            );

            return { hasConflict };
        },
        enabled: Boolean(debouncedInputRef.current && versionData?.versions),
        staleTime: 0,
    });

    // ===== Effects =====
    useEffect(() => {
        if (conflictCheck) {
            dispatch({
                hasConflict: conflictCheck.hasConflict,
                isValidating: false
            });
            onConflictDetected?.(conflictCheck.hasConflict);
        }
    }, [conflictCheck, onConflictDetected]);

    useEffect(() => {
        if (isOpen && inputRef.current) {
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isOpen, activeTab]);

    useEffect(() => {
        if (isOpen) {
            dispatch({ type: 'reset' });
        }
    }, [isOpen, version]);

    useEffect(() => {
        const isCurrentVersionCustom = version && !versionUtils.isSemVer(version);
        if (isCurrentVersionCustom) {
            dispatch({ activeTab: 'custom' });
        }
    }, [version, versionUtils]);

    // ===== Processed Data =====
    const processedVersions = useMemo((): ProcessedVersion[] => {
        const existingVersions = versionData?.versions || [];
        const currentFormattedVersion = versionUtils.formatVersion(version);

        return existingVersions.map(v => ({
            value: v,
            type: versionUtils.getVersionType(v),
            isStandard: versionUtils.isSemVer(v),
            isConflict: false, // Existing versions are not conflicts
            isCurrent: v === currentFormattedVersion,
        }));
    }, [versionData?.versions, versionUtils, version]);

    const { semverVersions, customVersions } = useMemo(() => {
        return {
            semverVersions: processedVersions.filter(v => v.isStandard),
            customVersions: processedVersions.filter(v => !v.isStandard),
        };
    }, [processedVersions]);

    const suggestions = useMemo((): ProcessedVersion[] => {
        if (!semverVersions.length) {
            return [{
                value: 'v1.0.0',
                type: 'major' as VersionType,
                isStandard: true,
                isConflict: false,
                isCurrent: false,
            }];
        }

        const latestVersion = semverVersions[0];
        if (!latestVersion) return [];

        const cleanVersion = versionUtils.stripPrefix(latestVersion.value);
        const versionParts = cleanVersion.split('.').map(Number);

        if (versionParts.length !== 3 || versionParts.some(isNaN)) {
            return [];
        }

        const [major, minor, patch] = versionParts;
        const existingVersions = new Set(versionData?.versions || []);
        const currentFormattedVersion = versionUtils.formatVersion(version);

        // Helper function to find next available version
        const findNextAvailable = (baseMajor: number, baseMinor: number, basePatch: number, type: VersionType): ProcessedVersion => {
            let attempts = 0;
            let currentMajor = baseMajor;
            let currentMinor = baseMinor;
            let currentPatch = basePatch;

            while (attempts < CONFLICT_CHECK_SAFETY_LIMIT) {
                const candidateVersion = `v${currentMajor}.${currentMinor}.${currentPatch}`;
                const isCurrentVersion = candidateVersion === currentFormattedVersion;
                const wouldConflict = !isCurrentVersion && (
                    existingVersions.has(candidateVersion) ||
                    existingVersions.has(candidateVersion.replace(/^v/, ''))
                );

                if (!wouldConflict) {
                    return {
                        value: candidateVersion,
                        type,
                        isStandard: true,
                        isConflict: false,
                        isCurrent: isCurrentVersion,
                    };
                }

                // Increment based on type
                switch (type) {
                    case 'patch':
                        currentPatch++;
                        break;
                    case 'minor':
                        currentMinor++;
                        currentPatch = 0;
                        break;
                    case 'major':
                        currentMajor++;
                        currentMinor = 0;
                        currentPatch = 0;
                        break;
                }
                attempts++;
            }

            // Fallback if we can't find a free version
            return {
                value: `v${currentMajor}.${currentMinor}.${currentPatch}`,
                type,
                isStandard: true,
                isConflict: true,
                isCurrent: false,
            };
        };

        const suggestions = [
            findNextAvailable(major, minor, patch + 1, 'patch'),
            findNextAvailable(major, minor + 1, 0, 'minor'),
            findNextAvailable(major + 1, 0, 0, 'major'),
        ];

        // Sort by priority: patch > minor > major
        return suggestions.sort((a, b) =>
            VERSION_TYPE_CONFIG[a.type].priority - VERSION_TYPE_CONFIG[b.type].priority
        );
    }, [semverVersions, versionUtils, versionData?.versions, version]);

    const customTemplates = useMemo((): VersionTemplate[] => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const yearUTC = now.getUTCFullYear();
        const monthUTC = String(now.getUTCMonth() + 1).padStart(2, '0');
        const dayUTC = String(now.getUTCDate()).padStart(2, '0');
        const hourUTC = String(now.getUTCHours() + 1).padStart(2, '0');
        const minUTC = String(now.getUTCMinutes() + 1).padStart(2, '0');
        const secondsUTC = String(now.getUTCSeconds() + 1).padStart(2, '0');

        const templates = [
            `v${yearUTC}${monthUTC}${dayUTC}.${hourUTC}${minUTC}${secondsUTC}`,
            `v${year}.${month}.${day}`,
            `v${year}.${month}.${day}.1`,
            `v${year}${month}${day}`,
        ];

        const existingVersions = new Set(versionData?.versions || []);
        const currentFormattedVersion = versionUtils.formatVersion(version);

        return templates.map(template => {
            const isCurrentVersion = template === currentFormattedVersion;
            const wouldConflict = !isCurrentVersion && (
                existingVersions.has(template) ||
                existingVersions.has(template.replace(/^v/, ''))
            );

            return {
                value: template,
                isConflict: wouldConflict,
                isCurrent: isCurrentVersion,
            };
        });
    }, [versionData?.versions, version, versionUtils]);

    // ===== Event Handlers =====
    const handleVersionSelect = useCallback((selectedVersion: string) => {
        const formattedVersion = versionUtils.formatVersion(selectedVersion);

        // Don't check conflict if it's the current version
        const currentFormattedVersion = versionUtils.formatVersion(version);
        if (formattedVersion === currentFormattedVersion) {
            onVersionChange(formattedVersion);
            dispatch({ isOpen: false, hasConflict: false });
            return;
        }

        // Check for conflict before allowing selection
        const existingVersions = versionData?.versions || [];
        const wouldConflict = existingVersions.some(v =>
            v === formattedVersion || v === formattedVersion.replace(/^v/, '')
        );

        if (wouldConflict) {
            dispatch({ hasConflict: true });
            return;
        }

        onVersionChange(formattedVersion);
        dispatch({ isOpen: false, hasConflict: false });

        // Remove focus
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
    }, [versionUtils, onVersionChange, versionData?.versions, version]);

    const handleCreateCustomVersion = useCallback(() => {
        if (versionUtils.isValidVersion(input) && !hasConflict) {
            handleVersionSelect(input);
        }
    }, [input, handleVersionSelect, versionUtils, hasConflict]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && versionUtils.isValidVersion(input) && !hasConflict) {
            e.preventDefault();
            handleVersionSelect(input);
        }
    }, [input, handleVersionSelect, versionUtils, hasConflict]);

    const handleInputChange = useCallback((value: string) => {
        dispatch({ input: value, isValidating: Boolean(value.trim()) });
    }, []);

    const handleRefreshVersions = useCallback(async () => {
        await refetchVersions();
    }, [refetchVersions]);

    // ===== Render Helpers =====
    const renderVersionTypeBadge = useCallback((
        type: VersionType,
        isConflict?: boolean,
        isCurrent?: boolean
    ) => {
        if (isCurrent) {
            return (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Badge className="ml-auto bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-300">
                            Current
                        </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p className="text-xs">This is the current version</p>
                    </TooltipContent>
                </Tooltip>
            );
        }

        if (isConflict) {
            return (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Badge className="ml-auto bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Conflict
                        </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p className="text-xs">This version already exists</p>
                    </TooltipContent>
                </Tooltip>
            );
        }

        const config = VERSION_TYPE_CONFIG[type];
        if (!config) return null;

        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <Badge className={cn("ml-auto", config.className)}>
                        {config.label}
                    </Badge>
                </TooltipTrigger>
                <TooltipContent>
                    <p className="text-xs">{config.description}</p>
                </TooltipContent>
            </Tooltip>
        );
    }, []);

    const renderVersionItem = useCallback((
        version: ProcessedVersion,
        disabled?: boolean
    ) => (
        <CommandItem
            key={version.value}
            value={version.value}
            onSelect={() => !disabled && !version.isConflict && handleVersionSelect(version.value)}
            className={cn(
                "flex items-center transition-colors",
                (disabled || version.isConflict) && "opacity-50 cursor-not-allowed",
                version.isConflict && "text-red-600 dark:text-red-400",
                version.isCurrent && "bg-blue-50 dark:bg-blue-950/20 border-l-2 border-blue-500"
            )}
            disabled={disabled || version.isConflict}
        >
            <Check
                className={cn(
                    "mr-2 h-4 w-4",
                    version.value === versionUtils.formatVersion(input) ? "opacity-100" : "opacity-0"
                )}
            />
            <span className="flex-1 font-medium">{version.value}</span>
            {renderVersionTypeBadge(version.type, version.isConflict, version.isCurrent)}
        </CommandItem>
    ), [input, versionUtils, handleVersionSelect, renderVersionTypeBadge]);

    // ===== Main Render =====
    return (
        <TooltipProvider>
            <Popover
                open={isOpen}
                onOpenChange={(open) => !disabled && dispatch({ isOpen: open })}
            >
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        disabled={disabled}
                        className={cn(
                            "w-[200px] justify-between",
                            !version && "text-muted-foreground",
                            hasConflict && "border-red-500 bg-red-50 dark:bg-red-950/10"
                        )}
                    >
                        <div className="flex items-center text-left truncate">
                            <span className="truncate">
                                {version || "Select version..."}
                            </span>
                            {version && !versionUtils.isSemVer(version) && (
                                <Badge variant="outline" className="ml-1 h-4 text-xs">
                                    Custom
                                </Badge>
                            )}
                            {hasConflict && (
                                <AlertTriangle className="ml-1 h-3 w-3 text-red-500" />
                            )}
                        </div>
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>

                <PopoverContent className="w-[320px] p-0" align="start">
                    <Tabs
                        value={activeTab}
                        onValueChange={(value) => dispatch({ activeTab: value as VersionFormat })}
                        className="w-full"
                    >
                        {/* Header with tabs and refresh */}
                        <div className="flex items-center justify-between px-3 pt-3 pb-2">
                            <TabsList className="grid grid-cols-2 h-8">
                                <TabsTrigger value="semver" className="text-xs">
                                    <Tag className="h-3 w-3 mr-1" />
                                    SemVer
                                </TabsTrigger>
                                <TabsTrigger value="custom" className="text-xs">
                                    <Calendar className="h-3 w-3 mr-1" />
                                    Custom
                                </TabsTrigger>
                            </TabsList>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleRefreshVersions}
                                className="h-8 w-8 p-0"
                                disabled={isVersionsLoading}
                            >
                                <RefreshCw className={cn("h-3 w-3", isVersionsLoading && "animate-spin")} />
                            </Button>
                        </div>

                        {/* Conflict Alert */}
                        <AnimatePresence>
                            {hasConflict && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mx-3 mb-2"
                                >
                                    <Alert variant="destructive" borderStyle="accent">
                                        <AlertDescription>
                                            This version already exists. Please choose a different version.
                                        </AlertDescription>
                                        <AlertActions>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => dispatch({ hasConflict: false, input: '' })}
                                            >
                                                Clear
                                            </Button>
                                        </AlertActions>
                                    </Alert>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Command Interface */}
                        <Command shouldFilter={false}>
                            <div className="relative">
                                <CommandInput
                                    placeholder={activeTab === 'semver' ? "Find version..." : "Enter custom version..."}
                                    value={input}
                                    onValueChange={handleInputChange}
                                    onKeyDown={handleKeyDown}
                                    ref={inputRef}
                                    className="border-b"
                                />
                                {isValidating && (
                                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                    </div>
                                )}
                            </div>

                            <CommandList>
                                <CommandEmpty>
                                    {versionUtils.isValidVersion(input) ? (
                                        <div className="p-2">
                                            <div className="flex items-center gap-1 text-sm mb-2">
                                                {hasConflict ? (
                                                    <>
                                                        <AlertTriangle className="h-4 w-4 text-red-500" />
                                                        <span className="text-red-600">Version conflict detected</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Check className="h-4 w-4 text-green-500" />
                                                        <span>Use custom version:</span>
                                                    </>
                                                )}
                                            </div>
                                            <Button
                                                size="sm"
                                                className="w-full"
                                                onClick={handleCreateCustomVersion}
                                                disabled={hasConflict || isValidating}
                                                variant={hasConflict ? "destructive" : "default"}
                                            >
                                                {versionUtils.formatVersion(input)}
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="p-4 text-center text-sm text-muted-foreground">
                                            {isVersionsLoading ? 'Loading versions...' : 'No versions found'}
                                        </div>
                                    )}
                                </CommandEmpty>

                                {/* SemVer Tab */}
                                <TabsContent value="semver" className="mt-0 border-none p-0">
                                    <CommandGroup heading="Recommended Updates">
                                        {suggestions.map((suggestion) => renderVersionItem(suggestion))}
                                    </CommandGroup>

                                    {semverVersions.length > 0 && (
                                        <>
                                            <div className="px-2 pt-2 pb-1 border-t">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="w-full justify-start text-muted-foreground text-xs hover:text-foreground"
                                                    onClick={() => dispatch({ type: 'toggle-previous' })}
                                                >
                                                    <motion.div
                                                        animate={{ rotate: showPrevious ? 90 : 0 }}
                                                        transition={{ duration: 0.2 }}
                                                        className="mr-1"
                                                    >
                                                        <ChevronDown className="h-3 w-3" />
                                                    </motion.div>
                                                    {showPrevious ? "Hide" : "Show"} previous versions ({semverVersions.length})
                                                </Button>
                                            </div>

                                            <AnimatePresence>
                                                {showPrevious && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        transition={{ duration: 0.2 }}
                                                    >
                                                        <CommandGroup heading="Previous Versions">
                                                            <div className="max-h-[200px] overflow-y-auto">
                                                                {semverVersions.map((version) => renderVersionItem(version, true))}
                                                            </div>
                                                        </CommandGroup>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </>
                                    )}

                                    <div className="p-3 border-t bg-muted/30">
                                        <div className="flex items-center text-xs text-muted-foreground">
                                            <Info className="h-3 w-3 mr-2 flex-shrink-0" />
                                            <span>
                                                SemVer format: <code className="px-1.5 py-0.5 bg-background rounded text-xs font-mono">vMAJOR.MINOR.PATCH</code>
                                            </span>
                                        </div>
                                    </div>
                                </TabsContent>

                                {/* Custom Tab */}
                                <TabsContent value="custom" className="mt-0 border-none p-0">
                                    <CommandGroup heading="Create Custom Version">
                                        <div className="px-2 py-1">
                                            <p className="text-xs text-muted-foreground mb-2">
                                                Enter any version format, such as:
                                            </p>

                                            <div className="flex flex-wrap gap-1 mb-2">
                                                {customTemplates.map((template, index) => (
                                                    <Button
                                                        key={index}
                                                        variant={template.isConflict ? "destructive" : template.isCurrent ? "default" : "outline"}
                                                        size="sm"
                                                        className={cn(
                                                            "h-6 text-xs transition-colors",
                                                            template.isCurrent && "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-300"
                                                        )}
                                                        onClick={() => !template.isConflict && dispatch({ input: template.value })}
                                                        disabled={template.isConflict}
                                                    >
                                                        {template.value}
                                                        {template.isConflict && <AlertTriangle className="ml-1 h-2 w-2" />}
                                                        {template.isCurrent && <Check className="ml-1 h-2 w-2" />}
                                                    </Button>
                                                ))}
                                            </div>

                                            <Separator className="my-2" />

                                            <div className="flex items-center">
                                                <Button
                                                    size="sm"
                                                    className="w-full"
                                                    disabled={!versionUtils.isValidVersion(input) || hasConflict || isValidating}
                                                    onClick={handleCreateCustomVersion}
                                                    variant={hasConflict ? "destructive" : "default"}
                                                >
                                                    {isValidating ? (
                                                        <>
                                                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                                            Checking...
                                                        </>
                                                    ) : (
                                                        `Use ${versionUtils.formatVersion(input || 'custom version')}`
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </CommandGroup>

                                    {/* Previous custom versions */}
                                    {customVersions.length > 0 && (
                                        <CommandGroup heading="Previous Custom Versions">
                                            <div className="max-h-[150px] overflow-y-auto">
                                                {customVersions.map((version) => renderVersionItem(version, true))}
                                            </div>
                                        </CommandGroup>
                                    )}

                                    {/* Custom version help */}
                                    <div className="p-3 border-t bg-muted/30">
                                        <div className="flex items-start text-xs text-muted-foreground">
                                            <Info className="h-3 w-3 mr-2 flex-shrink-0 mt-0.5" />
                                            <div className="space-y-1">
                                                <p>Custom versions can use any format:</p>
                                                <ul className="list-disc list-inside space-y-0.5 ml-2">
                                                    <li><code className="px-1 bg-background rounded">v2024.12.25</code> - Date-based</li>
                                                    <li><code className="px-1 bg-background rounded">v20241225</code> - Compact date</li>
                                                    <li><code className="px-1 bg-background rounded">beta-1.0</code> - Named releases</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </TabsContent>
                            </CommandList>
                        </Command>
                    </Tabs>
                </PopoverContent>
            </Popover>
        </TooltipProvider>
    );
};

export default VersionSelector;