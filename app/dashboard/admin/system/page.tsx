'use client'

import {useState} from 'react'
import {useQuery, useMutation} from '@tanstack/react-query'
import {useAuth} from '@/context/auth'
import {useToast} from '@/hooks/use-toast'
import {motion} from 'framer-motion'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/components/ui/tabs'
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form'
import {Input} from '@/components/ui/input'
import {Button} from '@/components/ui/button'
import {Switch} from '@/components/ui/switch'
import {Separator} from '@/components/ui/separator'
import {
    AlertTriangle,
    Check,
    Loader2,
    Settings,
    Mail,
    Bell,
    BarChart4,
    Activity,
    Shield,
    CheckCircle,
    XCircle,
    Key,
    KeyRound,
    ExternalLink,
    RefreshCw,
    AlertCircle,
    Copy,
    ArrowRight,
    ArrowLeft,
    ShieldCheck,
} from 'lucide-react'
import {zodResolver} from '@hookform/resolvers/zod'
import {useForm} from 'react-hook-form'
import * as z from 'zod'
import Link from "next/link"
import {appInfo} from "@/lib/app-info";
import {RadioGroup, RadioGroupItem} from '@/components/ui/radio-group'
import {Badge} from '@/components/ui/badge'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {SlackLogo} from "@/lib/services/slack/logo";

function buildConfigSchema(sponsored: boolean) {
    return z.object({
        defaultInvitationExpiry: z.number().min(1).max(30),
        requireApprovalForChangelogs: z.boolean(),
        maxChangelogEntriesPerProject: z.number().min(10).max(sponsored ? 999999 : 10000),
        enableAnalytics: z.boolean(),
        enableNotifications: z.boolean(),
        allowTelemetry: z.enum(['prompt', 'enabled', 'disabled']),
        adminOnlyApiKeyCreation: z.boolean(),
    })
}

type SystemConfig = {
    defaultInvitationExpiry: number
    requireApprovalForChangelogs: boolean
    maxChangelogEntriesPerProject: number
    enableAnalytics: boolean
    enableNotifications: boolean
    allowTelemetry: 'prompt' | 'enabled' | 'disabled'
    adminOnlyApiKeyCreation: boolean
    sponsorActive?: boolean
    telemetryInstanceId?: string
}

