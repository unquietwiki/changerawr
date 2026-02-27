'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    Lock,
    Shield,
    RefreshCw,
    CheckCircle,
    AlertTriangle,
    Clock,
    Copy,
    Zap,
    ExternalLink,
    ShieldCheck,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { CustomDomain, DomainCertificate } from '@/lib/types/custom-domains'

interface SSLCertificateCardProps {
    domain: CustomDomain
    onUpdate: () => void
    onError: (error: string) => void
    onSuccess: (message: string) => void
}

export function SSLCertificateCard({ domain, onUpdate, onError, onSuccess }: SSLCertificateCardProps) {
    const [isIssuing, setIsIssuing] = useState(false)
    const [isTogglingHttps, setIsTogglingHttps] = useState(false)
    const [showDnsChallenge, setShowDnsChallenge] = useState(false)
    const [dnsChallenge, setDnsChallenge] = useState<{ txtName: string; txtValue: string } | null>(null)
    const [selectedChallengeType, setSelectedChallengeType] = useState<'HTTP01' | 'DNS01'>('HTTP01')

    const activeCert = domain.certificates?.find(c => c.status === 'ISSUED')
    const pendingCert = domain.certificates?.find(c =>
        c.status === 'PENDING_HTTP01' || c.status === 'PENDING_DNS01'
    )

    const isExpiringSoon = activeCert?.expiresAt
        ? new Date(activeCert.expiresAt).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000
        : false

    const handleIssueCertificate = async () => {
        if (!domain.verified) {
            onError('Domain must be verified before issuing a certificate')
            return
        }

        setIsIssuing(true)
        try {
            const response = await fetch('/api/acme/issue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    domainId: domain.id,
                    challengeType: selectedChallengeType,
                }),
            })

            const result = await response.json()
            if (response.ok) {
                if (selectedChallengeType === 'DNS01' && result.txtName && result.txtValue) {
                    setDnsChallenge({ txtName: result.txtName, txtValue: result.txtValue })
                    setShowDnsChallenge(true)
                    onSuccess('Certificate issuance initiated! Add the DNS TXT record shown below.')
                } else {
                    onSuccess('Certificate issuance initiated! This may take a few minutes.')
                }
                await onUpdate()
            } else {
                onError(result.error || 'Failed to issue certificate')
            }
        } catch (error) {
            onError('Failed to issue certificate')
            console.error(error)
        } finally {
            setIsIssuing(false)
        }
    }

    const handleToggleForceHttps = async (enabled: boolean) => {
        setIsTogglingHttps(true)
        try {
            const response = await fetch(`/api/custom-domains/${domain.domain}/ssl/toggle-https`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ forceHttps: enabled }),
            })

            const result = await response.json()
            if (response.ok) {
                onSuccess(enabled ? 'Force HTTPS enabled' : 'Force HTTPS disabled')
                await onUpdate()
            } else {
                onError(result.error || 'Failed to toggle HTTPS')
            }
        } catch (error) {
            onError('Failed to toggle HTTPS')
            console.error(error)
        } finally {
            setIsTogglingHttps(false)
        }
    }

    const handleCompleteDnsChallenge = async (certId: string) => {
        try {
            const response = await fetch('/api/acme/verify-dns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ certId }),
            })

            const result = await response.json()
            if (response.status === 202) {
                onError('DNS TXT record not yet propagated. Please wait a few minutes and try again.')
            } else if (response.ok) {
                onSuccess('Certificate issued successfully!')
                setShowDnsChallenge(false)
                setDnsChallenge(null)
                await onUpdate()
            } else {
                onError(result.error || 'Failed to verify DNS challenge')
            }
        } catch (error) {
            onError('Failed to verify DNS challenge')
            console.error(error)
        }
    }

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text)
            onSuccess('Copied to clipboard!')
        } catch {
            onError('Failed to copy to clipboard')
        }
    }

    const formatDate = (date: Date | string) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        })
    }

    const getSSLStatusBadge = () => {
        if (domain.sslMode === 'NONE') {
            return (
                <Badge variant="secondary" className="gap-1">
                    <Shield className="w-3 h-3" />
                    No SSL
                </Badge>
            )
        }

        if (activeCert) {
            if (isExpiringSoon) {
                return (
                    <Badge variant="default" className="gap-1 bg-yellow-500">
                        <AlertTriangle className="w-3 h-3" />
                        Expiring Soon
                    </Badge>
                )
            }
            return (
                <Badge variant="default" className="gap-1 bg-green-500">
                    <ShieldCheck className="w-3 h-3" />
                    SSL Active
                </Badge>
            )
        }

        if (pendingCert) {
            return (
                <Badge variant="secondary" className="gap-1">
                    <Clock className="w-3 h-3" />
                    Pending
                </Badge>
            )
        }

        return (
            <Badge variant="secondary" className="gap-1">
                <Shield className="w-3 h-3" />
                {domain.sslMode}
            </Badge>
        )
    }

    return (
        <>
            <Card className="border-2">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                                <Lock className="w-5 h-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">SSL Certificate</CardTitle>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Secure your domain with HTTPS
                                </p>
                            </div>
                        </div>
                        {getSSLStatusBadge()}
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Force HTTPS Toggle */}
                    {domain.sslMode === 'LETS_ENCRYPT' && activeCert && (
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                            <div className="space-y-0.5">
                                <Label htmlFor="force-https" className="text-base font-medium">
                                    Force HTTPS
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                    Automatically redirect HTTP to HTTPS
                                </p>
                            </div>
                            <Switch
                                id="force-https"
                                checked={domain.forceHttps}
                                onCheckedChange={handleToggleForceHttps}
                                disabled={isTogglingHttps}
                            />
                        </div>
                    )}

                    {/* Certificate Info */}
                    {activeCert && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="p-4 border rounded-lg bg-muted/30 space-y-3"
                        >
                            <div className="flex items-start justify-between">
                                <div className="space-y-2 flex-1">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="w-4 h-4 text-green-600" />
                                        <span className="text-sm font-medium">Certificate Active</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-muted-foreground">Issued:</span>
                                            <p className="font-medium">
                                                {activeCert.issuedAt ? formatDate(activeCert.issuedAt) : 'Unknown'}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Expires:</span>
                                            <p className="font-medium">
                                                {activeCert.expiresAt ? formatDate(activeCert.expiresAt) : 'Unknown'}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Type:</span>
                                            <p className="font-medium">{activeCert.challengeType}</p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Provider:</span>
                                            <p className="font-medium">Let's Encrypt</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {isExpiringSoon && (
                                <Alert variant="warning">
                                    <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                                        This certificate expires soon. Renewal will happen automatically.
                                    </AlertDescription>
                                </Alert>
                            )}
                        </motion.div>
                    )}

                    {/* Pending Certificate */}
                    {pendingCert && (
                        <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950" icon={<Clock className="h-4 w-4 text-blue-600" />}>
                            <AlertDescription className="text-blue-800 dark:text-blue-200">
                                Certificate issuance in progress ({pendingCert.challengeType}). This may take a few minutes.
                                {pendingCert.status === 'PENDING_DNS01' && pendingCert.dnsTxtValue && (
                                    <Button
                                        variant="link"
                                        size="sm"
                                        className="p-0 h-auto ml-1"
                                        onClick={() => {
                                            setDnsChallenge({
                                                txtName: `_acme-challenge.${domain.domain}`,
                                                txtValue: pendingCert.dnsTxtValue!,
                                            })
                                            setShowDnsChallenge(true)
                                        }}
                                    >
                                        View DNS instructions
                                    </Button>
                                )}
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Issue Certificate Button */}
                    {!activeCert && !pendingCert && domain.verified && (
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button className="w-full gap-2">
                                    <Zap className="w-4 h-4" />
                                    Issue SSL Certificate
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Issue SSL Certificate</DialogTitle>
                                    <DialogDescription>
                                        Choose how you'd like to verify domain ownership
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                    <div className="space-y-3">
                                        <button
                                            onClick={() => setSelectedChallengeType('HTTP01')}
                                            className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                                                selectedChallengeType === 'HTTP01'
                                                    ? 'border-primary bg-primary/5'
                                                    : 'border-border hover:border-primary/50'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center flex-shrink-0">
                                                    <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="font-semibold mb-1">HTTP-01 (Automatic)</h4>
                                                    <p className="text-sm text-muted-foreground">
                                                        Verification happens automatically. Certificate will be issued in a few minutes.
                                                        <strong className="block mt-1">Recommended for most users</strong>
                                                    </p>
                                                </div>
                                                {selectedChallengeType === 'HTTP01' && (
                                                    <CheckCircle className="w-5 h-5 text-primary" />
                                                )}
                                            </div>
                                        </button>

                                        <button
                                            onClick={() => setSelectedChallengeType('DNS01')}
                                            className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                                                selectedChallengeType === 'DNS01'
                                                    ? 'border-primary bg-primary/5'
                                                    : 'border-border hover:border-primary/50'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center flex-shrink-0">
                                                    <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                                </div>
                                                <div className="flex-1">
                                                    <h4 className="font-semibold mb-1">DNS-01 (Manual)</h4>
                                                    <p className="text-sm text-muted-foreground">
                                                        You'll need to add a TXT record to your DNS. Use this if HTTP-01 doesn't work.
                                                    </p>
                                                </div>
                                                {selectedChallengeType === 'DNS01' && (
                                                    <CheckCircle className="w-5 h-5 text-primary" />
                                                )}
                                            </div>
                                        </button>
                                    </div>

                                    <Button
                                        onClick={handleIssueCertificate}
                                        disabled={isIssuing}
                                        className="w-full gap-2"
                                    >
                                        {isIssuing ? (
                                            <>
                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                                Initiating...
                                            </>
                                        ) : (
                                            <>
                                                <Lock className="w-4 h-4" />
                                                Issue Certificate
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}

                    {/* Info for unverified domains */}
                    {!domain.verified && (
                        <Alert>
                            <AlertDescription>
                                Domain must be verified before you can issue an SSL certificate.
                            </AlertDescription>
                        </Alert>
                    )}

                    {/* Learn More Link */}
                    <Button variant="ghost" size="sm" asChild className="w-full gap-2">
                        <a
                            href="https://letsencrypt.org/docs/"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Learn about SSL certificates
                        </a>
                    </Button>
                </CardContent>
            </Card>

            {/* DNS Challenge Dialog */}
            <Dialog open={showDnsChallenge} onOpenChange={setShowDnsChallenge}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>DNS-01 Challenge</DialogTitle>
                        <DialogDescription>
                            Add this TXT record to your DNS provider to verify domain ownership
                        </DialogDescription>
                    </DialogHeader>
                    {dnsChallenge && (
                        <div className="space-y-4">
                            <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
                                <div>
                                    <Label className="text-sm font-medium">Record Type</Label>
                                    <div className="mt-1 font-mono bg-background px-3 py-2 rounded border">
                                        TXT
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <Label className="text-sm font-medium">Name</Label>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => copyToClipboard(dnsChallenge.txtName)}
                                            className="h-6 px-2"
                                        >
                                            <Copy className="w-3 h-3" />
                                        </Button>
                                    </div>
                                    <div className="font-mono bg-background px-3 py-2 rounded border break-all text-sm">
                                        {dnsChallenge.txtName}
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <Label className="text-sm font-medium">Value</Label>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => copyToClipboard(dnsChallenge.txtValue)}
                                            className="h-6 px-2"
                                        >
                                            <Copy className="w-3 h-3" />
                                        </Button>
                                    </div>
                                    <div className="font-mono bg-background px-3 py-2 rounded border break-all text-sm">
                                        {dnsChallenge.txtValue}
                                    </div>
                                </div>
                            </div>

                            <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                                <AlertDescription className="text-blue-800 dark:text-blue-200 text-sm">
                                    <strong>Important:</strong> DNS propagation can take up to 48 hours. After adding the record,
                                    wait a few minutes before clicking "Verify DNS Record" below.
                                </AlertDescription>
                            </Alert>

                            {pendingCert && (
                                <Button
                                    onClick={() => handleCompleteDnsChallenge(pendingCert.id)}
                                    className="w-full gap-2"
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    Verify DNS Record & Issue Certificate
                                </Button>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    )
}
