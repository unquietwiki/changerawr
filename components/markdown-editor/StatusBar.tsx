'use client';

import React from 'react';
import { Info, Clock, Check, AlertCircle } from 'lucide-react';
import { useTimezone } from '@/hooks/use-timezone';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

export interface StatusBarProps {
    /**
     * Number of words in the document
     */
    wordCount: number;

    /**
     * Number of characters in the document
     */
    charCount: number;

    /**
     * Number of lines in the document
     */
    lineCount?: number;

    /**
     * Current cursor position (line, column)
     */
    cursorPosition?: {
        line: number;
        column: number;
    };

    /**
     * Reading time in minutes
     */
    readingTime?: number;

    /**
     * Whether the document has been saved
     */
    isSaved?: boolean;

    /**
     * Status message to display
     */
    statusMessage?: string;

    /**
     * Last saved timestamp
     */
    lastSaved?: Date;

    /**
     * Additional CSS classes
     */
    className?: string;
}

/**
 * Time formatter for last saved timestamp
 */
function formatSaveTime(date: Date, timezone = 'UTC'): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // If less than a minute ago
    if (diff < 60000) {
        return 'just now';
    }

    // If less than an hour ago
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
    }

    // Format time for today
    if (date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()) {
        return `today at ${date.toLocaleString('en-US', {
            hour: 'numeric',
            minute: 'numeric',
            hour12: true,
            timeZone: timezone,
        })}`;
    }

    // Format for other days
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true,
        timeZone: timezone,
    });
}

/**
 * Status bar component for markdown editor
 */
export default function StatusBar({
                                      wordCount,
                                      charCount,
                                      lineCount,
                                      cursorPosition,
                                      readingTime,
                                      isSaved,
                                      statusMessage,
                                      lastSaved,
                                      className = '',
                                  }: StatusBarProps) {
    const timezone = useTimezone();

    return (
        <div className={`flex items-center justify-between h-6 px-3 py-1 text-xs text-muted-foreground border-t bg-muted/20 ${className}`}>
            {/* Left side metrics */}
            <div className="flex items-center space-x-3">
                {/* Word count */}
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center">
                                <span className="font-medium">{wordCount}</span>
                                <span className="ml-1">words</span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            <p>Word count</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                {/* Character count */}
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center">
                                <span className="font-medium">{charCount}</span>
                                <span className="ml-1">characters</span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                            <p>Character count</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                {/* Line count if available */}
                {lineCount !== undefined && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex items-center">
                                    <span className="font-medium">{lineCount}</span>
                                    <span className="ml-1">lines</span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <p>Line count</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}

                {/* Reading time if available */}
                {readingTime !== undefined && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex items-center">
                                    <Clock className="w-3 h-3 mr-1" />
                                    <span className="font-medium">{readingTime}</span>
                                    <span className="ml-1">min read</span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <p>Estimated reading time</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>

            {/* Center - status message */}
            {statusMessage && (
                <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center">
                    {isSaved !== undefined && (
                        <>
                            {isSaved ? (
                                <Check className="w-3 h-3 mr-1 text-green-500" />
                            ) : (
                                <AlertCircle className="w-3 h-3 mr-1 text-amber-500" />
                            )}
                        </>
                    )}
                    <span>{statusMessage}</span>
                </div>
            )}

            {/* Right side - cursor position and saved status */}
            <div className="flex items-center space-x-3">
                {/* Cursor position if available */}
                {cursorPosition && (
                    <div className="flex items-center">
                        <span>Ln {cursorPosition.line}, Col {cursorPosition.column}</span>
                    </div>
                )}

                {/* Last saved timestamp if available */}
                {lastSaved && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="flex items-center">
                                    {isSaved && <Check className="w-3 h-3 mr-1 text-green-500" />}
                                    <span>Saved {formatSaveTime(lastSaved, timezone)}</span>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <p>
                                    Last saved: {lastSaved.toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                    hour: 'numeric',
                                    minute: 'numeric',
                                    second: 'numeric',
                                    hour12: true
                                })}
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}

                {/* If no lastSaved but we have an isSaved state */}
                {!lastSaved && isSaved !== undefined && (
                    <div className="flex items-center">
                        {isSaved ? (
                            <>
                                <Check className="w-3 h-3 mr-1 text-green-500" />
                                <span>Saved</span>
                            </>
                        ) : (
                            <>
                                <AlertCircle className="w-3 h-3 mr-1 text-amber-500" />
                                <span>Unsaved changes</span>
                            </>
                        )}
                    </div>
                )}

                {/* Help button */}
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button className="focus:outline-none">
                                <Info className="w-3.5 h-3.5 text-muted-foreground/80 hover:text-muted-foreground" />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" align="end">
                            <div className="space-y-1 max-w-xs">
                                <p className="font-medium">Keyboard Shortcuts</p>
                                <div className="text-xs grid grid-cols-2 gap-x-4 gap-y-1">
                                    <span>Bold</span>
                                    <span className="font-mono">Ctrl+B</span>
                                    <span>Italic</span>
                                    <span className="font-mono">Ctrl+I</span>
                                    <span>Link</span>
                                    <span className="font-mono">Ctrl+K</span>
                                    <span>Heading 1-3</span>
                                    <span className="font-mono">Ctrl+1,2,3</span>
                                    <span>Save</span>
                                    <span className="font-mono">Ctrl+S</span>
                                    <span>AI Assistant</span>
                                    <span className="font-mono">Alt+A</span>
                                </div>
                            </div>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        </div>
    );
}