'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Shield } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { CustomDomain } from '@/lib/types/custom-domains'

// Sub-components
import { SSLModeSelector } from './SSLModeSelector'
import { SSLCertificateStatus } from './SSLCertificateStatus'
import { SSLVerificationMethod } from './SSLVerificationMethod'
import { SSLDNSInstructions } from './SSLDNSInstructions'
import { SSLVerificationProgress } from './SSLVerificationProgress'
import { SSLCertificateActions } from './SSLCertificateActions'
import { ExternalSSLManagement } from './ExternalSSLManagement'

interface SSLManagementProps {
    domain: CustomDomain
    onUpdate: () => void
    onError: (error: string) => void
    onSuccess: (message: string) => void
}

type FlowStep = 'mode-select' | 'method-select' | 'dns-instructions' | 'http01-progress' | 'dns01-progress' | 'external-info'

export function SSLManagement({ domain, onUpdate, onError, onSuccess }: SSLManagementProps) {
    const [step, setStep] = useState<FlowStep>('mode-select')
    const [isProcessing, setIsProcessing] = useState(false)
    const [certId, setCertId] = useState<string | null>(null)
    const [dnsChallenge, setDnsChallenge] = useState<{ txtName: string; txtValue: string } | null>(null)
    const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)

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

    // Auto-detect pending certificate and show progress UI (only if no active cert exists)
    useEffect(() => {
        if (pendingCert && !activeCert && step === 'mode-select') {
            setCertId(pendingCert.id)

            if (pendingCert.status === 'PENDING_HTTP01') {
                setStep('http01-progress')
                startPolling(pendingCert.id)
            } else if (pendingCert.status === 'PENDING_DNS01') {
                // For DNS challenges, show the DNS instructions if we have the TXT value
                if (pendingCert.dnsTxtValue) {
                    setDnsChallenge({
                        txtName: `_acme-challenge.${domain.domain}`,
                        txtValue: pendingCert.dnsTxtValue
                    })
                    setStep('dns-instructions')
                } else {
                    setStep('dns01-progress')
                    startPolling(pendingCert.id)
                }
            }
        }
    }, [pendingCert, activeCert, step])

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
                    setStep('mode-select')
                    setCertId(null)
                } else if (result.status === 'FAILED') {
                    clearInterval(interval)
                    setPollingInterval(null)
                    onError(result.lastError || 'Certificate issuance failed')
                    setStep('mode-select')
                    setCertId(null)
                }
            } catch (error) {
                console.error('Polling error:', error)
            }
        }, 3000)

        setPollingInterval(interval)
    }

    const handleSelectMode = async (mode: 'LETS_ENCRYPT' | 'EXTERNAL') => {
        if (mode === 'LETS_ENCRYPT') {
            setStep('method-select')
        } else {
            // Update to EXTERNAL mode
            setIsProcessing(true)
            try {
                const response = await fetch(`/api/custom-domains/${domain.domain}/ssl/mode`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sslMode: 'EXTERNAL' }),
                })

                const result = await response.json()
                if (response.ok) {
                    onSuccess('SSL mode set to Provider-Managed')
                    await onUpdate()
                } else {
                    onError(result.error || 'Failed to update SSL mode')
                }
            } catch (error) {
                onError('Failed to update SSL mode')
            } finally {
                setIsProcessing(false)
            }
        }
    }

    const handleSelectMethod = async (method: 'HTTP01' | 'DNS01') => {
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
                    setStep('dns-instructions')
                }
            } else {
                onError(result.error || 'Failed to start certificate issuance')
                setStep('method-select')
            }
        } catch (error) {
            onError('Failed to start certificate issuance')
            setStep('method-select')
        } finally {
            setIsProcessing(false)
        }
    }

    const handleVerifyDNS = async () => {
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
                onError(result.error || 'DNS verification failed')
            }
        } catch (error) {
            onError('Failed to verify DNS challenge')
        } finally {
            setIsProcessing(false)
        }
    }

    const handleCancel = async () => {
        if (certId && pollingInterval) {
            try {
                await fetch(`/api/acme/cancel/${certId}`, { method: 'POST' })
            } catch (error) {
                console.error('Failed to cancel:', error)
            }
            clearInterval(pollingInterval)
            setPollingInterval(null)
        }
        setStep('mode-select')
        setCertId(null)
        setDnsChallenge(null)
    }

    const handleToggleForceHttps = async (enabled: boolean) => {
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
            throw new Error(result.error || 'Failed to toggle Force HTTPS')
        }
    }

    const handleRenew = async () => {
        if (!activeCert) return

        const response = await fetch(`/api/acme/renew/${activeCert.id}`, {
            method: 'POST',
        })

        const result = await response.json()
        if (response.ok) {
            onSuccess('Certificate renewal initiated')
            await onUpdate()
        } else {
            throw new Error(result.error || 'Failed to renew certificate')
        }
    }

    const handleRevoke = async () => {
        // Nuke all certificates for this domain to allow fresh re-issuance
        const response = await fetch(`/api/custom-domains/${encodeURIComponent(domain.domain)}/ssl/revoke`, {
            method: 'DELETE',
        })

        const result = await response.json()
        if (response.ok) {
            onSuccess(`Certificate removed successfully. You can now issue a new certificate.`)
            await onUpdate()
        } else {
            throw new Error(result.error || 'Failed to remove certificate')
        }
    }

    // Show EXTERNAL SSL management UI
    if (domain.sslMode === 'EXTERNAL') {
        return (
            <div className="space-y-6">
                {/* External SSL Header */}
                <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-lg">
                        <Shield className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold">Provider-Managed SSL</h3>
                            <Badge variant="outline">External</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            SSL certificate is managed by your hosting provider or CDN
                        </p>
                    </div>
                </div>

                <Alert variant="info">
                    <AlertDescription>
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="font-medium mb-1">External SSL Mode Active</p>
                                <p className="text-sm">
                                    Your SSL certificate is managed externally. Configure domain-specific settings below.
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                    const response = await fetch(`/api/custom-domains/${domain.domain}/ssl/mode`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ sslMode: 'NONE' }),
                                    })

                                    const result = await response.json()
                                    if (response.ok) {
                                        onSuccess('SSL mode changed to None')
                                        await onUpdate()
                                    } else {
                                        onError(result.error || 'Failed to change SSL mode')
                                    }
                                }}
                                className="flex-shrink-0"
                            >
                                Change Mode
                            </Button>
                        </div>
                    </AlertDescription>
                </Alert>

                <ExternalSSLManagement
                    domain={domain.domain}
                    browserRules={domain.browserRules || []}
                    throttleConfig={domain.throttleConfig}
                    onUpdate={onUpdate}
                    onError={onError}
                    onSuccess={onSuccess}
                />
            </div>
        )
    }

    // PRIORITY 1: If there's an active certificate, always show management UI (regardless of sslMode)
    if (activeCert) {
        return (
            <div className="space-y-6">
                <SSLCertificateStatus
                    sslMode="LETS_ENCRYPT"
                    activeCert={activeCert}
                    pendingCert={pendingCert}
                    isExpiringSoon={isExpiringSoon}
                />

                <SSLCertificateActions
                    domain={domain.domain}
                    forceHttps={domain.forceHttps}
                    onToggleForceHttps={handleToggleForceHttps}
                    onRenew={handleRenew}
                    onRevoke={handleRevoke}
                    onError={onError}
                    onSuccess={onSuccess}
                />

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

                {/* Domain-specific features (browser rules, rate limiting) */}
                <ExternalSSLManagement
                    domain={domain.domain}
                    browserRules={domain.browserRules || []}
                    throttleConfig={domain.throttleConfig}
                    onUpdate={onUpdate}
                    onError={onError}
                    onSuccess={onSuccess}
                />
            </div>
        )
    }

    // PRIORITY 2: Show pending certificate progress (during initial setup)
    if (pendingCert && !activeCert && step !== 'mode-select') {
        // Let the step-based flow handle this (http01-progress, dns01-progress, etc.)
        // This section intentionally falls through to the setup flow below
    }

    // Setup flow
    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={step}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
            >
                {step === 'mode-select' && (
                    <SSLModeSelector onSelectMode={handleSelectMode} />
                )}

                {step === 'method-select' && (
                    <SSLVerificationMethod
                        onSelectMethod={handleSelectMethod}
                        onBack={() => setStep('mode-select')}
                        isProcessing={isProcessing}
                    />
                )}

                {step === 'dns-instructions' && dnsChallenge && (
                    <SSLDNSInstructions
                        txtName={dnsChallenge.txtName}
                        txtValue={dnsChallenge.txtValue}
                        onVerify={handleVerifyDNS}
                        onBack={handleCancel}
                        onCopy={(text) => {
                            navigator.clipboard.writeText(text)
                            onSuccess('Copied to clipboard!')
                        }}
                        isProcessing={isProcessing}
                    />
                )}

                {step === 'http01-progress' && (
                    <SSLVerificationProgress type="http01" onCancel={handleCancel} />
                )}

                {step === 'dns01-progress' && (
                    <SSLVerificationProgress type="dns01" onCancel={handleCancel} />
                )}

            </motion.div>
        </AnimatePresence>
    )
}
