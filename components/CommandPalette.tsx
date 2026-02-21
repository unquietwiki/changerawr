'use client';

import {Command} from 'cmdk';
import {useCallback, useEffect, useState} from 'react';
import {useDebounce} from 'use-debounce';
import {
    ArrowDownIcon,
    ArrowUpIcon,
    BookOpenIcon,
    ClockIcon,
    MagnifyingGlassIcon,
    XMarkIcon
} from '@heroicons/react/24/outline';
import {AnimatePresence, motion} from 'framer-motion';
import {SearchX} from 'lucide-react';
import {useTimezone} from '@/hooks/use-timezone';

interface SearchResult {
    id: string;
    title: string;
    content?: string;
    type: 'entry';
    url: string;
    tags?: Array<{
        id: string;
        name: string;
        color: string | null;
    }>;
    projectId?: string;
    projectName?: string;
    version?: string | null;
    publishedAt?: Date | null;
}

interface CommandPaletteProps {
    isOpen: boolean;
    onClose: () => void;
}

const ENABLE_TAGS = false; // Feature flag for tags

export default function ChangelogCommandPalette({isOpen, onClose}: CommandPaletteProps) {
    const timezone = useTimezone();
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);

    const [debouncedSearch] = useDebounce(search, 300);

    useEffect(() => {
        const performSearch = async () => {
            if (!debouncedSearch.trim() || debouncedSearch.length < 2) {
                setResults([]);
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const response = await fetch('/api/search', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        query: debouncedSearch,
                        limit: 12,
                        types: ['entry'] // Only search entries for now
                    })
                });

                const data = await response.json();
                setResults(data.results || []);
                setSelectedIndex(0);
            } catch (error) {
                console.error('Search failed:', error);
                setResults([]);
            } finally {
                setLoading(false);
            }
        };

        performSearch();
    }, [debouncedSearch]);

    useEffect(() => {
        if (search && search.length >= 2 && search !== debouncedSearch) {
            setLoading(true);
        }
    }, [search, debouncedSearch]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedIndex(prev => prev < results.length - 1 ? prev + 1 : prev);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedIndex(prev => prev > 0 ? prev - 1 : prev);
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (results[selectedIndex]) {
                        handleSelect(results[selectedIndex]);
                    }
                    break;
                case 'Escape':
                    onClose();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, results, selectedIndex, onClose]);

    const handleSelect = useCallback((result: SearchResult) => {
        onClose();
        setSearch('');
        setResults([]);
        window.location.href = result.url;
    }, [onClose]);

    const formatRelativeTime = (date: Date | null | undefined) => {
        if (!date) return null;

        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);

        if (diffInSeconds < 60) return 'just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;

        return new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            timeZone: timezone,
        });
    };

    const formatVersion = (version: string | null | undefined) => {
        if (!version) return null;
        return version.toLowerCase().startsWith('v') ? version : `v${version}`;
    };

    const getTagStyles = (color: string | null) => {
        if (!color) {
            return {
                backgroundColor: 'rgba(99, 102, 241, 0.08)',
                color: '#6366f1',
                borderColor: 'rgba(99, 102, 241, 0.2)'
            };
        }

        const hexToRgb = (hex: string) => {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        };

        const rgb = hexToRgb(color);
        if (!rgb) return {backgroundColor: color + '15', color};

        return {
            backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`,
            color: color,
            borderColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`
        };
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                exit={{opacity: 0}}
                transition={{duration: 0.15}}
                className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]"
                onClick={onClose}
            >
                {/* Backdrop with blur */}
                <motion.div initial={{opacity: 0, scale: 0.96, y: -20}}
                            animate={{opacity: 1, scale: 1, y: 0}}
                            className="absolute inset-0 bg-black/40 backdrop-blur-md"/>

                <motion.div
                    initial={{opacity: 0, scale: 0.96, y: -20}}
                    animate={{opacity: 1, scale: 1, y: 0}}
                    exit={{opacity: 0, scale: 0.96, y: -20}}
                    transition={{
                        type: "spring",
                        duration: 0.4,
                        bounce: 0.1
                    }}
                    className="relative w-full max-w-2xl mx-6 bg-white/95 dark:bg-gray-950/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-gray-800/50 overflow-hidden"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        boxShadow: `
              0 0 0 1px rgba(255, 255, 255, 0.05),
              0 25px 50px -12px rgba(0, 0, 0, 0.25),
              0 0 80px rgba(99, 102, 241, 0.1)
            `
                    }}
                >
                    {/* Subtle animated border */}
                    <div
                        className="absolute inset-0 rounded-2xl bg-gradient-to-r from-violet-500/20 via-cyan-500/20 to-violet-500/20 p-px">
                        <div className="w-full h-full bg-white/95 dark:bg-gray-950/95 rounded-2xl"/>
                    </div>

                    <div className="relative">
                        <Command
                            shouldFilter={false}
                            className="[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-3 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:text-gray-500 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:border-t [&_[cmdk-group-heading]]:border-gray-100 [&_[cmdk-group-heading]]:dark:border-gray-800 [&_[cmdk-group-heading]]:mt-2 [&_[cmdk-group-heading]:first-child]:border-t-0 [&_[cmdk-group-heading]:first-child]:mt-0"
                        >
                            {/* Search Header */}
                            <div
                                className="relative flex items-center px-6 py-6 border-b border-gray-100/50 dark:border-gray-800/50">
                                <div className="absolute left-6 pointer-events-none">
                                    <MagnifyingGlassIcon className="w-5 h-5 text-indigo-500"/>
                                </div>

                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search everything..."
                                    className="w-full pl-12 pr-12 py-1 text-lg bg-transparent outline-none placeholder-gray-400 dark:text-white font-medium border-none"
                                    style={{
                                        border: 'none',
                                        outline: 'none',
                                        boxShadow: 'none',
                                        WebkitAppearance: 'none',
                                        MozAppearance: 'none',
                                        appearance: 'none',
                                        background: 'transparent'
                                    }}
                                    autoFocus
                                />

                                <AnimatePresence>
                                    {search && (
                                        <motion.button
                                            initial={{opacity: 0, scale: 0.8}}
                                            animate={{opacity: 1, scale: 1}}
                                            exit={{opacity: 0, scale: 0.8}}
                                            onClick={() => setSearch('')}
                                            className="absolute right-6 p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors duration-200"
                                        >
                                            <XMarkIcon className="w-4 h-4 text-gray-400"/>
                                        </motion.button>
                                    )}
                                </AnimatePresence>
                            </div>

                            <Command.List className="max-h-96 overflow-y-auto">
                                {/* Empty State */}
                                {!loading && search && results.length === 0 && (
                                    <motion.div
                                        initial={{opacity: 0, y: 20}}
                                        animate={{opacity: 1, y: 0}}
                                        className="flex flex-col items-center justify-center py-16 px-6"
                                    >
                                        <motion.div
                                            initial={{scale: 0.8}}
                                            animate={{scale: 1}}
                                            transition={{delay: 0.1}}
                                            className="relative mb-4"
                                        >
                                            <div
                                                className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 rounded-2xl flex items-center justify-center shadow-lg">
                                                <SearchX className="w-8 h-8 text-gray-400"/>
                                            </div>
                                            <div
                                                className="absolute -inset-2 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl blur-xl"/>
                                        </motion.div>
                                        <h3 className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-1">
                                            No results found
                                        </h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                                            Try adjusting your search terms
                                        </p>
                                    </motion.div>
                                )}

                                {/* Search Results */}
                                {results.length > 0 && (
                                    <Command.Group heading="Changelog Entries">
                                        {results.map((result, index) => {
                                            const isSelected = index === selectedIndex;

                                            return (
                                                <motion.div
                                                    key={result.id}
                                                    initial={{opacity: 0, y: 8}}
                                                    animate={{opacity: 1, y: 0}}
                                                    transition={{delay: index * 0.05, duration: 0.2}}
                                                >
                                                    <Command.Item
                                                        onSelect={() => handleSelect(result)}
                                                        className={`
                              relative flex items-start p-4 mx-2 mb-1 rounded-xl cursor-pointer transition-all duration-200 group
                              ${isSelected
                                                            ? 'bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/50 dark:to-purple-950/50 shadow-lg ring-1 ring-indigo-200/50 dark:ring-indigo-800/50'
                                                            : 'hover:bg-gray-50 dark:hover:bg-gray-900/30'
                                                        }
                            `}
                                                    >
                                                        {/* Animated selection indicator */}
                                                        <AnimatePresence>
                                                            {isSelected && (
                                                                <motion.div
                                                                    layoutId="selection-indicator"
                                                                    className="absolute left-0 top-1/2 w-1 h-8 bg-gradient-to-b from-indigo-500 to-purple-500 rounded-r-full"
                                                                    initial={{opacity: 0, x: -4}}
                                                                    animate={{opacity: 1, x: 0}}
                                                                    exit={{opacity: 0, x: -4}}
                                                                    transition={{type: "spring", bounce: 0.3}}
                                                                />
                                                            )}
                                                        </AnimatePresence>

                                                        {/* Content Icon */}
                                                        <div
                                                            className={`flex-shrink-0 mr-3 mt-0.5 transition-all duration-200 ${
                                                                isSelected
                                                                    ? 'text-indigo-600 dark:text-indigo-400 scale-110'
                                                                    : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'
                                                            }`}>
                                                            <BookOpenIcon className="w-5 h-5"/>
                                                        </div>

                                                        <div className="flex-1 min-w-0">
                                                            {/* Title */}
                                                            <h3 className={`font-semibold text-base mb-1 transition-colors duration-200 ${
                                                                isSelected
                                                                    ? 'text-indigo-900 dark:text-indigo-100'
                                                                    : 'text-gray-900 dark:text-gray-100'
                                                            }`}>
                                                                {result.title}
                                                            </h3>

                                                            {/* Content Preview */}
                                                            {result.content && (
                                                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2 leading-relaxed">
                                                                    {result.content}
                                                                </p>
                                                            )}

                                                            {/* Metadata */}
                                                            <div className="flex items-center gap-2 mb-2">
                                                                {result.projectName && (
                                                                    <span
                                                                        className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md">
                                    {result.projectName}
                                  </span>
                                                                )}

                                                                {result.version && (
                                                                    <span
                                                                        className="inline-flex items-center px-2 py-1 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-md">
                                    {formatVersion(result.version)}
                                  </span>
                                                                )}

                                                                {result.publishedAt && (
                                                                    <span
                                                                        className="inline-flex items-center text-xs text-gray-500 dark:text-gray-400">
                                    <ClockIcon className="w-3 h-3 mr-1"/>
                                                                        {formatRelativeTime(new Date(result.publishedAt))}
                                  </span>
                                                                )}
                                                            </div>

                                                            {/* Tags */}
                                                            {ENABLE_TAGS && result.tags && result.tags.length > 0 && (
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {result.tags.slice(0, 3).map((tag) => (
                                                                        <span
                                                                            key={tag.id}
                                                                            className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border"
                                                                            style={getTagStyles(tag.color)}
                                                                        >
                                      {tag.name}
                                    </span>
                                                                    ))}
                                                                    {result.tags.length > 3 && (
                                                                        <span
                                                                            className="inline-flex items-center px-2 py-0.5 text-xs text-gray-500 dark:text-gray-400">
                                      +{result.tags.length - 3}
                                    </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </Command.Item>
                                                </motion.div>
                                            );
                                        })}
                                    </Command.Group>
                                )}
                            </Command.List>

                            {/* Footer */}
                            <div
                                className="border-t border-gray-100/50 dark:border-gray-800/50 px-4 py-3 bg-gray-50/50 dark:bg-gray-900/30">
                                <div
                                    className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-1.5">
                                            <kbd
                                                className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono shadow-sm">
                                                ↵
                                            </kbd>
                                            <span>select</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <div className="flex">
                                                <kbd
                                                    className="px-1.5 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-l text-xs font-mono shadow-sm">
                                                    <ArrowUpIcon className="w-3 h-3"/>
                                                </kbd>
                                                <kbd
                                                    className="px-1.5 py-1 bg-white dark:bg-gray-800 border-t border-r border-b border-gray-200 dark:border-gray-700 rounded-r text-xs font-mono shadow-sm">
                                                    <ArrowDownIcon className="w-3 h-3"/>
                                                </kbd>
                                            </div>
                                            <span>navigate</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <kbd
                                            className="px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded text-xs font-mono shadow-sm">
                                            esc
                                        </kbd>
                                        <span>close</span>
                                    </div>
                                </div>
                            </div>
                        </Command>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}