'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Lock,
    Shield,
    CheckCircle,
    AlertTriangle,
    Copy,
    Zap,
    Globe,
    Check,
    ArrowRight,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { CustomDomain } from '@/lib/types/custom-domains'

interface SSLCertificateWizardProps {
    domain: CustomDomain
    open: boolean
    onOpenChange: (open: boolean) => void
    onUpdate: () => void
    onError: (error: string) => void
    onSuccess: (message: string) => void
    showCancelButton?: boolean  // Only show cancel on settings page
}

type Step = 'select-method' | 'http01-progress' | 'dns01-instructions' | 'dns01-verify' | 'complete'

export function SSLCertificateWizard({
    domain,
    open,
    onOpenChange,
    onUpdate,
    onError,
    onSuccess,
    showCancelButton = false,
}: SSLCertificateWizardProps) {
    const [step, setStep] = useState<Step>('select-method')
    const [selectedMethod, setSelectedMethod] = useState<'HTTP01' | 'DNS01' | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [dnsChallenge, setDnsChallenge] = useState<{ txtName: string; txtValue: string } | null>(null)
    const [certId, setCertId] = useState<string | null>(null)
    const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)

    // Clean up polling on unmount
    useEffect(() => {
        return () => {
            if (pollingInterval) clearInterval(pollingInterval)
        }
    }, [pollingInterval])

    // Reset wizard when dialog closes
    useEffect(() => {
        if (!open) {
            setStep('select-method')
            setSelectedMethod(null)
            setDnsChallenge(null)
            setCertId(null)
            if (pollingInterval) {
                clearInterval(pollingInterval)
                setPollingInterval(null)
            }
        }
    }, [open])

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
        setSelectedMethod(method)

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
                onOpenChange(false)
            }
        } catch (error) {
            onError('Failed to start certificate issuance')
            onOpenChange(false)
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
                    setStep('complete')
                    await onUpdate()
                    onSuccess('SSL certificate issued successfully!')
                } else if (result.status === 'FAILED') {
                    clearInterval(interval)
                    setPollingInterval(null)
                    onError(result.lastError || 'Certificate issuance failed')
                    onOpenChange(false)
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
                setStep('dns01-verify')
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

    const renderStepContent = () => {
        switch (step) {
            case 'select-method':
                return (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <h3 className="text-lg font-semibold">Choose Verification Method</h3>
                            <p className="text-sm text-muted-foreground">
                                Select how you want to verify domain ownership for the SSL certificate
                            </p>
                        </div>

                        <div className="grid gap-4">
                            {/* HTTP-01 Option */}
                            <Card
                                className="cursor-pointer border-2 hover:border-primary transition-all"
                                onClick={() => !isProcessing && startCertificateIssuance('HTTP01')}
                            >
                                <CardContent className="p-6">
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                                            <Zap className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <h4 className="font-semibold">Automatic (HTTP-01)</h4>
                                                <Badge variant="secondary" className="text-xs">Recommended</Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground mb-3">
                                                Fully automatic verification through HTTP. No manual steps required.
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                <Badge variant="outline" className="text-xs">
                                                    <Check className="w-3 h-3 mr-1" />
                                                    Instant setup
                                                </Badge>
                                                <Badge variant="outline" className="text-xs">
                                                    <Check className="w-3 h-3 mr-1" />
                                                    No DNS changes
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* DNS-01 Option */}
                            <Card
                                className="cursor-pointer border-2 hover:border-primary transition-all"
                                onClick={() => !isProcessing && startCertificateIssuance('DNS01')}
                            >
                                <CardContent className="p-6">
                                    <div className="flex items-start gap-4">
                                        <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                                            <Globe className="w-6 h-6 text-purple-600" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <h4 className="font-semibold">Manual (DNS-01)</h4>
                                                <Badge variant="outline" className="text-xs">Advanced</Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground mb-3">
                                                Verify ownership by adding a DNS TXT record. Required for some configurations.
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                <Badge variant="outline" className="text-xs">
                                                    Requires DNS access
                                                </Badge>
                                                <Badge variant="outline" className="text-xs">
                                                    Manual setup
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )

            case 'http01-progress':
                return (
                    <div className="space-y-6">
                        <div className="flex flex-col items-center justify-center py-8">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center mb-4"
                            >
                                <Shield className="w-8 h-8 text-white" />
                            </motion.div>
                            <h3 className="text-lg font-semibold mb-2">Verifying Domain...</h3>
                            <p className="text-sm text-muted-foreground text-center max-w-md">
                                We're automatically verifying your domain ownership. This usually takes 10-30 seconds.
                            </p>
                        </div>

                        <Alert variant="warning">
                            <AlertDescription>
                                Please keep this dialog open while we verify your domain.
                            </AlertDescription>
                        </Alert>

                        {showCancelButton && (
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => {
                                    if (pollingInterval) {
                                        clearInterval(pollingInterval)
                                        setPollingInterval(null)
                                    }
                                    onOpenChange(false)
                                }}
                            >
                                Cancel
                            </Button>
                        )}
                    </div>
                )

            case 'dns01-instructions':
                return (
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <h3 className="text-lg font-semibold">Add DNS TXT Record</h3>
                            <p className="text-sm text-muted-foreground">
                                Add the following TXT record to your DNS provider to verify domain ownership
                            </p>
                        </div>

                        {dnsChallenge && (
                            <div className="space-y-4">
                                <div className="bg-muted rounded-lg p-4 space-y-3">
                                    <div>
                                        <Label className="text-xs text-muted-foreground mb-1">Record Type</Label>
                                        <div className="flex items-center justify-between">
                                            <code className="text-sm font-mono">TXT</code>
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground mb-1">Name</Label>
                                        <div className="flex items-center justify-between gap-2">
                                            <code className="text-sm font-mono break-all">{dnsChallenge.txtName}</code>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => copyToClipboard(dnsChallenge.txtName)}
                                            >
                                                <Copy className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div>
                                        <Label className="text-xs text-muted-foreground mb-1">Value</Label>
                                        <div className="flex items-center justify-between gap-2">
                                            <code className="text-sm font-mono break-all">{dnsChallenge.txtValue}</code>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => copyToClipboard(dnsChallenge.txtValue)}
                                            >
                                                <Copy className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <Alert variant="info">
                                    <AlertDescription>
                                        DNS changes can take 5-60 minutes to propagate. Click "Verify DNS Record" once you've added the TXT record.
                                    </AlertDescription>
                                </Alert>

                                <Button
                                    className="w-full"
                                    onClick={verifyDnsChallenge}
                                    disabled={isProcessing}
                                >
                                    {isProcessing ? 'Verifying...' : 'Verify DNS Record'}
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </div>
                        )}
                    </div>
                )

            case 'dns01-verify':
                return (
                    <div className="space-y-6">
                        <div className="flex flex-col items-center justify-center py-8">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                                className="w-16 h-16 rounded-full bg-gradient-to-tr from-purple-500 to-pink-600 flex items-center justify-center mb-4"
                            >
                                <Globe className="w-8 h-8 text-white" />
                            </motion.div>
                            <h3 className="text-lg font-semibold mb-2">Verifying DNS Record...</h3>
                            <p className="text-sm text-muted-foreground text-center max-w-md">
                                We're checking your DNS records and issuing the certificate. This may take a minute.
                            </p>
                        </div>

                        <Alert variant="warning">
                            <AlertDescription>
                                Please keep this dialog open while we verify your DNS record.
                            </AlertDescription>
                        </Alert>

                        {showCancelButton && (
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => {
                                    if (pollingInterval) {
                                        clearInterval(pollingInterval)
                                        setPollingInterval(null)
                                    }
                                    onOpenChange(false)
                                }}
                            >
                                Cancel
                            </Button>
                        )}
                    </div>
                )

            case 'complete':
                return (
                    <div className="space-y-6">
                        <div className="flex flex-col items-center justify-center py-8">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                                className="w-16 h-16 rounded-full bg-gradient-to-tr from-green-500 to-emerald-600 flex items-center justify-center mb-4"
                            >
                                <CheckCircle className="w-8 h-8 text-white" />
                            </motion.div>
                            <h3 className="text-lg font-semibold mb-2">Certificate Issued!</h3>
                            <p className="text-sm text-muted-foreground text-center max-w-md">
                                Your SSL certificate has been successfully issued and is now active. Your site is secured with HTTPS.
                            </p>
                        </div>

                        <Button className="w-full" onClick={() => onOpenChange(false)}>
                            Done
                        </Button>
                    </div>
                )
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Lock className="w-5 h-5" />
                        Issue SSL Certificate
                    </DialogTitle>
                    <DialogDescription>
                        Secure {domain.domain} with a free SSL certificate from Let's Encrypt
                    </DialogDescription>
                </DialogHeader>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={step}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2 }}
                    >
                        {renderStepContent()}
                    </motion.div>
                </AnimatePresence>
            </DialogContent>
        </Dialog>
    )
}
