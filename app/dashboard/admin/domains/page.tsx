'use client'

import { useState, useEffect } from 'react'
import { useTimezone } from '@/hooks/use-timezone'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table'
import {
    Trash2,
    RefreshCw,
    Plus,
    ExternalLink,
    Globe,
    CheckCircle,
    Clock,
    MoreVertical,
    Copy,
    Eye,
    Shield,
    Search,
    Filter,
    TrendingUp,
    Server,
    Zap
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { CustomDomain, DNSInstructions } from '@/lib/types/custom-domains'

interface DomainStats {
    total: number
    verified: number
    pending: number
    failed: number
}

export default function AdminDomainsPage() {
    const timezone = useTimezone()
    const [domains, setDomains] = useState<CustomDomain[]>([])
    const [filteredDomains, setFilteredDomains] = useState<CustomDomain[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isAddingDomain, setIsAddingDomain] = useState(false)
    const [newDomain, setNewDomain] = useState('')
    const [newProjectId, setNewProjectId] = useState('')
    const [dnsInstructions, setDnsInstructions] = useState<DNSInstructions | null>(null)
    const [verifyingDomain, setVerifyingDomain] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'pending'>('all')

    const stats: DomainStats = {
        total: domains.length,
        verified: domains.filter(d => d.verified).length,
        pending: domains.filter(d => !d.verified).length,
        failed: 0
    }

    useEffect(() => {
        loadDomains()
    }, [])

    useEffect(() => {
        let filtered = domains

        if (searchQuery) {
            filtered = filtered.filter(domain =>
                domain.domain.toLowerCase().includes(searchQuery.toLowerCase()) ||
                domain.projectId.toLowerCase().includes(searchQuery.toLowerCase())
            )
        }

        if (statusFilter !== 'all') {
            filtered = filtered.filter(domain =>
                statusFilter === 'verified' ? domain.verified : !domain.verified
            )
        }

        setFilteredDomains(filtered)
    }, [domains, searchQuery, statusFilter])

    const loadDomains = async (): Promise<void> => {
        try {
            setIsLoading(true)
            setError(null)
            const response = await fetch('/api/custom-domains/list?scope=all')
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

    const handleAddDomain = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault()
        if (!newDomain || !newProjectId) return

        setIsAddingDomain(true)
        setError(null)

        try {
            const response = await fetch('/api/custom-domains/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    domain: newDomain,
                    projectId: newProjectId
                })
            })

            const result = await response.json()
            if (result.success) {
                setNewDomain('')
                setNewProjectId('')
                setDnsInstructions(result.domain.dnsInstructions)
                setSuccess(`Domain ${newDomain} added successfully!`)
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

    const handleVerifyDomain = async (domain: string): Promise<void> => {
        setVerifyingDomain(domain)
        setError(null)

        try {
            const response = await fetch('/api/custom-domains/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain })
            })

            const result = await response.json()
            if (result.success) {
                await loadDomains()
                if (result.verification.verified) {
                    setSuccess(`Domain ${domain} verified successfully!`)
                } else {
                    setError(`Verification failed: ${result.verification.errors?.join(', ') || 'DNS records not found'}`)
                }
            } else {
                setError(result.error || 'Verification failed')
            }
        } catch (error) {
            setError('Failed to verify domain')
            console.error('Failed to verify domain:', error)
        } finally {
            setVerifyingDomain(null)
        }
    }

    const handleDeleteDomain = async (domain: string): Promise<void> => {
        if (!confirm(`Are you sure you want to delete ${domain}? This action cannot be undone.`)) {
            return
        }

        setError(null)

        try {
            const response = await fetch(`/api/custom-domains/${encodeURIComponent(domain)}?admin=true`, {
                method: 'DELETE'
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

    const copyToClipboard = async (text: string): Promise<void> => {
        try {
            await navigator.clipboard.writeText(text)
            setSuccess('Copied to clipboard!')
        } catch {
            setError('Failed to copy to clipboard')
        }
    }

    const formatDate = (date: Date | string): string => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: timezone,
        })
    }

    const getStatusBadge = (domain: CustomDomain) => {
        if (domain.verified) {
            return (
                <Badge variant="default" className="text-green-700 bg-green-50 border-green-200 hover:bg-green-100">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Verified
                </Badge>
            )
        }
        return (
            <Badge variant="secondary" className="text-yellow-700 bg-yellow-50 border-yellow-200 hover:bg-yellow-100">
                <Clock className="w-3 h-3 mr-1" />
                Pending
            </Badge>
        )
    }

    useEffect(() => {
        if (success || error) {
            const timer = setTimeout(() => {
                setSuccess(null)
                setError(null)
            }, 5000)
            return () => clearTimeout(timer)
        }
    }, [success, error])

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="text-center">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Loading administration panel...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Enhanced Header with Better Visual Hierarchy */}
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                            <Globe className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">Domain Administration</h1>
                            <p className="text-sm text-muted-foreground">
                                Manage custom domains across all projects
                            </p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={loadDomains} className="gap-2">
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </Button>
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button className="gap-2">
                                <Plus className="w-4 h-4" />
                                Add Domain
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Add Custom Domain</DialogTitle>
                                <DialogDescription>
                                    Configure a new custom domain for a project
                                </DialogDescription>
                            </DialogHeader>
                            <form onSubmit={handleAddDomain} className="space-y-4">
                                <div>
                                    <Label htmlFor="domain">Custom Domain</Label>
                                    <Input
                                        id="domain"
                                        type="text"
                                        value={newDomain}
                                        onChange={(e) => setNewDomain(e.target.value)}
                                        placeholder="changelog.example.com"
                                        required
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="projectId">Project ID</Label>
                                    <Input
                                        id="projectId"
                                        type="text"
                                        value={newProjectId}
                                        onChange={(e) => setNewProjectId(e.target.value)}
                                        placeholder="cm7zegrfx000ipp6g5ogohwuj"
                                        required
                                    />
                                </div>
                                <Button type="submit" disabled={isAddingDomain} className="w-full">
                                    {isAddingDomain ? 'Adding...' : 'Add Domain'}
                                </Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Improved Stats Cards - More compact and informative */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">Total Domains</p>
                                <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
                            </div>
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                <Globe className="w-5 h-5 text-blue-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-green-700 uppercase tracking-wide">Verified</p>
                                <p className="text-2xl font-bold text-green-900">{stats.verified}</p>
                            </div>
                            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-yellow-700 uppercase tracking-wide">Pending</p>
                                <p className="text-2xl font-bold text-yellow-900">{stats.pending}</p>
                            </div>
                            <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                                <Clock className="w-5 h-5 text-yellow-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs font-medium text-purple-700 uppercase tracking-wide">Success Rate</p>
                                <p className="text-2xl font-bold text-purple-900">
                                    {stats.total > 0 ? Math.round((stats.verified / stats.total) * 100) : 0}%
                                </p>
                            </div>
                            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                                <TrendingUp className="w-5 h-5 text-purple-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Alerts with better positioning */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="relative"
                    >
                        <Alert variant="destructive">
                            <AlertDescription className="text-red-800">{error}</AlertDescription>
                        </Alert>
                    </motion.div>
                )}
                {success && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="relative"
                    >
                        <Alert variant="success">
                            <AlertDescription className="text-green-800">{success}</AlertDescription>
                        </Alert>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* DNS Instructions - More compact design */}
            {dnsInstructions && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative"
                >
                    <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-blue-900 flex items-center gap-2 text-lg">
                                <Shield className="w-5 h-5" />
                                DNS Configuration Required
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-blue-800 text-sm">
                                Add these DNS records to your domain provider to complete the setup:
                            </p>

                            <div className="grid gap-3">
                                <div className="bg-white/80 p-3 rounded-lg border border-blue-100">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="font-semibold text-blue-900 text-sm flex items-center gap-2">
                                            <span className="bg-blue-200 text-blue-800 px-2 py-0.5 rounded text-xs">CNAME</span>
                                            Record
                                        </h4>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => copyToClipboard(`${dnsInstructions.cname.name} CNAME ${dnsInstructions.cname.value}`)}
                                            className="h-7 px-2"
                                        >
                                            <Copy className="w-3 h-3" />
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs font-mono text-gray-700">
                                        <div><strong>Name:</strong> {dnsInstructions.cname.name}</div>
                                        <div><strong>Value:</strong> {dnsInstructions.cname.value}</div>
                                    </div>
                                </div>

                                <div className="bg-white/80 p-3 rounded-lg border border-blue-100">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="font-semibold text-blue-900 text-sm flex items-center gap-2">
                                            <span className="bg-blue-200 text-blue-800 px-2 py-0.5 rounded text-xs">TXT</span>
                                            Verification
                                        </h4>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => copyToClipboard(`${dnsInstructions.txt.name} TXT ${dnsInstructions.txt.value}`)}
                                            className="h-7 px-2"
                                        >
                                            <Copy className="w-3 h-3" />
                                        </Button>
                                    </div>
                                    <div className="space-y-1 text-xs font-mono text-gray-700">
                                        <div><strong>Name:</strong> {dnsInstructions.txt.name}</div>
                                        <div><strong>Value:</strong> <span className="break-all">{dnsInstructions.txt.value}</span></div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <Alert>
                                    <AlertDescription className="text-xs text-blue-700">
                                        DNS changes can take up to 48 hours to propagate.
                                    </AlertDescription>
                                </Alert>
                                <Button variant="outline" size="sm" onClick={() => setDnsInstructions(null)}>
                                    Close
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {/* Enhanced Domains Table */}
            <Card className="border-0 shadow-sm">
                <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <CardTitle className="text-lg font-semibold flex items-center gap-2">
                                <Server className="w-5 h-5 text-muted-foreground" />
                                Domain Management
                                <Badge variant="secondary" className="ml-2">
                                    {filteredDomains.length} of {domains.length}
                                </Badge>
                            </CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search domains or projects..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10 w-64 h-9"
                                />
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="gap-2">
                                        <Filter className="w-4 h-4" />
                                        {statusFilter === 'all' ? 'All' : statusFilter === 'verified' ? 'Verified' : 'Pending'}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setStatusFilter('all')}>
                                        All Status
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setStatusFilter('verified')}>
                                        Verified Only
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setStatusFilter('pending')}>
                                        Pending Only
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {filteredDomains.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                                <Globe className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground mb-2">
                                {searchQuery || statusFilter !== 'all' ? 'No domains match your filters' : 'No custom domains yet'}
                            </h3>
                            <p className="text-muted-foreground text-sm">
                                {searchQuery || statusFilter !== 'all'
                                    ? 'Try adjusting your search or filter criteria'
                                    : 'Add a custom domain to get started'
                                }
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent border-b">
                                        <TableHead className="font-semibold text-xs uppercase tracking-wider">Domain</TableHead>
                                        <TableHead className="font-semibold text-xs uppercase tracking-wider">Status</TableHead>
                                        <TableHead className="font-semibold text-xs uppercase tracking-wider">Project ID</TableHead>
                                        <TableHead className="font-semibold text-xs uppercase tracking-wider">Created</TableHead>
                                        <TableHead className="font-semibold text-xs uppercase tracking-wider">Verified</TableHead>
                                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredDomains.map((domain) => (
                                        <motion.tr
                                            key={domain.id}
                                            layout
                                            className="group hover:bg-muted/30 transition-all duration-200 border-b border-border/50"
                                        >
                                            <TableCell className="font-medium py-4">
                                                <div className="flex items-center space-x-3">
                                                    <div className="flex items-center gap-2">
                                                        <Zap className="w-4 h-4 text-muted-foreground" />
                                                        <span className="text-foreground font-medium">{domain.domain}</span>
                                                    </div>
                                                    {domain.verified && (
                                                        <a
                                                            href={`https://${domain.domain}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-muted-foreground hover:text-primary transition-colors"
                                                        >
                                                            <ExternalLink className="w-4 h-4" />
                                                        </a>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-4">
                                                {getStatusBadge(domain)}
                                            </TableCell>
                                            <TableCell className="py-4">
                                                <code className="bg-muted/60 px-2 py-1 rounded text-xs text-foreground font-mono">
                                                    {domain.projectId}
                                                </code>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm py-4">
                                                {formatDate(domain.createdAt)}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm py-4">
                                                {domain.verifiedAt ? formatDate(domain.verifiedAt) : '—'}
                                            </TableCell>
                                            <TableCell className="text-right py-4">
                                                <div className="flex items-center justify-end space-x-1">
                                                    {!domain.verified && (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleVerifyDomain(domain.domain)}
                                                            disabled={verifyingDomain === domain.domain}
                                                            className="h-8 text-xs"
                                                        >
                                                            {verifyingDomain === domain.domain ? (
                                                                <RefreshCw className="w-3 h-3 animate-spin" />
                                                            ) : (
                                                                'Verify'
                                                            )}
                                                        </Button>
                                                    )}
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                                                <MoreVertical className="w-4 h-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem
                                                                onClick={() => copyToClipboard(domain.domain)}
                                                                className="gap-2"
                                                            >
                                                                <Copy className="w-4 h-4" />
                                                                Copy Domain
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                onClick={() => copyToClipboard(domain.projectId)}
                                                                className="gap-2"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                                Copy Project ID
                                                            </DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <DropdownMenuItem
                                                                onClick={() => handleDeleteDomain(domain.domain)}
                                                                className="text-destructive focus:text-destructive gap-2"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                                Delete
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </TableCell>
                                        </motion.tr>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}