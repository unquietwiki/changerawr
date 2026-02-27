'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
    Shield,
    Globe,
    Plus,
    Trash2,
    CheckCircle2,
    AlertCircle,
    Lock,
    Zap,
    Info,
} from 'lucide-react'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'

interface BrowserRule {
    id: string
    userAgentPattern: string
    ruleType: 'BLOCK' | 'ALLOW'
    isEnabled: boolean
}

interface ThrottleConfig {
    enabled: boolean
    requestsPerSecond: number
    burstSize: number
}

interface ExternalSSLManagementProps {
    domain: string
    browserRules?: BrowserRule[]
    throttleConfig?: ThrottleConfig | null
    onUpdate: () => void
    onError: (error: string) => void
    onSuccess: (message: string) => void
    onChangeMode?: () => void
}

export function ExternalSSLManagement({
    domain,
    browserRules = [],
    throttleConfig,
    onUpdate,
    onError,
    onSuccess,
    onChangeMode,
}: ExternalSSLManagementProps) {
    const [showAddRule, setShowAddRule] = useState(false)
    const [newRulePattern, setNewRulePattern] = useState('')
    const [newRuleType, setNewRuleType] = useState<'BLOCK' | 'ALLOW'>('BLOCK')

    return (
        <div className="space-y-6">
            <Separator />

            {/* Browser Rules */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                                <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <CardTitle className="text-base">Browser Access Rules</CardTitle>
                                <CardDescription>Control which browsers can access your domain</CardDescription>
                            </div>
                        </div>
                        <Button
                            size="sm"
                            onClick={() => setShowAddRule(!showAddRule)}
                            variant={showAddRule ? 'outline' : 'default'}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            {showAddRule ? 'Cancel' : 'Add Rule'}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Add Rule Form */}
                    {showAddRule && (
                        <div className="p-4 rounded-lg border bg-muted/50 space-y-3">
                            <div className="space-y-2">
                                <Label>User-Agent Pattern (Regex)</Label>
                                <Input
                                    placeholder="e.g., .*Chrome.*|.*Firefox.*"
                                    value={newRulePattern}
                                    onChange={(e) => setNewRulePattern(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Use regex patterns to match browser user agents
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label>Rule Type</Label>
                                <Select value={newRuleType} onValueChange={(v) => setNewRuleType(v as any)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="BLOCK">
                                            <div className="flex items-center gap-2">
                                                <AlertCircle className="w-4 h-4 text-destructive" />
                                                Block Access
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="ALLOW">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                                Allow Access
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button
                                size="sm"
                                onClick={async () => {
                                    if (!newRulePattern.trim()) {
                                        onError('Pattern cannot be empty')
                                        return
                                    }

                                    try {
                                        const response = await fetch(`/api/custom-domains/${domain}/browser-rules`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                userAgentPattern: newRulePattern,
                                                ruleType: newRuleType,
                                            }),
                                        })

                                        const result = await response.json()
                                        if (response.ok) {
                                            onSuccess('Browser rule added')
                                            setNewRulePattern('')
                                            setShowAddRule(false)
                                            onUpdate()
                                        } else {
                                            onError(result.error || 'Failed to add rule')
                                        }
                                    } catch (error) {
                                        onError('Failed to add browser rule')
                                    }
                                }}
                                className="w-full"
                            >
                                Add Rule
                            </Button>
                        </div>
                    )}

                    {/* Existing Rules */}
                    {browserRules.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Globe className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            <p className="text-sm">No browser rules configured</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {browserRules.map((rule) => (
                                <div key={rule.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <code className="text-sm font-mono">{rule.userAgentPattern}</code>
                                            <Badge
                                                variant={rule.ruleType === 'BLOCK' ? 'destructive' : 'default'}
                                                className={rule.ruleType === 'ALLOW' ? 'bg-green-600' : ''}
                                            >
                                                {rule.ruleType}
                                            </Badge>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={rule.isEnabled}
                                        onCheckedChange={async (enabled) => {
                                            try {
                                                const response = await fetch(
                                                    `/api/custom-domains/${domain}/browser-rules/${rule.id}`,
                                                    {
                                                        method: 'PATCH',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ isEnabled: enabled }),
                                                    }
                                                )

                                                if (response.ok) {
                                                    onSuccess(enabled ? 'Rule enabled' : 'Rule disabled')
                                                    onUpdate()
                                                } else {
                                                    onError('Failed to update rule')
                                                }
                                            } catch (error) {
                                                onError('Failed to update rule')
                                            }
                                        }}
                                    />
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={async () => {
                                            if (!confirm('Delete this rule?')) return

                                            try {
                                                const response = await fetch(
                                                    `/api/custom-domains/${domain}/browser-rules/${rule.id}`,
                                                    { method: 'DELETE' }
                                                )

                                                if (response.ok) {
                                                    onSuccess('Rule deleted')
                                                    onUpdate()
                                                } else {
                                                    onError('Failed to delete rule')
                                                }
                                            } catch (error) {
                                                onError('Failed to delete rule')
                                            }
                                        }}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Rate Limiting / Throttle */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
                            <Zap className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                        </div>
                        <div>
                            <CardTitle className="text-base">Rate Limiting</CardTitle>
                            <CardDescription>Control request rate limits for this domain</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                        <div className="flex items-start gap-3">
                            <div>
                                <Label htmlFor="throttle-enabled" className="font-medium cursor-pointer">
                                    Enable Rate Limiting
                                </Label>
                                <p className="text-sm text-muted-foreground mt-0.5">
                                    Protect your domain from excessive requests
                                </p>
                            </div>
                        </div>
                        <Switch
                            id="throttle-enabled"
                            checked={throttleConfig?.enabled || false}
                            onCheckedChange={async (enabled) => {
                                try {
                                    const response = await fetch(`/api/custom-domains/${domain}/throttle`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            enabled,
                                            requestsPerSecond: throttleConfig?.requestsPerSecond || 60,
                                            burstSize: throttleConfig?.burstSize || 20,
                                        }),
                                    })

                                    if (response.ok) {
                                        onSuccess(enabled ? 'Rate limiting enabled' : 'Rate limiting disabled')
                                        onUpdate()
                                    } else {
                                        onError('Failed to update rate limiting')
                                    }
                                } catch (error) {
                                    onError('Failed to update rate limiting')
                                }
                            }}
                        />
                    </div>

                    {throttleConfig?.enabled && (
                        <div className="grid grid-cols-2 gap-4 p-4 rounded-lg border bg-muted/50">
                            <div className="space-y-2">
                                <Label>Requests Per Second</Label>
                                <Input
                                    type="number"
                                    value={throttleConfig.requestsPerSecond}
                                    onChange={async (e) => {
                                        const value = parseInt(e.target.value)
                                        if (value < 1) return

                                        try {
                                            const response = await fetch(`/api/custom-domains/${domain}/throttle`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    enabled: true,
                                                    requestsPerSecond: value,
                                                    burstSize: throttleConfig.burstSize,
                                                }),
                                            })

                                            if (response.ok) {
                                                onUpdate()
                                            }
                                        } catch (error) {
                                            console.error('Failed to update throttle config')
                                        }
                                    }}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Burst Size</Label>
                                <Input
                                    type="number"
                                    value={throttleConfig.burstSize}
                                    onChange={async (e) => {
                                        const value = parseInt(e.target.value)
                                        if (value < 1) return

                                        try {
                                            const response = await fetch(`/api/custom-domains/${domain}/throttle`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    enabled: true,
                                                    requestsPerSecond: throttleConfig.requestsPerSecond,
                                                    burstSize: value,
                                                }),
                                            })

                                            if (response.ok) {
                                                onUpdate()
                                            }
                                        } catch (error) {
                                            console.error('Failed to update throttle config')
                                        }
                                    }}
                                />
                            </div>
                            <div className="col-span-2">
                                <Alert>
                                    <Info className="h-4 w-4" />
                                    <AlertDescription className="text-xs">
                                        Requests exceeding {throttleConfig.requestsPerSecond}/sec will be rate limited.
                                        Burst allows temporary spikes up to {throttleConfig.burstSize} requests.
                                    </AlertDescription>
                                </Alert>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
