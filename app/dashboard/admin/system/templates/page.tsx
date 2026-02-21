'use client'

import React, {useState, useEffect, useMemo} from 'react'
import {useQuery, useMutation} from '@tanstack/react-query'
import {useToast} from '@/hooks/use-toast'
import {useRouter} from 'next/navigation'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import {Input} from '@/components/ui/input'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {Separator} from '@/components/ui/separator'
import {
    ArrowLeft,
    Plus,
    Trash2,
    Save,
    Calendar,
    Tag,
    Eye,
    GripVertical,
    Loader2,
} from 'lucide-react'
import Link from 'next/link'

interface DateTemplate {
    format: string
    label: string
}

interface SystemConfig {
    customDateTemplates?: DateTemplate[] | null
    timezone?: string
    [key: string]: unknown
}

// All available template variables
const TEMPLATE_VARIABLES = [
    {category: 'Date & Time', variables: [
        {token: '{YYYY}', description: 'Full year', example: '2026'},
        {token: '{YY}', description: '2-digit year', example: '26'},
        {token: '{MM}', description: 'Month (01-12)', example: '02'},
        {token: '{DD}', description: 'Day (01-31)', example: '20'},
        {token: '{hh}', description: 'Hour (00-23)', example: '14'},
        {token: '{mm}', description: 'Minute (00-59)', example: '30'},
        {token: '{ss}', description: 'Second (00-59)', example: '45'},
    ]},
    {category: 'Version', variables: [
        {token: '{MAJOR}', description: 'Latest major version number', example: '1'},
        {token: '{MINOR}', description: 'Latest minor version number', example: '5'},
        {token: '{PATCH}', description: 'Latest patch version number', example: '3'},
        {token: '{VERSION}', description: 'Full latest version (no v prefix)', example: '1.5.3'},
        {token: '{NEXT_PATCH}', description: 'Next patch number', example: '4'},
        {token: '{NEXT_MINOR}', description: 'Next minor number', example: '6'},
        {token: '{NEXT_MAJOR}', description: 'Next major number', example: '2'},
    ]},
]

const DEFAULT_TEMPLATES: DateTemplate[] = [
    {format: 'v{YYYY}.{MM}.{DD}', label: 'Date (dotted)'},
    {format: 'v{YYYY}.{MM}.{DD}.1', label: 'Date (revision)'},
    {format: 'v{YYYY}{MM}{DD}', label: 'Date (compact)'},
]

function resolvePreview(format: string, timezone: string): string {
    const now = new Date()
    const dateParts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(now)
    const timeParts = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(now)

    const year = dateParts.find(p => p.type === 'year')?.value ?? '2026'
    const month = dateParts.find(p => p.type === 'month')?.value ?? '01'
    const day = dateParts.find(p => p.type === 'day')?.value ?? '01'
    const hour = timeParts.find(p => p.type === 'hour')?.value ?? '00'
    const minute = timeParts.find(p => p.type === 'minute')?.value ?? '00'
    const second = timeParts.find(p => p.type === 'second')?.value ?? '00'

    // Version variables use placeholder values for preview
    return format
        .replace(/\{YYYY}/g, year)
        .replace(/\{YY}/g, year.slice(-2))
        .replace(/\{MM}/g, month)
        .replace(/\{DD}/g, day)
        .replace(/\{hh}/g, hour)
        .replace(/\{mm}/g, minute)
        .replace(/\{ss}/g, second)
        .replace(/\{MAJOR}/g, '1')
        .replace(/\{MINOR}/g, '5')
        .replace(/\{PATCH}/g, '3')
        .replace(/\{VERSION}/g, '1.5.3')
        .replace(/\{NEXT_PATCH}/g, '4')
        .replace(/\{NEXT_MINOR}/g, '6')
        .replace(/\{NEXT_MAJOR}/g, '2')
}

