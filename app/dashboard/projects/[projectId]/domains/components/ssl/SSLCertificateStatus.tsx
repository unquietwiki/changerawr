'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Shield, CheckCircle2, RefreshCw, AlertTriangle } from 'lucide-react'
import type { DomainCertificate } from '@prisma/client'

interface SSLCertificateStatusProps {
    sslMode: 'LETS_ENCRYPT' | 'EXTERNAL' | 'NONE'
    activeCert?: DomainCertificate | null
    pendingCert?: DomainCertificate | null
    isExpiringSoon?: boolean
}

export function SSLCertificateStatus({
    sslMode,
    activeCert,
    pendingCert,
    isExpiringSoon,
}: SSLCertificateStatusProps) {
    return (
        <div className="space-y-4">
            {/* Certificate Status Header */}
            <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                    <Shield className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-semibold">SSL Certificate</h3>
                        {activeCert && (
                            <Badge variant="default" className="bg-green-600">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Active
                            </Badge>
                        )}
                        {pendingCert && (
                            <Badge variant="secondary">
                                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                Issuing
                            </Badge>
                        )}
                        {isExpiringSoon && (
                            <Badge variant="default" className="bg-orange-600">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Expiring Soon
                            </Badge>
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {sslMode === 'LETS_ENCRYPT' ? "Let's Encrypt (Automatic)" : 'External Certificate'}
                    </p>
                </div>
            </div>

            {/* Certificate Details */}
            {activeCert && (
                <Card>
                    <CardContent className="p-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <Label className="text-xs text-muted-foreground">Issued</Label>
                                <p className="font-medium mt-1">
                                    {new Date(activeCert.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground">Expires</Label>
                                <p className="font-medium mt-1">
                                    {activeCert.expiresAt && new Date(activeCert.expiresAt).toLocaleDateString()}
                                </p>
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground">Type</Label>
                                <p className="font-medium mt-1">{activeCert.challengeType}</p>
                            </div>
                            <div>
                                <Label className="text-xs text-muted-foreground">Auto-Renewal</Label>
                                <p className="font-medium mt-1">
                                    {activeCert.challengeType === 'HTTP01' ? (
                                        <span className="text-green-600">Enabled</span>
                                    ) : (
                                        <span className="text-orange-600">Manual</span>
                                    )}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Pending Certificate */}
            {pendingCert && (
                <Alert variant="info" icon={<RefreshCw className="h-4 w-4 animate-spin" />}>
                    <AlertDescription>
                        <p className="font-medium">Certificate Issuing</p>
                        <p className="text-sm mt-1">
                            Your SSL certificate is being issued. This usually takes 30-60 seconds.
                        </p>
                    </AlertDescription>
                </Alert>
            )}
        </div>
    )
}