export default function SystemConfigPage() {
    const {user} = useAuth()
    const {toast} = useToast()
    const [licenseKeyInput, setLicenseKeyInput] = useState('')
    const [licenseLoading, setLicenseLoading] = useState(false)
    const [showNameModal, setShowNameModal] = useState(false)
    const [showDeviceLimitModal, setShowDeviceLimitModal] = useState(false)
    const [instanceNameInput, setInstanceNameInput] = useState('')
    const [deviceLimitRefreshing, setDeviceLimitRefreshing] = useState(false)
    const [activationStep, setActivationStep] = useState<'key' | 'challenge' | 'confirm'>('key')
    const [challengeCode, setChallengeCode] = useState('')
    const [challengeId, setChallengeId] = useState('')
    const [responseCodeInput, setResponseCodeInput] = useState('')

    const {data: config, isLoading, refetch} = useQuery<SystemConfig>({
        queryKey: ['system-config'],
        queryFn: async () => {
            const response = await fetch('/api/admin/config')
            if (!response.ok) throw new Error('Failed to fetch system configuration')
            return response.json()
        },
    })

    const {data: licenseStatus, refetch: refetchLicense} = useQuery<{active: boolean, features: string[], connectionFailed?: boolean}>({
        queryKey: ['license-status'],
        queryFn: async () => {
            const response = await fetch('/api/admin/sponsor')
            if (!response.ok) return {active: false, features: []}
            return response.json()
        },
    })

    const isLicensed = licenseStatus?.active === true
    const connectionFailed = licenseStatus?.connectionFailed === true
    const currentSchema = buildConfigSchema(isLicensed)
    const form = useForm<SystemConfig>({
        resolver: zodResolver(currentSchema),
        defaultValues: {
            defaultInvitationExpiry: 7,
            requireApprovalForChangelogs: true,
            maxChangelogEntriesPerProject: 100,
            enableAnalytics: true,
            enableNotifications: true,
            allowTelemetry: 'prompt',
        },
        values: config ? {
            defaultInvitationExpiry: config.defaultInvitationExpiry,
            requireApprovalForChangelogs: config.requireApprovalForChangelogs,
            maxChangelogEntriesPerProject: config.maxChangelogEntriesPerProject,
            enableAnalytics: config.enableAnalytics,
            enableNotifications: config.enableNotifications,
            allowTelemetry: config.allowTelemetry,
            adminOnlyApiKeyCreation: config.adminOnlyApiKeyCreation,
        } : undefined,
    })

    const updateConfig = useMutation({
        mutationFn: async (data: SystemConfig) => {
            const response = await fetch('/api/admin/config', {
                method: 'PATCH',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data),
            })
            if (!response.ok) throw new Error('Failed to update system configuration')
            return response.json()
        },
        onSuccess: () => {
            toast({
                title: 'Configuration Updated',
                description: 'System configuration has been successfully updated.',
            })
            refetch()
        },
        onError: (error) => {
            toast({
                title: 'Update Failed',
                description: error.message,
                variant: 'destructive',
            })
        },
    })

    const handleActivateClick = async () => {
        if (!licenseKeyInput.trim()) return
        setLicenseLoading(true)
        try {
            const response = await fetch('/api/admin/sponsor', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    licenseKey: licenseKeyInput.trim(),
                    mode: 'challenge',
                }),
            })
            const data = await response.json()
            if (!response.ok) {
                toast({title: 'Challenge Failed', description: data.error || 'Could not initiate activation', variant: 'destructive'})
            } else {
                setChallengeId(data.challenge_id)
                setChallengeCode(data.challenge_code)
                setActivationStep('challenge')
            }
        } catch {
            toast({title: 'Error', description: 'Unable to reach the licensing server.', variant: 'destructive'})
        } finally {
            setLicenseLoading(false)
        }
    }

    const handleConfirmChallenge = () => {
        if (!responseCodeInput.trim()) return
        setShowNameModal(true)
    }

    const handleActivateLicense = async () => {
        setShowNameModal(false)
        setLicenseLoading(true)
        try {
            const response = await fetch('/api/admin/sponsor', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    licenseKey: licenseKeyInput.trim(),
                    challengeId,
                    responseCode: responseCodeInput.trim().toUpperCase(),
                    instanceName: instanceNameInput.trim() || undefined,
                    mode: 'confirm',
                }),
            })
            const data = await response.json()
            if (!response.ok) {
                if (response.status === 400 && data.error?.includes('Activation limit')) {
                    setShowDeviceLimitModal(true)
                } else {
                    toast({title: 'Activation Failed', description: data.error || 'Could not activate license', variant: 'destructive'})
                }
            } else {
                toast({title: 'Activated', description: 'Successfully activated. Thanks for your support!'})
                setLicenseKeyInput('')
                setInstanceNameInput('')
                setActivationStep('key')
                setChallengeCode('')
                setChallengeId('')
                setResponseCodeInput('')
                refetchLicense()
                refetch()
            }
        } catch {
            toast({title: 'Activation Failed', description: 'Unable to reach the licensing server.', variant: 'destructive'})
        } finally {
            setLicenseLoading(false)
        }
    }

    const handleRefreshDeviceStatus = async () => {
        setDeviceLimitRefreshing(true)
        try {
            // Re-attempt activation — if a slot was freed, it will succeed
            const response = await fetch('/api/admin/sponsor', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    licenseKey: licenseKeyInput.trim(),
                    instanceName: instanceNameInput.trim() || undefined,
                }),
            })
            const data = await response.json()
            if (response.ok) {
                setShowDeviceLimitModal(false)
                toast({title: 'Activated', description: 'Successfully activated. Thanks for your support!'})
                setLicenseKeyInput('')
                setInstanceNameInput('')
                refetchLicense()
                refetch()
            } else {
                toast({title: 'Still at limit', description: 'No slots have been freed yet. Remove an instance from the license portal first.', variant: 'destructive'})
            }
        } catch {
            toast({title: 'Error', description: 'Unable to reach the licensing server.', variant: 'destructive'})
        } finally {
            setDeviceLimitRefreshing(false)
        }
    }

    const handleDeactivateLicense = async () => {
        setLicenseLoading(true)
        try {
            const response = await fetch('/api/admin/sponsor', {method: 'DELETE'})
            if (response.ok) {
                toast({title: 'Deactivated', description: 'Successfully deactivated.'})
                refetchLicense()
                refetch()
            }
        } catch {
            toast({title: 'Error', description: 'Failed to deactivate license.', variant: 'destructive'})
        } finally {
            setLicenseLoading(false)
        }
    }

    if (!user || user.role !== 'ADMIN') {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle className="text-destructive flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5"/>
                            Access Denied
                        </CardTitle>
                        <CardDescription>
                            You do not have permission to access system configuration.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        )
    }

    const cardVariants = {
        hidden: {opacity: 0, y: 20},
        visible: {opacity: 1, y: 0}
    }

    const getTelemetryDescription = (value: string) => {
        switch (value) {
            case 'enabled':
                return 'Anonymous usage data is being collected to help improve Changerawr'
            case 'disabled':
                return 'No usage data is being collected'
            case 'prompt':
            default:
                return 'Users will be prompted to choose their telemetry preference'
        }
    }

    const currentTelemetryValue = form.watch('allowTelemetry')

    return (
        <>
        <motion.div
            initial={{opacity: 0, y: 20}}
            animate={{opacity: 1, y: 0}}
            className="container max-w-5xl p-6"
        >
            <Card className="shadow-md">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Settings className="h-6 w-6 text-primary"/>
                            <CardTitle>System Configuration</CardTitle>
                        </div>
                    </div>
                    <CardDescription>
                        Manage global system settings and defaults
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-6 w-6 animate-spin"/>
                        </div>
                    ) : (
                        <Tabs defaultValue="general" className="w-full">
                            <TabsList className="grid grid-cols-5 mb-6">
                                <TabsTrigger value="general">General</TabsTrigger>
                                <TabsTrigger value="features">Features</TabsTrigger>
                                <TabsTrigger value="privacy">Privacy</TabsTrigger>
                                <TabsTrigger value="integrations">Integrations</TabsTrigger>
                                <TabsTrigger value="license">License</TabsTrigger>
                            </TabsList>

                            <Form {...form}>
                                <form onSubmit={form.handleSubmit((data) => updateConfig.mutate(data))}>
                                    <TabsContent value="general" className="space-y-6">
                                        <div className="grid gap-6">
                                            <FormField
                                                control={form.control}
                                                name="defaultInvitationExpiry"
                                                render={({field}) => (
                                                    <FormItem>
                                                        <FormLabel>Default Invitation Expiry (days)</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                {...field}
                                                                onChange={(e) => field.onChange(Number(e.target.value))}
                                                            />
                                                        </FormControl>
                                                        <FormDescription>
                                                            Number of days before invitation links expire
                                                        </FormDescription>
                                                        <FormMessage/>
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="maxChangelogEntriesPerProject"
                                                render={({field}) => (
                                                    <FormItem>
                                                        <FormLabel className="flex items-center gap-2">
                                                            Max Changelog Entries per Project
                                                            {isLicensed && (
                                                                <Badge variant="default" className="text-xs">Unlimited</Badge>
                                                            )}
                                                        </FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="number"
                                                                {...field}
                                                                onChange={(e) => field.onChange(Number(e.target.value))}
                                                            />
                                                        </FormControl>
                                                        <FormDescription>
                                                            {isLicensed
                                                                ? 'Unlimited entries enabled. This value is used as a soft guideline.'
                                                                : 'Maximum number of changelog entries allowed per project (10 - 10,000)'}
                                                        </FormDescription>
                                                        <FormMessage/>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="features" className="space-y-6">
                                        <motion.div
                                            variants={cardVariants}
                                            initial="hidden"
                                            animate="visible"
                                            transition={{staggerChildren: 0.1}}
                                            className="space-y-4"
                                        >
                                            <FormField
                                                control={form.control}
                                                name="requireApprovalForChangelogs"
                                                render={({field}) => (
                                                    <motion.div variants={cardVariants}>
                                                        <FormItem
                                                            className="flex flex-row items-center justify-between rounded-lg border p-4">
                                                            <div className="space-y-0.5">
                                                                <FormLabel className="text-base">
                                                                    Require Approval for Changelogs
                                                                </FormLabel>
                                                                <FormDescription>
                                                                    Require admin approval before publishing changelog
                                                                    entries
                                                                </FormDescription>
                                                            </div>
                                                            <FormControl>
                                                                <Switch
                                                                    checked={field.value}
                                                                    onCheckedChange={field.onChange}
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    </motion.div>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="enableAnalytics"
                                                render={({field}) => (
                                                    <motion.div variants={cardVariants}>
                                                        <FormItem
                                                            className="flex flex-row items-center justify-between rounded-lg border p-4">
                                                            <div className="flex gap-2">
                                                                <BarChart4
                                                                    className="h-5 w-5 text-muted-foreground mt-0.5"/>
                                                                <div className="space-y-0.5">
                                                                    <FormLabel className="text-base">
                                                                        Enable Analytics
                                                                    </FormLabel>
                                                                    <FormDescription>
                                                                        Collect and display analytics for changelog
                                                                        entries
                                                                    </FormDescription>
                                                                </div>
                                                            </div>
                                                            <FormControl>
                                                                <Switch
                                                                    checked={field.value}
                                                                    onCheckedChange={field.onChange}
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    </motion.div>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="enableNotifications"
                                                render={({field}) => (
                                                    <motion.div variants={cardVariants}>
                                                        <FormItem
                                                            className="flex flex-row items-center justify-between rounded-lg border p-4">
                                                            <div className="flex gap-2">
                                                                <Bell className="h-5 w-5 text-muted-foreground mt-0.5"/>
                                                                <div className="space-y-0.5">
                                                                    <FormLabel className="text-base">
                                                                        Enable Notifications
                                                                    </FormLabel>
                                                                    <FormDescription>
                                                                        Send notifications for internal actions ( e.g.
                                                                        approvals )
                                                                    </FormDescription>
                                                                </div>
                                                            </div>
                                                            <FormControl>
                                                                <Switch
                                                                    checked={field.value}
                                                                    onCheckedChange={field.onChange}
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    </motion.div>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="adminOnlyApiKeyCreation"
                                                render={({field}) => (
                                                    <motion.div variants={cardVariants}>
                                                        <FormItem
                                                            className="flex flex-row items-center justify-between rounded-lg border p-4">
                                                            <div className="flex gap-2">
                                                                <Key className="h-5 w-5 text-muted-foreground mt-0.5"/>
                                                                <div className="space-y-0.5">
                                                                    <FormLabel className="text-base">
                                                                        Admin-Only API Key Creation
                                                                    </FormLabel>
                                                                    <FormDescription>
                                                                        Restrict API key creation to administrators only
                                                                    </FormDescription>
                                                                </div>
                                                            </div>
                                                            <FormControl>
                                                                <Switch
                                                                    checked={field.value}
                                                                    onCheckedChange={field.onChange}
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    </motion.div>
                                                )}
                                            />
                                        </motion.div>
                                    </TabsContent>

                                    <TabsContent value="privacy" className="space-y-6">
                                        <div className="space-y-4">
                                            <FormField
                                                control={form.control}
                                                name="allowTelemetry"
                                                render={({field}) => (
                                                    <Card className="border-2">
                                                        <CardHeader>
                                                            <div className="flex items-center gap-3">
                                                                <div className="p-2 bg-primary/10 rounded-lg">
                                                                    <Activity className="h-5 w-5 text-primary"/>
                                                                </div>
                                                                <div>
                                                                    <CardTitle className="text-lg">Telemetry
                                                                        Settings</CardTitle>
                                                                    <CardDescription>
                                                                        Configure how usage data is collected from your
                                                                        Changerawr instance
                                                                    </CardDescription>
                                                                </div>
                                                            </div>
                                                        </CardHeader>
                                                        <CardContent className="space-y-6">
                                                            <FormItem>
                                                                <FormLabel className="text-base font-semibold">Telemetry
                                                                    Mode</FormLabel>
                                                                <FormControl>
                                                                    <RadioGroup
                                                                        value={field.value}
                                                                        onValueChange={field.onChange}
                                                                        className="space-y-4"
                                                                    >
                                                                        {process.env.NODE_ENV === 'development' && (
                                                                            <div className="relative">
                                                                                <div
                                                                                    className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                                                                                    <RadioGroupItem value="prompt"
                                                                                                    id="telemetry-prompt"
                                                                                                    className="mt-1"/>
                                                                                    <div className="flex-1 space-y-2">
                                                                                        <div
                                                                                            className="flex items-center gap-2">
                                                                                            <label
                                                                                                htmlFor="telemetry-prompt"
                                                                                                className="text-sm font-medium cursor-pointer">
                                                                                                Prompt users
                                                                                            </label>
                                                                                            <Badge variant="secondary"
                                                                                                   className="text-xs">
                                                                                                Development Only
                                                                                            </Badge>
                                                                                        </div>
                                                                                        <p className="text-xs text-muted-foreground">
                                                                                            Show a modal asking users to
                                                                                            choose whether to enable
                                                                                            telemetry
                                                                                        </p>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        <div className="relative">
                                                                            <div
                                                                                className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                                                                                <RadioGroupItem value="enabled"
                                                                                                id="telemetry-enabled"
                                                                                                className="mt-1"/>
                                                                                <div className="flex-1 space-y-2">
                                                                                    <div
                                                                                        className="flex items-center gap-2">
                                                                                        <CheckCircle
                                                                                            className="w-4 h-4 text-green-600"/>
                                                                                        <label
                                                                                            htmlFor="telemetry-enabled"
                                                                                            className="text-sm font-medium cursor-pointer">
                                                                                            Always enabled
                                                                                        </label>
                                                                                        <Badge variant="default"
                                                                                               className="text-xs">
                                                                                            Recommended
                                                                                        </Badge>
                                                                                    </div>
                                                                                    <p className="text-xs text-muted-foreground">
                                                                                        Automatically collect anonymous
                                                                                        usage data to help improve the
                                                                                        product
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        <div className="relative">
                                                                            <div
                                                                                className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                                                                                <RadioGroupItem value="disabled"
                                                                                                id="telemetry-disabled"
                                                                                                className="mt-1"/>
                                                                                <div className="flex-1 space-y-2">
                                                                                    <div
                                                                                        className="flex items-center gap-2">
                                                                                        <XCircle
                                                                                            className="w-4 h-4 text-red-600"/>
                                                                                        <label
                                                                                            htmlFor="telemetry-disabled"
                                                                                            className="text-sm font-medium cursor-pointer">
                                                                                            Always disabled
                                                                                        </label>
                                                                                    </div>
                                                                                    <p className="text-xs text-muted-foreground">
                                                                                        Completely disable telemetry
                                                                                        data collection
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </RadioGroup>
                                                                </FormControl>
                                                                <FormDescription className="mt-4">
                                                                    {getTelemetryDescription(currentTelemetryValue)}
                                                                </FormDescription>
                                                                <FormMessage/>
                                                            </FormItem>

                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                <Card
                                                                    className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20">
                                                                    <CardContent className="pt-4">
                                                                        <div className="flex items-start gap-3">
                                                                            <CheckCircle
                                                                                className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0"/>
                                                                            <div className="space-y-3">
                                                                                <h4 className="font-medium text-green-900 dark:text-green-100">
                                                                                    What we collect
                                                                                </h4>
                                                                                <div className="space-y-2">
                                                                                    <Badge variant="outline"
                                                                                           className="text-xs bg-green-100 border-green-300 text-green-800 dark:bg-green-950 dark:border-green-700 dark:text-green-200">
                                                                                        Version: {appInfo.version}
                                                                                    </Badge>
                                                                                    <Badge variant="outline"
                                                                                           className="text-xs bg-green-100 border-green-300 text-green-800 dark:bg-green-950 dark:border-green-700 dark:text-green-200">
                                                                                        Environment: {appInfo.environment}
                                                                                    </Badge>
                                                                                    <Badge variant="outline"
                                                                                           className="text-xs bg-green-100 border-green-300 text-green-800 dark:bg-green-950 dark:border-green-700 dark:text-green-200">
                                                                                        Anonymous instance ID
                                                                                    </Badge>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </CardContent>
                                                                </Card>

                                                                <Card
                                                                    className="border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20">
                                                                    <CardContent className="pt-4">
                                                                        <div className="flex items-start gap-3">
                                                                            <XCircle
                                                                                className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0"/>
                                                                            <div className="space-y-3">
                                                                                <h4 className="font-medium text-red-900 dark:text-red-100">
                                                                                    What we don&apos;t collect
                                                                                </h4>
                                                                                <div
                                                                                    className="space-y-1 text-xs text-red-700 dark:text-red-300">
                                                                                    <div>• Personal data or user
                                                                                        information
                                                                                    </div>
                                                                                    <div>• Application logs or sensitive
                                                                                        data
                                                                                    </div>
                                                                                    <div>• Project content or
                                                                                        configurations
                                                                                    </div>
                                                                                    <div>• IP addresses or tracking
                                                                                        data
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </CardContent>
                                                                </Card>
                                                            </div>

                                                            <div
                                                                className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg border">
                                                                <Shield
                                                                    className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0"/>
                                                                <div className="space-y-2">
                                                                    <h4 className="text-sm font-medium">Privacy &
                                                                        Security</h4>
                                                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                                                        All telemetry data is anonymized, encrypted in
                                                                        transit, and used solely for product
                                                                        improvement.
                                                                        We follow GDPR guidelines and never sell or
                                                                        share your data with third parties.
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {config?.telemetryInstanceId && (
                                                                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-xs text-muted-foreground mb-1">Instance ID</p>
                                                                        <code className="text-xs font-mono text-foreground/70 break-all select-all">
                                                                            {config.telemetryInstanceId}
                                                                        </code>
                                                                    </div>
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="h-8 w-8 p-0 flex-shrink-0"
                                                                        onClick={() => {
                                                                            navigator.clipboard.writeText(config.telemetryInstanceId!)
                                                                            toast({title: 'Copied', description: 'Instance ID copied to clipboard.'})
                                                                        }}
                                                                    >
                                                                        <Copy className="h-3.5 w-3.5"/>
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </CardContent>
                                                    </Card>
                                                )}
                                            />
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="integrations" className="space-y-4">
                                        <motion.div
                                            variants={cardVariants}
                                            initial="hidden"
                                            animate="visible"
                                            className="flex flex-row items-center justify-between rounded-lg border p-4"
                                        >
                                            <div className="flex gap-2">
                                                <Mail className="h-5 w-5 text-muted-foreground mt-0.5"/>
                                                <div className="space-y-1">
                                                    <h3 className="text-base font-medium">System Email</h3>
                                                    <p className="text-sm text-muted-foreground">
                                                        Configure SMTP settings for internal system usage.
                                                    </p>
                                                </div>
                                            </div>
                                            <Button asChild variant="outline" size="sm">
                                                <Link href="/dashboard/admin/system/email">
                                                    Configure
                                                </Link>
                                            </Button>
                                        </motion.div>

                                        <motion.div
                                            variants={cardVariants}
                                            initial="hidden"
                                            animate="visible"
                                            transition={{delay: 0.1}}
                                            className="flex flex-row items-center justify-between rounded-lg border p-4"
                                        >
                                            <div className="flex gap-2">
                                                <SlackLogo className="h-10 w-10  mt-0.5"/>
                                                <div className="space-y-1">
                                                    <h3 className="text-base font-medium">Slack Integration</h3>
                                                    <p className="text-sm text-muted-foreground">
                                                        Configure OAuth credentials for Slack workspace integration.
                                                    </p>
                                                </div>
                                            </div>
                                            <Button asChild variant="outline" size="sm">
                                                <Link href="/dashboard/admin/system/slack">
                                                    Configure
                                                </Link>
                                            </Button>
                                        </motion.div>
                                    </TabsContent>

                                    <TabsContent value="license" className="space-y-6">
                                        <Card className="border-2">
                                            <CardHeader>
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-primary/10 rounded-lg">
                                                        <KeyRound className="h-5 w-5 text-primary"/>
                                                    </div>
                                                    <div>
                                                        <CardTitle className="text-lg">License</CardTitle>
                                                        <CardDescription>
                                                            Activate a license key to unlock extended features
                                                        </CardDescription>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="space-y-6">
                                                {connectionFailed && (
                                                    <div className="flex items-center gap-3 p-4 rounded-lg border border-amber-500/30 bg-amber-500/5">
                                                        <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0"/>
                                                        <div className="flex-1">
                                                            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Connection Failed</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                Unable to reach the licensing server. Please re-enter your license key to reactivate.
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}

                                                {!connectionFailed && (
                                                    <div className="flex items-center gap-3 p-4 rounded-lg border">
                                                        <div className={`w-3 h-3 rounded-full ${isLicensed ? 'bg-green-500' : 'bg-muted-foreground/30'}`}/>
                                                        <div className="flex-1">
                                                            <p className="text-sm font-medium">
                                                                {isLicensed ? 'Active' : 'Inactive'}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                {isLicensed
                                                                    ? 'Extended features are enabled for this instance.'
                                                                    : 'Enter a license key below to activate extended features.'}
                                                            </p>
                                                        </div>
                                                        {isLicensed && (
                                                            <Badge variant="default" className="text-xs">Licensed</Badge>
                                                        )}
                                                    </div>
                                                )}

                                                {(!isLicensed || connectionFailed) ? (
                                                    <div className="space-y-5">
                                                        {/* Step indicator */}
                                                        {activationStep !== 'key' && (
                                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                                <div className="flex items-center gap-1.5">
                                                                    <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold">
                                                                        <Check className="w-3 h-3"/>
                                                                    </div>
                                                                    <span className="font-medium text-foreground">Key</span>
                                                                </div>
                                                                <div className="w-6 h-px bg-primary"/>
                                                                <div className="flex items-center gap-1.5">
                                                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                                                        activationStep === 'challenge'
                                                                            ? 'bg-primary text-primary-foreground'
                                                                            : 'bg-primary text-primary-foreground'
                                                                    }`}>
                                                                        {activationStep === 'confirm' ? <Check className="w-3 h-3"/> : '2'}
                                                                    </div>
                                                                    <span className={activationStep === 'challenge' ? 'font-medium text-foreground' : 'font-medium text-foreground'}>Verify</span>
                                                                </div>
                                                                <div className={`w-6 h-px ${activationStep === 'confirm' ? 'bg-primary' : 'bg-border'}`}/>
                                                                <div className="flex items-center gap-1.5">
                                                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                                                        activationStep === 'confirm'
                                                                            ? 'bg-primary text-primary-foreground'
                                                                            : 'bg-muted text-muted-foreground'
                                                                    }`}>3</div>
                                                                    <span className={activationStep === 'confirm' ? 'font-medium text-foreground' : ''}>Confirm</span>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {activationStep === 'key' && (
                                                            <>
                                                                <div className="space-y-2">
                                                                    <label className="text-sm font-medium">License Key</label>
                                                                    <Input
                                                                        type="text"
                                                                        placeholder="chr_sp_..."
                                                                        value={licenseKeyInput}
                                                                        onChange={(e) => setLicenseKeyInput(e.target.value)}
                                                                        disabled={licenseLoading}
                                                                    />
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    onClick={handleActivateClick}
                                                                    disabled={licenseLoading || !licenseKeyInput.trim()}
                                                                    className="w-full"
                                                                >
                                                                    {licenseLoading ? (
                                                                        <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Connecting...</>
                                                                    ) : (
                                                                        <><ArrowRight className="mr-2 h-4 w-4"/> Continue</>
                                                                    )}
                                                                </Button>
                                                            </>
                                                        )}

                                                        {activationStep === 'challenge' && (
                                                            <div className="space-y-4">
                                                                {/* Challenge code card */}
                                                                <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-5 space-y-4">
                                                                    <div className="flex items-start gap-3">
                                                                        <div className="p-1.5 rounded-md bg-primary/10 mt-0.5">
                                                                            <ShieldCheck className="w-4 h-4 text-primary"/>
                                                                        </div>
                                                                        <div className="flex-1 space-y-1">
                                                                            <p className="text-sm font-semibold">Your verification code</p>
                                                                            <p className="text-xs text-muted-foreground">
                                                                                Enter this code in your license dashboard to verify ownership
                                                                            </p>
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex items-center justify-between p-3 rounded-md bg-background border">
                                                                        <code className="text-2xl font-mono font-bold tracking-[0.3em] select-all text-primary">
                                                                            {challengeCode}
                                                                        </code>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-8 px-2 text-muted-foreground hover:text-foreground"
                                                                            onClick={() => {
                                                                                navigator.clipboard.writeText(challengeCode)
                                                                                toast({title: 'Copied', description: 'Verification code copied to clipboard.'})
                                                                            }}
                                                                        >
                                                                            <Copy className="h-3.5 w-3.5 mr-1.5"/>
                                                                            <span className="text-xs">Copy</span>
                                                                        </Button>
                                                                    </div>

                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="sm"
                                                                        className="w-full"
                                                                        onClick={() => window.open('https://dl.supers0ft.us/changerawr/sponsor/dashboard', '_blank')}
                                                                    >
                                                                        <ExternalLink className="mr-2 h-3.5 w-3.5"/> Open License Dashboard
                                                                    </Button>
                                                                </div>

                                                                {/* Response code input */}
                                                                <div className="space-y-2">
                                                                    <label className="text-sm font-medium flex items-center gap-2">
                                                                        Response Code
                                                                        <Badge variant="outline" className="text-[10px] font-normal">From dashboard</Badge>
                                                                    </label>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        After entering the code above in your dashboard, you&apos;ll receive a 6-character response code.
                                                                    </p>
                                                                    <Input
                                                                        type="text"
                                                                        placeholder="ABC123"
                                                                        value={responseCodeInput}
                                                                        onChange={(e) => setResponseCodeInput(e.target.value.toUpperCase().replace(/[^A-F0-9]/g, ''))}
                                                                        maxLength={6}
                                                                        className="font-mono tracking-[0.3em] text-center text-lg h-12"
                                                                        disabled={licenseLoading}
                                                                        autoFocus
                                                                    />
                                                                </div>

                                                                <div className="flex gap-2 pt-1">
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => {
                                                                            setActivationStep('key')
                                                                            setChallengeCode('')
                                                                            setChallengeId('')
                                                                            setResponseCodeInput('')
                                                                        }}
                                                                    >
                                                                        <ArrowLeft className="mr-1.5 h-3.5 w-3.5"/> Back
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        onClick={handleConfirmChallenge}
                                                                        disabled={licenseLoading || responseCodeInput.trim().length !== 6}
                                                                        className="flex-1"
                                                                    >
                                                                        {licenseLoading ? (
                                                                            <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Verifying...</>
                                                                        ) : (
                                                                            <><ShieldCheck className="mr-2 h-4 w-4"/> Complete Activation</>
                                                                        )}
                                                                    </Button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={handleDeactivateLicense}
                                                        disabled={licenseLoading}
                                                    >
                                                        {licenseLoading ? (
                                                            <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Deactivating...</>
                                                        ) : (
                                                            'Deactivate License'
                                                        )}
                                                    </Button>
                                                )}

                                                <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg border">
                                                    <Shield className="w-5 h-5 text-muted-foreground mt-0.5 flex-shrink-0"/>
                                                    <div className="space-y-1">
                                                        <p className="text-xs text-muted-foreground leading-relaxed">
                                                            {activationStep === 'challenge'
                                                                ? 'This two-step verification ensures your license key can only be activated by its owner.'
                                                                : 'Having trouble activating? Check if your firewall allows connections to our licensing server.'}
                                                        </p>
                                                        {activationStep === 'key' && (
                                                            <Button
                                                                type="button"
                                                                variant="link"
                                                                size="sm"
                                                                className="h-auto p-0 text-xs text-primary"
                                                                onClick={() => window.open('https://dl.supers0ft.us/changerawr/sponsor/auth/github', '_blank')}
                                                            >
                                                                Get a license key
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </TabsContent>

                                    <Separator className="my-6"/>

                                    <div className="flex justify-end">
                                        <Button
                                            type="submit"
                                            disabled={updateConfig.isPending}
                                            className="px-8"
                                        >
                                            {updateConfig.isPending ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                                                    Updating...
                                                </>
                                            ) : (
                                                <>
                                                    <Check className="mr-2 h-4 w-4"/>
                                                    Save Changes
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </form>
                            </Form>
                        </Tabs>
                    )}
                </CardContent>
            </Card>
        </motion.div>

        <Dialog open={showNameModal} onOpenChange={setShowNameModal}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Name This Instance</DialogTitle>
                    <DialogDescription>
                        Give this server a name so you can identify it later in the license portal.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <Input
                        placeholder="e.g. Production Server, Dev Environment..."
                        value={instanceNameInput}
                        onChange={(e) => setInstanceNameInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleActivateLicense() }}
                        autoFocus
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setShowNameModal(false)}>Cancel</Button>
                    <Button onClick={handleActivateLicense}>
                        <Key className="mr-2 h-4 w-4"/> Activate
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog open={showDeviceLimitModal} onOpenChange={setShowDeviceLimitModal}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Device Limit Reached</DialogTitle>
                    <DialogDescription>
                        All activation slots for this license are in use. Free up a slot from the license portal, or refresh to check if one has been freed.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-3 pt-4">
                    <Button
                        variant="outline"
                        onClick={() => window.open('https://dl.supers0ft.us/changerawr/sponsor/dashboard', '_blank')}
                    >
                        <ExternalLink className="mr-2 h-4 w-4"/> Open License Portal
                    </Button>
                    <Button
                        onClick={handleRefreshDeviceStatus}
                        disabled={deviceLimitRefreshing}
                    >
                        {deviceLimitRefreshing ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin"/> Checking...</>
                        ) : (
                            <><RefreshCw className="mr-2 h-4 w-4"/> Refresh &amp; Retry</>
                        )}
                    </Button>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setShowDeviceLimitModal(false)}>Cancel</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    )
}
