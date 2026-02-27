'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
    Globe,
    Shield,
    CheckCircle,
    Clock,
    AlertTriangle,
    ArrowLeft,
    Copy,
    ExternalLink,
    Lock,
    RefreshCw,
    Trash2,
    Zap,
    RotateCw,
    ShieldOff,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { CustomDomain, DNSInstructions } from '@/lib/types/custom-domains'
import { SSLManagement } from '../components/ssl'

interface DomainSettingsClientProps {
    projectId: string
    domain: string
}

export function DomainSettingsClient({ projectId, domain: domainName }: DomainSettingsClientProps) {
    const router = useRouter()
    const [domain, setDomain] = useState<CustomDomain | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isVerifying, setIsVerifying] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)

    useEffect(() => {
        loadDomain()
    }, [])

    useEffect(() => {
        if (success || error) {
            const timer = setTimeout(() => {
                setSuccess(null)
                setError(null)
            }, 5000)
            return () => clearTimeout(timer)
        }
    }, [success, error])

    const loadDomain = async () => {
        try {
            setIsLoading(true)
            const response = await fetch(`/api/custom-domains/list?scope=project&projectId=${projectId}`)
            const result = await response.json()

            if (result.success) {
                const foundDomain = result.domains?.find((d: CustomDomain) => d.domain === domainName)
                if (foundDomain) {
                    setDomain(foundDomain)
                } else {
                    setError('Domain not found')
                }
            } else {
                setError(result.error || 'Failed to load domain')
            }
        } catch (error) {
            setError('Failed to load domain')
            console.error(error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleVerifyDomain = async () => {
        setIsVerifying(true)
        setError(null)

        try {
            const response = await fetch('/api/custom-domains/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain: domainName }),
            })

            const result = await response.json()
            if (result.success) {
                await loadDomain()
                if (result.verification.verified) {
                    setSuccess('Domain verified successfully!')
                } else {
                    setError(`Verification failed: ${result.verification.errors?.join(', ') || 'DNS records not found'}`)
                }
            } else {
                setError(result.error || 'Verification failed')
            }
        } catch (error) {
            setError('Failed to verify domain')
            console.error(error)
        } finally {
            setIsVerifying(false)
        }
    }

    const handleDeleteDomain = async () => {
        if (!confirm(`Are you sure you want to delete ${domainName}? This action cannot be undone.`)) {
            return
        }

        setIsDeleting(true)
        setError(null)

        try {
            const response = await fetch(`/api/custom-domains/${encodeURIComponent(domainName)}`, {
                method: 'DELETE',
            })

            const result = await response.json()
            if (result.success) {
                setSuccess('Domain deleted successfully')
                setTimeout(() => {
                    router.push(`/dashboard/projects/${projectId}/domains`)
                }, 1000)
            } else {
                setError(result.error || 'Failed to delete domain')
            }
        } catch (error) {
            setError('Failed to delete domain')
            console.error(error)
        } finally {
            setIsDeleting(false)
        }
    }

    const copyToClipboard = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text)
            setSuccess('Copied to clipboard!')
        } catch {
            setError('Failed to copy to clipboard')
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Loading domain settings...</p>
                </div>
            </div>
        )
    }

    if (!domain) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <h2 className="text-xl font-semibold mb-2">Domain Not Found</h2>
                    <p className="text-muted-foreground mb-4">The requested domain could not be found.</p>
                    <Button onClick={() => router.push(`/dashboard/projects/${projectId}/domains`)}>
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Domains
                    </Button>
                </div>
            </div>
        )
    }

    const dnsInstructions: DNSInstructions | undefined = domain.dnsInstructions

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/dashboard/projects/${projectId}/domains`)}
                        className="mb-2"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Domains
                    </Button>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                            <Globe className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">{domain.domain}</h1>
                            <p className="text-sm text-muted-foreground">Domain Settings</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
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
                </div>
            </div>

            {/* Alerts */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                    >
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    </motion.div>
                )}
                {success && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                    >
                        <Alert variant="success">
                            <AlertDescription>{success}</AlertDescription>
                        </Alert>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid gap-6 md:grid-cols-3">
                {/* Main Content */}
                <div className="md:col-span-2 space-y-6">
                    {/* Domain Status Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Domain Status</CardTitle>
                            <CardDescription>Current status and verification information</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <Label>Verification Status</Label>
                                    <p className="text-sm text-muted-foreground">
                                        {domain.verified ? 'Domain is verified and active' : 'Awaiting DNS verification'}
                                    </p>
                                </div>
                                {domain.verified ? (
                                    <Badge variant="default" className="bg-green-600">
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        Verified
                                    </Badge>
                                ) : (
                                    <Badge variant="secondary">
                                        <Clock className="w-3 h-3 mr-1" />
                                        Pending
                                    </Badge>
                                )}
                            </div>

                            {!domain.verified && (
                                <>
                                    <Separator />
                                    <Button
                                        onClick={handleVerifyDomain}
                                        disabled={isVerifying}
                                        className="w-full"
                                    >
                                        {isVerifying ? (
                                            <>
                                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                                Verifying...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle className="w-4 h-4 mr-2" />
                                                Verify Domain
                                            </>
                                        )}
                                    </Button>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* DNS Configuration Card */}
                    {dnsInstructions && !domain.verified && (
                        <Card>
                            <CardHeader>
                                <CardTitle>DNS Configuration</CardTitle>
                                <CardDescription>Add these DNS records to verify your domain</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* CNAME Record */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-sm font-semibold">CNAME Record</Label>
                                        <Badge variant="outline">Required</Badge>
                                    </div>
                                    <div className="bg-muted rounded-lg p-3 space-y-2">
                                        <div className="grid grid-cols-3 gap-2 text-xs">
                                            <div>
                                                <span className="text-muted-foreground">Type:</span>
                                                <p className="font-mono mt-1">CNAME</p>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Name:</span>
                                                <p className="font-mono mt-1">{dnsInstructions.cname.name}</p>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Value:</span>
                                                <p className="font-mono mt-1">{dnsInstructions.cname.value}</p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                                copyToClipboard(
                                                    `${dnsInstructions.cname.name} CNAME ${dnsInstructions.cname.value}`
                                                )
                                            }
                                            className="w-full"
                                        >
                                            <Copy className="w-3 h-3 mr-2" />
                                            Copy Record
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{dnsInstructions.cname.description}</p>
                                </div>

                                <Separator />

                                {/* TXT Record */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-sm font-semibold">TXT Record</Label>
                                        <Badge variant="outline">Required</Badge>
                                    </div>
                                    <div className="bg-muted rounded-lg p-3 space-y-2">
                                        <div className="space-y-2 text-xs">
                                            <div>
                                                <span className="text-muted-foreground">Type:</span>
                                                <p className="font-mono mt-1">TXT</p>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Name:</span>
                                                <p className="font-mono mt-1">{dnsInstructions.txt.name}</p>
                                            </div>
                                            <div>
                                                <span className="text-muted-foreground">Value:</span>
                                                <p className="font-mono mt-1 break-all">{dnsInstructions.txt.value}</p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                                copyToClipboard(`${dnsInstructions.txt.name} TXT ${dnsInstructions.txt.value}`)
                                            }
                                            className="w-full"
                                        >
                                            <Copy className="w-3 h-3 mr-2" />
                                            Copy Record
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">{dnsInstructions.txt.description}</p>
                                </div>

                                <Alert variant="info">
                                    <AlertDescription className="text-xs">
                                        DNS changes can take up to 48 hours to propagate, but usually complete within 5-10 minutes.
                                    </AlertDescription>
                                </Alert>
                            </CardContent>
                        </Card>
                    )}

                    {/* SSL Certificate Card */}
                    {process.env.NEXT_PUBLIC_SSL_ENABLED === 'true' && domain.verified && (
                        <Card>
                            <CardHeader>
                                <CardTitle>SSL Certificate</CardTitle>
                                <CardDescription>Secure your domain with HTTPS</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <SSLManagement
                                    domain={domain}
                                    onUpdate={loadDomain}
                                    onError={setError}
                                    onSuccess={setSuccess}
                                />
                            </CardContent>
                        </Card>
                    )}

                    {/* Danger Zone */}
                    <Card className="border-destructive">
                        <CardHeader>
                            <CardTitle className="text-destructive">Danger Zone</CardTitle>
                            <CardDescription>Irreversible actions</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button
                                variant="destructive"
                                onClick={handleDeleteDomain}
                                disabled={isDeleting}
                                className="w-full"
                            >
                                {isDeleting ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                        Deleting...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete Domain
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Domain Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">Domain Info</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <div>
                                <Label className="text-xs text-muted-foreground">Added</Label>
                                <p className="mt-1">{new Date(domain.createdAt).toLocaleString()}</p>
                            </div>
                            {domain.verifiedAt && (
                                <div>
                                    <Label className="text-xs text-muted-foreground">Verified</Label>
                                    <p className="mt-1">{new Date(domain.verifiedAt).toLocaleString()}</p>
                                </div>
                            )}
                            <div>
                                <Label className="text-xs text-muted-foreground">SSL Mode</Label>
                                <p className="mt-1">
                                    {domain.sslMode === 'LETS_ENCRYPT'
                                        ? "Let's Encrypt"
                                        : domain.sslMode === 'EXTERNAL'
                                            ? 'Provider-Managed'
                                            : 'None'}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
