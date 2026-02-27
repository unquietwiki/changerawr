'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
    Shield,
    Zap,
    Globe,
    Check,
    Copy,
    RefreshCw,
    ArrowRight,
    ArrowLeft,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { CustomDomain } from '@/lib/types/custom-domains'

interface InlineSSLSetupProps {
    domain: CustomDomain
    onUpdate: () => void
    onError: (error: string) => void
    onSuccess: (message: string) => void
}

type SSLStep = 'choose' | 'http01-progress' | 'dns01-instructions' | 'dns01-progress'

export function InlineSSLSetup({
    domain,
    onUpdate,
    onError,
    onSuccess,
}: InlineSSLSetupProps) {
    const [step, setStep] = useState<SSLStep>('choose')
    const [isProcessing, setIsProcessing] = useState(false)
    const [dnsChallenge, setDnsChallenge] = useState<{ txtName: string; txtValue: string } | null>(null)
    const [certId, setCertId] = useState<string | null>(null)
    const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)

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
                setStep('choose')
            }
        } catch (error) {
            onError('Failed to start certificate issuance')
            setStep('choose')
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

    const resetSetup = () => {
        setStep('choose')
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
                    {step === 'choose' && (
                        <div className="space-y-3">
                            <p className="text-sm text-muted-foreground mb-4">
                                Choose how to verify domain ownership for the SSL certificate
                            </p>

                            {/* HTTP-01 Option */}
                            <button
                                onClick={() => startCertificateIssuance('HTTP01')}
                                disabled={isProcessing}
                                className="w-full text-left p-4 rounded-lg border-2 border-border hover:border-primary transition-all group"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                        <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="font-semibold">Automatic (HTTP-01)</p>
                                            <Badge variant="secondary" className="text-xs">Recommended</Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-2">
                                            Fully automatic verification. No manual steps required.
                                        </p>
                                        <div className="flex gap-2">
                                            <Badge variant="outline" className="text-xs">
                                                <Check className="w-3 h-3 mr-1" />
                                                Instant
                                            </Badge>
                                            <Badge variant="outline" className="text-xs">
                                                <Check className="w-3 h-3 mr-1" />
                                                No DNS changes
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </button>

                            {/* DNS-01 Option */}
                            <button
                                onClick={() => startCertificateIssuance('DNS01')}
                                disabled={isProcessing}
                                className="w-full text-left p-4 rounded-lg border-2 border-border hover:border-primary transition-all group"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                        <Globe className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="font-semibold">Manual (DNS-01)</p>
                                            <Badge variant="outline" className="text-xs">Advanced</Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground mb-2">
                                            Verify by adding a DNS TXT record
                                        </p>
                                        <div className="flex gap-2">
                                            <Badge variant="outline" className="text-xs">
                                                Requires DNS access
                                            </Badge>
                                            <Badge variant="outline" className="text-xs">
                                                Manual setup
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
                                        Automatically verifying your domain. This usually takes 10-30 seconds.
                                    </p>
                                </AlertDescription>
                            </Alert>

                            <Button
                                variant="outline"
                                onClick={cancelSetup}
                                className="w-full"
                            >
                                Cancel
                            </Button>
                        </div>
                    )}

                    {step === 'dns01-instructions' && dnsChallenge && (
                        <div className="space-y-4">
                            <div>
                                <Label className="text-sm font-semibold mb-2 block">Add DNS TXT Record</Label>
                                <p className="text-sm text-muted-foreground mb-3">
                                    Add this TXT record to your DNS provider
                                </p>
                            </div>

                            <div className="bg-muted rounded-lg p-4 space-y-3">
                                <div className="grid grid-cols-3 gap-3 text-xs">
                                    <div>
                                        <span className="text-muted-foreground block mb-1">Type</span>
                                        <code className="font-mono">TXT</code>
                                    </div>
                                    <div className="col-span-2">
                                        <span className="text-muted-foreground block mb-1">Name</span>
                                        <code className="font-mono break-all">{dnsChallenge.txtName}</code>
                                    </div>
                                </div>
                                <Separator />
                                <div>
                                    <span className="text-muted-foreground block mb-1 text-xs">Value</span>
                                    <code className="font-mono text-xs break-all block">{dnsChallenge.txtValue}</code>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => copyToClipboard(dnsChallenge.txtValue)}
                                    className="w-full"
                                >
                                    <Copy className="w-3 h-3 mr-2" />
                                    Copy TXT Value
                                </Button>
                            </div>

                            <Alert variant="info">
                                <AlertDescription className="text-xs">
                                    DNS changes can take 5-60 minutes to propagate. Click "Verify" once you've added the TXT record.
                                </AlertDescription>
                            </Alert>

                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={cancelSetup}
                                    className="flex-1"
                                >
                                    <ArrowLeft className="w-4 h-4 mr-2" />
                                    Cancel
                                </Button>
                                <Button
                                    onClick={verifyDnsChallenge}
                                    disabled={isProcessing}
                                    className="flex-1"
                                >
                                    {isProcessing ? 'Verifying...' : 'Verify DNS Record'}
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            </div>
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

                            <Button
                                variant="outline"
                                onClick={cancelSetup}
                                className="w-full"
                            >
                                Cancel
                            </Button>
                        </div>
                    )}
                </motion.div>
            </AnimatePresence>
        </div>
    )
}