export default function VersionTemplatesPage() {
    const {toast} = useToast()
    const router = useRouter()
    const [templates, setTemplates] = useState<DateTemplate[]>([])
    const [newFormat, setNewFormat] = useState('')
    const [newLabel, setNewLabel] = useState('')
    const [hasChanges, setHasChanges] = useState(false)

    const {data: config, isLoading} = useQuery<SystemConfig>({
        queryKey: ['system-config'],
        queryFn: async () => {
            const response = await fetch('/api/admin/config')
            if (!response.ok) throw new Error('Failed to fetch config')
            return response.json()
        },
    })

    const timezone = config?.timezone ?? 'UTC'

    // Initialize templates from config
    useEffect(() => {
        if (config) {
            setTemplates(config.customDateTemplates ?? [])
            setHasChanges(false)
        }
    }, [config])

    const saveMutation = useMutation({
        mutationFn: async () => {
            // We need to send the full config, so fetch current first
            const currentRes = await fetch('/api/admin/config')
            if (!currentRes.ok) throw new Error('Failed to fetch current config')
            const current = await currentRes.json()

            const response = await fetch('/api/admin/config', {
                method: 'PATCH',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    ...current,
                    customDateTemplates: templates.length > 0 ? templates : null,
                }),
            })
            if (!response.ok) throw new Error('Failed to save templates')
            return response.json()
        },
        onSuccess: () => {
            toast({title: 'Templates Saved', description: 'Version templates have been updated.'})
            setHasChanges(false)
        },
        onError: (error) => {
            toast({title: 'Save Failed', description: error.message, variant: 'destructive'})
        },
    })

    const addTemplate = () => {
        if (!newFormat.trim() || !newLabel.trim()) return
        setTemplates(prev => [...prev, {format: newFormat.trim(), label: newLabel.trim()}])
        setNewFormat('')
        setNewLabel('')
        setHasChanges(true)
    }

    const removeTemplate = (index: number) => {
        setTemplates(prev => prev.filter((_, i) => i !== index))
        setHasChanges(true)
    }

    const addDefaults = () => {
        setTemplates(prev => {
            const existingFormats = new Set(prev.map(t => t.format))
            const newTemplates = DEFAULT_TEMPLATES.filter(t => !existingFormats.has(t.format))
            return [...prev, ...newTemplates]
        })
        setHasChanges(true)
    }

    // Live preview for the "new" input
    const newFormatPreview = useMemo(() => {
        if (!newFormat.trim()) return ''
        return resolvePreview(newFormat, timezone)
    }, [newFormat, timezone])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" asChild>
                        <Link href="/dashboard/admin/system">
                            <ArrowLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-xl font-semibold">Version Templates</h1>
                        <p className="text-sm text-muted-foreground">
                            Custom version format templates for the changelog editor
                        </p>
                    </div>
                </div>
                <Button
                    onClick={() => saveMutation.mutate()}
                    disabled={!hasChanges || saveMutation.isPending}
                    size="sm"
                >
                    {saveMutation.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                        <Save className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Save Changes
                </Button>
            </div>

            {/* Variable Reference */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Available Variables</CardTitle>
                    <CardDescription>
                        Use these variables in your format strings. They get replaced with real values when a user opens the version selector.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {TEMPLATE_VARIABLES.map(group => (
                            <div key={group.category}>
                                <div className="flex items-center gap-2 mb-2">
                                    {group.category === 'Date & Time' ? (
                                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                    ) : (
                                        <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                                    )}
                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        {group.category}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                    {group.variables.map(v => (
                                        <button
                                            key={v.token}
                                            type="button"
                                            className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left hover:bg-accent/50 transition-colors group"
                                            onClick={() => setNewFormat(prev => prev + v.token)}
                                        >
                                            <code className="font-mono text-xs font-medium text-primary">{v.token}</code>
                                            <span className="text-[11px] text-muted-foreground flex-1 truncate">{v.description}</span>
                                            <Badge variant="secondary" className="text-[10px] px-1 h-4 font-mono opacity-60 group-hover:opacity-100">
                                                {v.example}
                                            </Badge>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Templates */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-base">Templates</CardTitle>
                            <CardDescription>
                                {templates.length === 0
                                    ? 'No custom templates configured. Built-in date templates will be used.'
                                    : `${templates.length} custom template${templates.length !== 1 ? 's' : ''} configured`
                                }
                            </CardDescription>
                        </div>
                        {templates.length === 0 && (
                            <Button variant="outline" size="sm" onClick={addDefaults}>
                                Add Defaults
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    {/* Existing templates */}
                    {templates.length > 0 && (
                        <div className="space-y-1.5">
                            {templates.map((template, index) => (
                                <div
                                    key={index}
                                    className="flex items-center gap-2 rounded-md border px-3 py-2 group"
                                >
                                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
                                    <code className="font-mono text-sm flex-1 min-w-0 truncate">{template.format}</code>
                                    <Separator orientation="vertical" className="h-4" />
                                    <span className="text-xs text-muted-foreground shrink-0">{template.label}</span>
                                    <Separator orientation="vertical" className="h-4" />
                                    <div className="flex items-center gap-1 shrink-0">
                                        <Eye className="h-3 w-3 text-muted-foreground" />
                                        <code className="font-mono text-[11px] text-muted-foreground">
                                            {resolvePreview(template.format, timezone)}
                                        </code>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                        onClick={() => removeTemplate(index)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}

                    <Separator />

                    {/* Add new template */}
                    <div className="space-y-2">
                        <span className="text-xs font-medium text-muted-foreground">Add Template</span>
                        <div className="flex items-end gap-2">
                            <div className="flex-1 space-y-1">
                                <label className="text-xs text-muted-foreground">Format</label>
                                <Input
                                    placeholder="v{YYYY}.{MM}.{DD}"
                                    value={newFormat}
                                    onChange={(e) => setNewFormat(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addTemplate()}
                                    className="h-8 font-mono text-sm"
                                />
                            </div>
                            <div className="w-36 space-y-1">
                                <label className="text-xs text-muted-foreground">Label</label>
                                <Input
                                    placeholder="Date (dotted)"
                                    value={newLabel}
                                    onChange={(e) => setNewLabel(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addTemplate()}
                                    className="h-8 text-sm"
                                />
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8"
                                disabled={!newFormat.trim() || !newLabel.trim()}
                                onClick={addTemplate}
                            >
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                Add
                            </Button>
                        </div>
                        {/* Live preview */}
                        {newFormatPreview && (
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-1">
                                <Eye className="h-3 w-3" />
                                Preview: <code className="font-mono bg-muted px-1 rounded">{newFormatPreview}</code>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Info note */}
            <p className="text-xs text-muted-foreground text-center">
                Version variables ({'{MAJOR}'}, {'{MINOR}'}, {'{PATCH}'}, etc.) are resolved per-project based on the latest published version.
                {' '}If no custom templates are saved, built-in date templates are shown.
            </p>
        </div>
    )
}
