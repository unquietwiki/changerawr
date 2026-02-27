'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Lock, RotateCw, ShieldOff, RefreshCw } from 'lucide-react'

interface SSLCertificateActionsProps {
    domain: string
    forceHttps: boolean
    onToggleForceHttps: (enabled: boolean) => Promise<void>
    onRenew: () => Promise<void>
    onRevoke: () => Promise<void>
    onError: (error: string) => void
    onSuccess: (message: string) => void
}

export function SSLCertificateActions({
    domain,
    forceHttps,
    onToggleForceHttps,
    onRenew,
    onRevoke,
    onError,
    onSuccess,
}: SSLCertificateActionsProps) {
    const [isTogglingHttps, setIsTogglingHttps] = useState(false)
    const [isRenewing, setIsRenewing] = useState(false)
    const [isRevoking, setIsRevoking] = useState(false)

    const handleToggleForceHttps = async (enabled: boolean) => {
        setIsTogglingHttps(true)
        try {
            await onToggleForceHttps(enabled)
        } finally {
            setIsTogglingHttps(false)
        }
    }

    const handleRenew = async () => {
        setIsRenewing(true)
        try {
            await onRenew()
        } finally {
            setIsRenewing(false)
        }
    }

    const handleRevoke = async () => {
        if (!confirm('Are you sure you want to revoke this certificate?')) {
            return
        }
        setIsRevoking(true)
        try {
            await onRevoke()
        } finally {
            setIsRevoking(false)
        }
    }

    return (
        <div className="space-y-4">
            <Separator />

            {/* Force HTTPS Toggle */}
            <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                        <Lock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <Label htmlFor="force-https" className="font-medium cursor-pointer">
                            Force HTTPS
                        </Label>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Automatically redirect all HTTP traffic to HTTPS
                        </p>
                    </div>
                </div>
                <Switch
                    id="force-https"
                    checked={forceHttps}
                    onCheckedChange={handleToggleForceHttps}
                    disabled={isTogglingHttps}
                />
            </div>

            {/* Certificate Actions */}
            <div className="grid grid-cols-2 gap-3">
                <Button
                    variant="outline"
                    onClick={handleRenew}
                    disabled={isRenewing}
                >
                    {isRenewing ? (
                        <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Renewing...
                        </>
                    ) : (
                        <>
                            <RotateCw className="w-4 h-4 mr-2" />
                            Renew Now
                        </>
                    )}
                </Button>
                <Button
                    variant="outline"
                    onClick={handleRevoke}
                    disabled={isRevoking}
                    className="text-destructive hover:text-destructive"
                >
                    {isRevoking ? (
                        <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Revoking...
                        </>
                    ) : (
                        <>
                            <ShieldOff className="w-4 h-4 mr-2" />
                            Revoke
                        </>
                    )}
                </Button>
            </div>
        </div>
    )
}
