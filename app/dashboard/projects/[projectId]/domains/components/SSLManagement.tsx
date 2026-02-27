'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
    Shield,
    Zap,
    Globe,
    Check,
    Copy,
    RefreshCw,
    ArrowRight,
    ArrowLeft,
    Lock,
    Upload,
    FileText,
    Calendar,
    RotateCw,
    ShieldOff,
    Info,
    CheckCircle2,
    AlertTriangle,
    X,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { CustomDomain } from '@/lib/types/custom-domains'

interface SSLManagementProps {
    domain: CustomDomain
    onUpdate: () => void
    onError: (error: string) => void
    onSuccess: (message: string) => void
}

type SSLMode = 'LETS_ENCRYPT' | 'EXTERNAL' | 'NONE'
type SetupStep = 'choose-mode' | 'choose-method' | 'http01-progress' | 'dns01-instructions' | 'dns01-progress' | 'external-upload'

export function SSLManagement({
    domain,
    onUpdate,
    onError,
    onSuccess,
}: SSLManagementProps) {
    const [step, setStep] = useState<SetupStep>('choose-mode')
    const [selectedMode, setSelectedMode] = useState<SSLMode>(domain.sslMode as SSLMode || 'NONE')
    const [isProcessing, setIsProcessing] = useState(false)
    const [dnsChallenge, setDnsChallenge] = useState<{ txtName: string; txtValue: string } | null>(null)
    const [certId, setCertId] = useState<string | null>(null)
    const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)
    const [isTogglingHttps, setIsTogglingHttps] = useState(false)
    const [isRenewing, setIsRenewing] = useState(false)
    const [isRevoking, setIsRevoking] = useState(false)

    const activeCert = domain.certificates?.find(c => c.status === 'ISSUED')
    const pendingCert = domain.certificates?.find(c => c.status === 'PENDING_HTTP01' || c.status === 'PENDING_DNS01')
    const isExpiringSoon = activeCert?.expiresAt
        ? new Date(activeCert.expiresAt).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000
        : false

    useEffect(() => {
        return () => {
            if (pollingInterval) clearInterval(pollingInterval)
        }
    }, [pollingInterval])

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text)
            onSuccess('Copied to clipboard!')
        } catch {
            onError('Failed to copy to clipboard')
        }
    }

    const startCertificateIssuance = async (method: 'HTTP01' | 'DNS01') => {
        setIsProcessing(true)

        try {
            const response = await fetch('/api/acme/issue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    domainId: domain.id,
                    challengeType: method,
                }),
            })

            const result = await response.json()
            if (response.ok) {
                setCertId(result.certId)

                if (method === 'HTTP01') {
                    setStep('http01-progress')
                    startPolling(result.certId)
                } else {
                    setDnsChallenge({ txtName: result.txtName, txtValue: result.txtValue })
                    setStep('dns01-instructions')
                }
            } else {
                onError(result.error || 'Failed to start certificate issuance')
                setStep('choose-method')
            }
        } catch (error) {
            onError('Failed to start certificate issuance')
            setStep('choose-method')
        } finally {
            setIsProcessing(false)
        }
    }

    const startPolling = (id: string) => {
        const interval = setInterval(async () => {
            try {
                const response = await fetch(`/api/acme/status/${id}`)
                const result = await response.json()

                if (result.status === 'ISSUED') {
                    clearInterval(interval)
                    setPollingInterval(null)
                    await onUpdate()
                    onSuccess('SSL certificate issued successfully!')
                    resetSetup()
                } else if (result.status === 'FAILED') {
                    clearInterval(interval)
                    setPollingInterval(null)
                    onError(result.lastError || 'Certificate issuance failed')
                    resetSetup()
                }
            } catch (error) {
                console.error('Polling error:', error)
            }
        }, 3000)

        setPollingInterval(interval)
    }

    const verifyDnsChallenge = async () => {
        if (!certId) return

        setIsProcessing(true)
        try {
            const response = await fetch('/api/acme/verify-dns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ certId }),
            })

            const result = await response.json()
            if (response.ok) {
                setStep('dns01-progress')
                startPolling(certId)
            } else {
                onError(result.error || 'DNS verification failed. Please ensure the TXT record is added and propagated.')
            }
        } catch (error) {
            onError('Failed to verify DNS challenge')
        } finally {
            setIsProcessing(false)
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
                onError(result.error || 'Failed to toggle Force HTTPS')
            }
        } catch (error) {
            onError('Failed to toggle Force HTTPS')
        } finally {
            setIsTogglingHttps(false)
        }
    }

    const handleRenewCertificate = async () => {
        if (!activeCert) return

        setIsRenewing(true)
        try {
            const response = await fetch(`/api/acme/renew/${activeCert.id}`, {
                method: 'POST',
            })

            const result = await response.json()
            if (response.ok) {
                onSuccess('Certificate renewal initiated')
                await onUpdate()
            } else {
                onError(result.error || 'Failed to renew certificate')
            }
        } catch (error) {
            onError('Failed to renew certificate')
        } finally {
            setIsRenewing(false)
        }
    }

    const handleRevokeCertificate = async () => {
        if (!activeCert) return

        if (!confirm('Are you sure you want to revoke this certificate?')) {
            return
        }

        setIsRevoking(true)
        try {
            const response = await fetch(`/api/acme/revoke/${activeCert.id}`, {
                method: 'POST',
            })

            const result = await response.json()
            if (response.ok) {
                onSuccess('Certificate revoked successfully')
                await onUpdate()
            } else {
                onError(result.error || 'Failed to revoke certificate')
            }
        } catch (error) {
            onError('Failed to revoke certificate')
        } finally {
            setIsRevoking(false)
        }
    }

    const resetSetup = () => {
        setStep('choose-mode')
        setDnsChallenge(null)
        setCertId(null)
        if (pollingInterval) {
            clearInterval(pollingInterval)
            setPollingInterval(null)
        }
    }

    const cancelSetup = async () => {
        if (certId && pollingInterval) {
            try {
                await fetch(`/api/acme/cancel/${certId}`, { method: 'POST' })
            } catch (error) {
                console.error('Failed to cancel:', error)
            }
        }
        resetSetup()
    }

    // If domain has SSL configured, show management interface
    if (domain.sslMode !== 'NONE' && (activeCert || pendingCert)) {
        return (
            <div className="space-y-6">
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
                            {domain.sslMode === 'LETS_ENCRYPT' ? "Let's Encrypt (Automatic)" : 'External Certificate'}
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

                <Separator />

                {/* Force HTTPS Toggle */}
                {activeCert && (
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
                            checked={domain.forceHttps}
                            onCheckedChange={handleToggleForceHttps}
                            disabled={isTogglingHttps}
                        />
                    </div>
                )}

                {/* Certificate Actions */}
                {activeCert && (
                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            variant="outline"
                            onClick={handleRenewCertificate}
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
                            onClick={handleRevokeCertificate}
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
                )}

                {/* Cancel Pending */}
                {pendingCert && (
                    <Button
                        variant="outline"
                        onClick={async () => {
                            try {
                                await fetch(`/api/acme/cancel/${pendingCert.id}`, { method: 'POST' })
                                onSuccess('Certificate issuance cancelled')
                                await onUpdate()
                            } catch {
                                onError('Failed to cancel')
                            }
                        }}
                        className="w-full"
                    >
                        Cancel Issuance
                    </Button>
                )}
            </div>
        )
    }

    // Setup flow for new SSL configuration
    return (
        <div className="space-y-4">
            <AnimatePresence mode="wait">
                <motion.div
                    key={step}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                >
                    {step === 'choose-mode' && (
                        <div className="space-y-3">
                            <div className="text-center mb-6">
                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-4 shadow-lg">
                                    <Shield className="w-8 h-8 text-white" />
                                </div>
                                <h3 className="text-xl font-bold mb-2">Enable SSL Certificate</h3>
                                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                                    Secure your domain with HTTPS. Choose how you want to manage your SSL certificate.
                                </p>
                            </div>

                            {/* Let's Encrypt Option */}
                            <button
                                onClick={() => {
                                    setSelectedMode('LETS_ENCRYPT')
                                    setStep('choose-method')
                                }}
                                className="w-full text-left p-5 rounded-xl border-2 border-border hover:border-blue-500 hover:shadow-lg transition-all group bg-card"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform shadow-md">
                                        <Zap className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <p className="font-bold text-lg">Let's Encrypt (Automatic)</p>
                                            <Badge className="bg-blue-600">Recommended</Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-3">
                                            Free SSL certificates with automatic renewal. Perfect for most use cases.
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            <Badge variant="outline" className="text-xs">
                                                <Check className="w-3 h-3 mr-1" />
                                                Free Forever
                                            </Badge>
                                            <Badge variant="outline" className="text-xs">
                                                <Check className="w-3 h-3 mr-1" />
                                                Auto-Renewal
                                            </Badge>
                                            <Badge variant="outline" className="text-xs">
                                                <Check className="w-3 h-3 mr-1" />
                                                Trusted by Browsers
                                            </Badge>
                                        </div>
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                                </div>
                            </button>

                            {/* External Certificate Option */}
                            <button
                                onClick={() => {
                                    setSelectedMode('EXTERNAL')
                                    setStep('external-upload')
                                }}
                                className="w-full text-left p-5 rounded-xl border-2 border-border hover:border-purple-500 hover:shadow-lg transition-all group bg-card"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform shadow-md">
                                        <Upload className="w-6 h-6 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                            <p className="font-bold text-lg">External Certificate</p>
                                            <Badge variant="outline">Advanced</Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-3">
                                            Upload your own SSL certificate from another provider or CA.
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            <Badge variant="outline" className="text-xs">
                                                Custom CA
                                            </Badge>
                                            <Badge variant="outline" className="text-xs">
                                                Manual Management
                                            </Badge>
                                            <Badge variant="outline" className="text-xs">
                                                EV Certificates
                                            </Badge>
                                        </div>
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
                                </div>
                            </button>
                        </div>
                    )}

                    {step === 'choose-method' && selectedMode === 'LETS_ENCRYPT' && (
                        <div className="space-y-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setStep('choose-mode')}
                                className="mb-2"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back
                            </Button>

                            <div className="text-center mb-6">
                                <h3 className="text-lg font-bold mb-2">Choose Verification Method</h3>
                                <p className="text-sm text-muted-foreground">
                                    How would you like to verify domain ownership?
                                </p>
                            </div>

                            {/* HTTP-01 Option */}
                            <button
                                onClick={() => startCertificateIssuance('HTTP01')}
                                disabled={isProcessing}
                                className="w-full text-left p-4 rounded-xl border-2 border-border hover:border-blue-500 transition-all group bg-card disabled:opacity-50"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-11 h-11 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                        <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="font-semibold">HTTP-01 (Automatic)</p>
                                            <Badge variant="secondary" className="text-xs">Recommended</Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-2">
                                            Fully automatic verification. Completes in seconds with no manual steps.
                                        </p>
                                        <div className="flex gap-2">
                                            <Badge variant="outline" className="text-xs">
                                                <Check className="w-3 h-3 mr-1" />
                                                Instant
                                            </Badge>
                                            <Badge variant="outline" className="text-xs">
                                                <Check className="w-3 h-3 mr-1" />
                                                Auto-Renewal
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </button>

                            {/* DNS-01 Option */}
                            <button
                                onClick={() => startCertificateIssuance('DNS01')}
                                disabled={isProcessing}
                                className="w-full text-left p-4 rounded-xl border-2 border-border hover:border-purple-500 transition-all group bg-card disabled:opacity-50"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-11 h-11 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                        <Globe className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="font-semibold">DNS-01 (Manual)</p>
                                            <Badge variant="outline" className="text-xs">Advanced</Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-2">
                                            Verify via DNS TXT record. Required for wildcard certificates.
                                        </p>
                                        <div className="flex gap-2">
                                            <Badge variant="outline" className="text-xs">
                                                DNS Access Required
                                            </Badge>
                                            <Badge variant="outline" className="text-xs">
                                                Manual Renewal
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </button>
                        </div>
                    )}

                    {step === 'http01-progress' && (
                        <div className="space-y-4">
                            <Alert variant="info" icon={<RefreshCw className="h-4 w-4 animate-spin" />}>
                                <AlertDescription>
                                    <p className="font-medium">Verifying Domain...</p>
                                    <p className="text-sm mt-1">
                                        Automatically verifying your domain ownership. This usually takes 10-30 seconds.
                                    </p>
                                </AlertDescription>
                            </Alert>

                            <div className="flex gap-2">
                                <Button variant="outline" onClick={cancelSetup} className="flex-1">
                                    <X className="w-4 h-4 mr-2" />
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 'dns01-instructions' && dnsChallenge && (
                        <div className="space-y-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={cancelSetup}
                                className="mb-2"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back
                            </Button>

                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0">
                                        <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold mb-1">Add DNS TXT Record</h3>
                                        <p className="text-sm text-muted-foreground">
                                            Add this TXT record to your DNS provider to verify ownership
                                        </p>
                                    </div>
                                </div>

                                <Card>
                                    <CardContent className="p-4 space-y-3">
                                        <div className="grid grid-cols-3 gap-3 text-xs">
                                            <div>
                                                <span className="text-muted-foreground block mb-1">Type</span>
                                                <code className="font-mono font-medium">TXT</code>
                                            </div>
                                            <div className="col-span-2">
                                                <span className="text-muted-foreground block mb-1">Name</span>
                                                <code className="font-mono text-xs break-all">{dnsChallenge.txtName}</code>
                                            </div>
                                        </div>
                                        <Separator />
                                        <div>
                                            <span className="text-muted-foreground block mb-1 text-xs">Value</span>
                                            <div className="bg-muted rounded p-2 font-mono text-xs break-all">
                                                {dnsChallenge.txtValue}
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => copyToClipboard(dnsChallenge.txtValue)}
                                            className="w-full"
                                        >
                                            <Copy className="w-3 h-3 mr-2" />
                                            Copy Value
                                        </Button>
                                    </CardContent>
                                </Card>

                                <Alert variant="info">
                                    <AlertDescription className="text-xs">
                                        DNS changes can take 5-60 minutes to propagate. Click "Verify" once you've added the record.
                                    </AlertDescription>
                                </Alert>
                            </div>

                            <Button
                                onClick={verifyDnsChallenge}
                                disabled={isProcessing}
                                className="w-full"
                                size="lg"
                            >
                                {isProcessing ? 'Verifying...' : 'Verify DNS Record'}
                                <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                        </div>
                    )}

                    {step === 'dns01-progress' && (
                        <div className="space-y-4">
                            <Alert variant="info" icon={<RefreshCw className="h-4 w-4 animate-spin" />}>
                                <AlertDescription>
                                    <p className="font-medium">Verifying DNS Record...</p>
                                    <p className="text-sm mt-1">
                                        Checking DNS records and issuing certificate. This may take a minute.
                                    </p>
                                </AlertDescription>
                            </Alert>

                            <Button variant="outline" onClick={cancelSetup} className="w-full">
                                <X className="w-4 h-4 mr-2" />
                                Cancel
                            </Button>
                        </div>
                    )}

                    {step === 'external-upload' && (
                        <div className="space-y-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setStep('choose-mode')}
                                className="mb-2"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back
                            </Button>

                            <Alert variant="info">
                                <AlertDescription>
                                    <p className="font-medium mb-2">External Certificate Upload</p>
                                    <p className="text-sm">
                                        This feature is coming soon! You'll be able to upload your own SSL certificates from external providers.
                                    </p>
                                </AlertDescription>
                            </Alert>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    )
}
