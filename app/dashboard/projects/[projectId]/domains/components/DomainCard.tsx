'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Globe,
    Shield,
    CheckCircle,
    Clock,
    AlertTriangle,
    MoreVertical,
    Settings,
    Trash2,
    ExternalLink,
    Lock,
    Zap,
} from 'lucide-react'
import type { CustomDomain } from '@/lib/types/custom-domains'

interface DomainCardProps {
    domain: CustomDomain
    projectId: string
    sslEnabled: boolean
    onUpdate: () => void
    onDelete: (domain: string) => void
    onError: (error: string) => void
    onSuccess: (message: string) => void
}

export function DomainCard({
    domain,
    projectId,
    sslEnabled,
    onUpdate,
    onDelete,
    onError,
    onSuccess,
}: DomainCardProps) {
    const router = useRouter()

    const activeCert = domain.certificates?.find(c => c.status === 'ISSUED')
    const pendingCert = domain.certificates?.find(c =>
        c.status === 'PENDING_HTTP01' || c.status === 'PENDING_DNS01'
    )

    const isExpiringSoon = activeCert?.expiresAt
        ? new Date(activeCert.expiresAt).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000
        : false

    const getStatusBadge = () => {
        if (!domain.verified) {
            return (
                <Badge variant="secondary" className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Pending Verification
                </Badge>
            )
        }
        return (
            <Badge variant="default" className="flex items-center gap-1 bg-green-600">
                <CheckCircle className="w-3 h-3" />
                Active
            </Badge>
        )
    }

    const getSSLBadge = () => {
        if (pendingCert) {
            return (
                <Badge variant="secondary" className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    SSL Issuing
                </Badge>
            )
        }

        if (activeCert) {
            if (isExpiringSoon) {
                return (
                    <Badge variant="default" className="flex items-center gap-1 bg-orange-600">
                        <AlertTriangle className="w-3 h-3" />
                        Expires Soon
                    </Badge>
                )
            }
            return (
                <Badge variant="default" className="flex items-center gap-1 bg-emerald-600">
                    <Shield className="w-3 h-3" />
                    SSL Active
                </Badge>
            )
        }

        return null
    }

    return (
        <>
            <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                            {/* Domain Name */}
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                                    <Globe className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-semibold truncate">{domain.domain}</h3>
                                    <p className="text-sm text-muted-foreground">
                                        {domain.verified
                                            ? `Added ${new Date(domain.createdAt).toLocaleDateString()}`
                                            : 'Awaiting verification'}
                                    </p>
                                </div>
                            </div>

                            {/* Status Badges */}
                            <div className="flex flex-wrap gap-2 mb-4">
                                {getStatusBadge()}
                                {sslEnabled && getSSLBadge()}
                                {domain.forceHttps && (
                                    <Badge variant="outline" className="flex items-center gap-1">
                                        <Lock className="w-3 h-3" />
                                        Force HTTPS
                                    </Badge>
                                )}
                            </div>

                            {/* Quick Actions */}
                            <div className="flex flex-wrap gap-2">
                                {domain.verified && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => window.open(`https://${domain.domain}`, '_blank')}
                                    >
                                        <ExternalLink className="w-4 h-4 mr-2" />
                                        Visit Site
                                    </Button>
                                )}

                                {sslEnabled &&
                                    domain.verified &&
                                    !activeCert &&
                                    !pendingCert && (
                                        <Button
                                            variant="default"
                                            size="sm"
                                            onClick={() =>
                                                router.push(`/dashboard/projects/${projectId}/domains/${domain.domain}`)
                                            }
                                        >
                                            <Zap className="w-4 h-4 mr-2" />
                                            Enable SSL
                                        </Button>
                                    )}

                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        router.push(`/dashboard/projects/${projectId}/domains/${domain.domain}`)
                                    }
                                >
                                    <Settings className="w-4 h-4 mr-2" />
                                    Settings
                                </Button>
                            </div>
                        </div>

                        {/* More Actions Menu */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="ml-2">
                                    <MoreVertical className="w-4 h-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                    onClick={() =>
                                        router.push(`/dashboard/projects/${projectId}/domains/${domain.domain}`)
                                    }
                                >
                                    <Settings className="w-4 h-4 mr-2" />
                                    Settings
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={() => onDelete(domain.domain)}
                                    className="text-destructive focus:text-destructive"
                                >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete Domain
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Expiration Warning */}
                    {isExpiringSoon && activeCert && (
                        <Alert variant="warning" className="mt-4">
                            <AlertDescription>
                                <p className="font-medium">Certificate Expiring Soon</p>
                                <p className="text-xs mt-1">
                                    Expires on {activeCert.expiresAt && new Date(activeCert.expiresAt).toLocaleDateString()}.
                                    {' '}Renewal will happen automatically.
                                </p>
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>
        </>
    )
}
