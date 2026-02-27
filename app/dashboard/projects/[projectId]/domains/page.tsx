'use client'

import { useState, useEffect, use } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    Globe,
    Plus,
    RefreshCw,
    Sparkles,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { CustomDomain, DNSInstructions } from '@/lib/types/custom-domains'
import { DomainCard } from './components/DomainCard'

interface ProjectDomainSettingsProps {
    params: Promise<{
        projectId: string
    }>
}

// Confetti component for celebrations
const ConfettiAnimation = ({ show }: { show: boolean }) => {
    if (!show) return null

    const confettiPieces = Array.from({ length: 50 }, (_, i) => (
        <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full"
            style={{
                backgroundColor: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'][i % 7],
                left: `${Math.random() * 100}%`,
                top: '-10px',
            }}
            initial={{ y: -10, rotate: 0, scale: 0 }}
            animate={{
                y: window.innerHeight + 100,
                rotate: Math.random() * 360,
                scale: [0, 1, 0.8, 0],
                x: Math.random() * 200 - 100,
            }}
            transition={{
                duration: 3 + Math.random() * 2,
                ease: 'easeOut',
                delay: Math.random() * 0.5,
            }}
        />
    ))

    return (
        <div className="fixed inset-0 pointer-events-none z-50">
            {confettiPieces}
        </div>
    )
}

export default function ProjectDomainSettings({ params }: ProjectDomainSettingsProps) {
    const { projectId } = use(params)
    const [domains, setDomains] = useState<CustomDomain[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isAddingDomain, setIsAddingDomain] = useState(false)
    const [newDomain, setNewDomain] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [showConfetti, setShowConfetti] = useState(false)
    const [showAddDialog, setShowAddDialog] = useState(false)

    useEffect(() => {
        loadDomains()
    }, [projectId])

    useEffect(() => {
        if (success || error) {
            const timer = setTimeout(() => {
                setSuccess(null)
                setError(null)
            }, 5000)
            return () => clearTimeout(timer)
        }
    }, [success, error])

    const loadDomains = async () => {
        try {
            setIsLoading(true)
            setError(null)
            const response = await fetch(`/api/custom-domains/list?scope=project&projectId=${projectId}`)
            const result = await response.json()

            if (result.success) {
                setDomains(result.domains || [])
            } else {
                setError(result.error || 'Failed to load domains')
            }
        } catch (error) {
            setError('Failed to load domains')
            console.error('Failed to load domains:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleAddDomain = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newDomain) return

        setIsAddingDomain(true)
        setError(null)

        try {
            const response = await fetch('/api/custom-domains/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    domain: newDomain,
                    projectId,
                }),
            })

            const result = await response.json()
            if (result.success) {
                setNewDomain('')
                setShowAddDialog(false)
                setSuccess(`Domain ${newDomain} added successfully! Follow the DNS instructions to verify.`)
                setShowConfetti(true)
                setTimeout(() => setShowConfetti(false), 5000)
                await loadDomains()
            } else {
                setError(result.error || 'Failed to add domain')
            }
        } catch (error) {
            setError('Failed to add domain')
            console.error('Failed to add domain:', error)
        } finally {
            setIsAddingDomain(false)
        }
    }

    const handleDeleteDomain = async (domain: string) => {
        if (!confirm(`Are you sure you want to delete ${domain}? This action cannot be undone.`)) {
            return
        }

        setError(null)

        try {
            const response = await fetch(`/api/custom-domains/${encodeURIComponent(domain)}`, {
                method: 'DELETE',
            })

            const result = await response.json()
            if (result.success) {
                setSuccess(`Domain ${domain} deleted successfully`)
                await loadDomains()
            } else {
                setError(result.error || 'Failed to delete domain')
            }
        } catch (error) {
            setError('Failed to delete domain')
            console.error('Failed to delete domain:', error)
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Loading domains...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <ConfettiAnimation show={showConfetti} />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                            <Globe className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Custom Domains</h1>
                            <p className="text-sm text-muted-foreground">
                                Connect your own domain to your changelog
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={loadDomains}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                    <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="w-4 h-4 mr-2" />
                                Add Domain
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Add Custom Domain</DialogTitle>
                                <DialogDescription>
                                    Connect your own domain to host your changelog
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleAddDomain} className="space-y-4">
                                <div>
                                    <Label htmlFor="domain">Domain Name</Label>
                                    <Input
                                        id="domain"
                                        type="text"
                                        value={newDomain}
                                        onChange={(e) => setNewDomain(e.target.value)}
                                        placeholder="changelog.example.com"
                                        required
                                    />
                                    <p className="text-xs text-muted-foreground mt-2">
                                        Enter your custom domain or subdomain
                                    </p>
                                </div>
                                <Button type="submit" disabled={isAddingDomain} className="w-full">
                                    {isAddingDomain ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                            Adding...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4 mr-2" />
                                            Add Domain
                                        </>
                                    )}
                                </Button>
                            </form>
                        </DialogContent>
                    </Dialog>
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

            {/* Domains List */}
            {domains.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4">
                            <Globe className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">No Custom Domains</h3>
                        <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
                            Connect your own domain to host your changelog on a custom URL
                        </p>
                        <Button onClick={() => setShowAddDialog(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            Add Your First Domain
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {domains.map((domain) => (
                        <DomainCard
                            key={domain.id}
                            domain={domain}
                            projectId={projectId}
                            onUpdate={loadDomains}
                            onDelete={handleDeleteDomain}
                            onError={setError}
                            onSuccess={setSuccess}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
