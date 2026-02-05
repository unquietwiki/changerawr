// app/dashboard/admin/system/slack/page.tsx
'use client'

import {useEffect, useState} from 'react'
import {useForm} from 'react-hook-form'
import {zodResolver} from '@hookform/resolvers/zod'
import {z} from 'zod'
import {useAuth} from '@/context/auth'
import {useToast} from '@/hooks/use-toast'
import {useRouter} from 'next/navigation'
import {motion} from 'framer-motion'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter,
} from '@/components/ui/card'
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
import {
    ArrowLeft,
    Eye,
    EyeOff,
    ExternalLink,
    Loader2,
    Lock,
    Download,
    Copy,
    Check,
} from 'lucide-react'
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from '@/components/ui/alert'

// Define the schema for Slack OAuth configuration
const slackOAuthSchema = z.object({
    slackOAuthEnabled: z.boolean(),
    slackOAuthClientId: z.string().min(1, 'Client ID is required'),
    slackOAuthClientSecret: z.string().min(1, 'Client Secret is required'),
    slackSigningSecret: z.string().min(1, 'Signing Secret is required'),
});

type SlackOAuthConfig = z.infer<typeof slackOAuthSchema>;

export default function SystemSlackConfigPage() {
    const {user} = useAuth();
    const {toast} = useToast();
    const router = useRouter();
    const [isSaving, setIsSaving] = useState(false);
    const [showClientSecret, setShowClientSecret] = useState(false);
    const [showSigningSecret, setShowSigningSecret] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [manifest, setManifest] = useState<string>('');
    const [copiedToClipboard, setCopiedToClipboard] = useState(false);

    // Initialize form
    const form = useForm<SlackOAuthConfig>({
        resolver: zodResolver(slackOAuthSchema),
        defaultValues: {
            slackOAuthEnabled: false,
            slackOAuthClientId: '',
            slackOAuthClientSecret: '',
            slackSigningSecret: '',
        },
    });

    // Fetch current configuration
    useEffect(() => {
        const fetchConfig = async () => {
            if (!user || user.role !== 'ADMIN') {
                setIsLoading(false);
                return;
            }

            try {
                const response = await fetch('/api/admin/system/slack');
                if (response.ok) {
                    const data = await response.json();
                    form.reset({
                        slackOAuthEnabled: data.slackOAuthEnabled || false,
                        slackOAuthClientId: data.slackOAuthClientId || '',
                        slackOAuthClientSecret: data.slackOAuthClientSecret || '',
                        slackSigningSecret: data.slackSigningSecret || '',
                    });
                }
            } catch (error) {
                console.error('Failed to fetch Slack config:', error);
                toast({
                    title: 'Error',
                    description: 'Failed to load Slack configuration',
                    variant: 'destructive',
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchConfig();
    }, [user, form, toast]);

    // Fetch manifest
    useEffect(() => {
        const fetchManifest = async () => {
            try {
                const response = await fetch('/api/integrations/slack/manifest');
                if (response.ok) {
                    const manifestData = await response.json();
                    setManifest(JSON.stringify(manifestData, null, 2));
                }
            } catch (error) {
                console.error('Failed to fetch Slack manifest:', error);
            }
        };

        fetchManifest();
    }, []);

    // Handle copy to clipboard
    const handleCopyManifest = async () => {
        try {
            await navigator.clipboard.writeText(manifest);
            setCopiedToClipboard(true);
            setTimeout(() => setCopiedToClipboard(false), 2000);
            toast({
                title: 'Copied',
                description: 'Manifest copied to clipboard',
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to copy manifest',
                variant: 'destructive',
            });
        }
    };

    // Handle download manifest
    const handleDownloadManifest = () => {
        const element = document.createElement('a');
        element.setAttribute('href', `data:text/json;charset=utf-8,${encodeURIComponent(manifest)}`);
        element.setAttribute('download', 'changerawr-slack-manifest.json');
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    // Handle form submission
    const onSubmit = async (data: SlackOAuthConfig) => {
        setIsSaving(true);

        try {
            const response = await fetch('/api/admin/system/slack', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                throw new Error('Failed to save Slack configuration');
            }

            toast({
                title: 'Success',
                description: 'Slack OAuth configuration saved successfully',
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to save configuration',
                variant: 'destructive',
            });
        } finally {
            setIsSaving(false);
        }
    };

    // Check authorization
    if (!user || user.role !== 'ADMIN') {
        return (
            <motion.div
                initial={{opacity: 0}}
                animate={{opacity: 1}}
                className="flex items-center justify-center h-96"
            >
                <Card className="border-destructive/50 bg-destructive/5">
                    <CardContent className="pt-6 text-center">
                        <Lock className="h-8 w-8 text-destructive mx-auto mb-2"/>
                        <p className="text-muted-foreground">
                            You do not have permission to access this page
                        </p>
                    </CardContent>
                </Card>
            </motion.div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground"/>
            </div>
        );
    }

    return (
        <motion.div
            initial={{opacity: 0, y: 20}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.3}}
            className="space-y-6"
        >
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.back()}
                    className="gap-2"
                >
                    <ArrowLeft className="w-4 h-4"/>
                    Back
                </Button>
                <div>
                    <h1 className="text-3xl font-bold">Slack OAuth Configuration</h1>
                    <p className="text-muted-foreground mt-2">
                        Configure Slack OAuth credentials for the Slack integration feature
                    </p>
                </div>
            </div>

            {/* Main Configuration Card */}
            <Card>
                <CardHeader>
                    <CardTitle>OAuth Credentials</CardTitle>
                    <CardDescription>
                        Enter your Slack app credentials from the Slack App Directory
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            {/* Enable/Disable Toggle */}
                            <FormField
                                control={form.control}
                                name="slackOAuthEnabled"
                                render={({field}) => (
                                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                        <div className="space-y-0.5">
                                            <FormLabel>Enable Slack Integration</FormLabel>
                                            <FormDescription>
                                                Enable or disable Slack OAuth for all projects
                                            </FormDescription>
                                        </div>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            {/* Client ID Field */}
                            <FormField
                                control={form.control}
                                name="slackOAuthClientId"
                                render={({field}) => (
                                    <FormItem>
                                        <FormLabel>Client ID</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="xoxb-1234567890..."
                                                {...field}
                                                disabled={!form.watch('slackOAuthEnabled')}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            Your Slack app's Client ID from the App Directory
                                        </FormDescription>
                                        <FormMessage/>
                                    </FormItem>
                                )}
                            />

                            {/* Client Secret Field */}
                            <FormField
                                control={form.control}
                                name="slackOAuthClientSecret"
                                render={({field}) => (
                                    <FormItem>
                                        <FormLabel>Client Secret</FormLabel>
                                        <div className="flex gap-2">
                                            <FormControl className="flex-1">
                                                <Input
                                                    placeholder="••••••••••••••••••••••••••••••"
                                                    type={showClientSecret ? 'text' : 'password'}
                                                    {...field}
                                                    disabled={!form.watch('slackOAuthEnabled')}
                                                />
                                            </FormControl>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={() => setShowClientSecret(!showClientSecret)}
                                                disabled={!form.watch('slackOAuthEnabled')}
                                            >
                                                {showClientSecret ? (
                                                    <EyeOff className="h-4 w-4"/>
                                                ) : (
                                                    <Eye className="h-4 w-4"/>
                                                )}
                                            </Button>
                                        </div>
                                        <FormDescription>
                                            Your Slack app's Client Secret (stored encrypted)
                                        </FormDescription>
                                        <FormMessage/>
                                    </FormItem>
                                )}
                            />

                            {/* Signing Secret Field */}
                            <FormField
                                control={form.control}
                                name="slackSigningSecret"
                                render={({field}) => (
                                    <FormItem>
                                        <FormLabel>Signing Secret</FormLabel>
                                        <div className="flex gap-2">
                                            <FormControl className="flex-1">
                                                <Input
                                                    placeholder="••••••••••••••••••••••••••••••"
                                                    type={showSigningSecret ? 'text' : 'password'}
                                                    {...field}
                                                    disabled={!form.watch('slackOAuthEnabled')}
                                                />
                                            </FormControl>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                onClick={() => setShowSigningSecret(!showSigningSecret)}
                                                disabled={!form.watch('slackOAuthEnabled')}
                                            >
                                                {showSigningSecret ? (
                                                    <EyeOff className="h-4 w-4"/>
                                                ) : (
                                                    <Eye className="h-4 w-4"/>
                                                )}
                                            </Button>
                                        </div>
                                        <FormDescription>
                                            Your Slack app's Signing Secret (stored encrypted) - used to verify webhook requests
                                        </FormDescription>
                                        <FormMessage/>
                                    </FormItem>
                                )}
                            />

                            {/* Info Alert */}
                            {form.watch('slackOAuthEnabled') && (
                                <Alert borderStyle="accent" variant="info">
                                    <AlertTitle>Setup Instructions</AlertTitle>
                                    <AlertDescription className="space-y-2 mt-2">
                                        <p>
                                            1. Go to{' '}
                                            <Button
                                                variant="link"
                                                size="sm"
                                                className="h-auto p-0"
                                                onClick={() => window.open('https://api.slack.com/apps', '_blank')}
                                            >
                                                Slack App Directory <ExternalLink className="h-3 w-3 ml-1"/>
                                            </Button>
                                        </p>
                                        <p>
                                            2. Create or select your app
                                        </p>
                                        <p>
                                            3. Go to "OAuth &amp; Permissions" and copy the Client ID and Client Secret
                                        </p>
                                        <p>
                                            4. Set the Redirect URI to: <code className="bg-muted px-2 py-1 rounded text-xs">{typeof window !== 'undefined' ? `${window.location.origin}/api/integrations/slack/callback` : 'loading...'}</code>
                                        </p>
                                        <p>
                                            5. Add the required scopes: <code className="bg-muted px-2 py-1 rounded text-xs">chat:write channels:read users:read</code>
                                        </p>
                                    </AlertDescription>
                                </Alert>
                            )}

                            {/* Save Button */}
                            <div className="flex gap-2">
                                <Button
                                    type="submit"
                                    disabled={isSaving}
                                    className="gap-2"
                                >
                                    {isSaving ? (
                                        <Loader2 className="w-4 h-4 animate-spin"/>
                                    ) : (
                                        'Save Configuration'
                                    )}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            {/* Slack App Manifest Card */}
            {manifest && (
                <Card>
                    <CardHeader>
                        <CardTitle>Slack App Manifest</CardTitle>
                        <CardDescription>
                            Use this manifest to create a Slack app easily. Copy it and paste it in Slack's App Manifest editor.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="relative w-full overflow-hidden">
                            <pre className="bg-muted p-4 rounded-lg text-sm border max-h-96 overflow-y-auto break-words whitespace-pre-wrap">
                                <code>{manifest}</code>
                            </pre>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCopyManifest}
                                className="gap-2"
                            >
                                {copiedToClipboard ? (
                                    <>
                                        <Check className="w-4 h-4"/>
                                        Copied!
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-4 h-4"/>
                                        Copy to Clipboard
                                    </>
                                )}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleDownloadManifest}
                                className="gap-2"
                            >
                                <Download className="w-4 h-4"/>
                                Download JSON
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Not Configured Alert */}
            {!form.watch('slackOAuthEnabled') && (
                <Alert variant="warning">
                    <AlertTitle>Slack Integration Not Configured</AlertTitle>
                    <AlertDescription>
                        The Slack integration is currently disabled. Users will see a message stating "This feature has not been setup in system integrations" when trying to configure Slack in their projects.
                    </AlertDescription>
                </Alert>
            )}
        </motion.div>
    );
}