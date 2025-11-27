'use client';

import {useState, useEffect} from 'react';
import {useParams, useRouter} from 'next/navigation';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {motion} from 'framer-motion';
import {z} from 'zod';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';

// UI Components
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
import {Switch} from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {useToast} from '@/hooks/use-toast';
import {Alert, AlertDescription, AlertTitle} from '@/components/ui/alert';
import {
    CheckIcon,
    Loader2Icon,
    AlertCircleIcon,
    ArrowLeftIcon,
    SendIcon,
    TrashIcon,
    LinkIcon,
} from 'lucide-react';
import {SlackLogo} from '@/lib/services/slack/logo';

// Define types
interface SlackIntegration {
    id?: string;
    projectId?: string;
    accessToken?: string;
    teamId: string;
    teamName?: string;
    botUserId: string;
    botUsername?: string;
    channelId: string;
    channelName?: string;
    autoSend: boolean;
    enabled: boolean;
    lastSyncAt?: Date | null;
    lastErrorMessage?: string | null;
    postCount: number;
    createdAt?: Date;
    updatedAt?: Date;
}

interface Project {
    id: string;
    name: string;
}

// Form schema
const formSchema = z.object({
    channelId: z.string().min(1, 'Channel ID is required'),
    channelName: z.string().optional(),
    autoSend: z.boolean().default(true),
    enabled: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

export default function SlackIntegrationPage() {
    const params = useParams();
    const router = useRouter();
    const {toast} = useToast();
    const queryClient = useQueryClient();
    const projectId = params.projectId as string;

    const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
    const [isAuthenticating, setIsAuthenticating] = useState(false);

    // Fetch system config to check if Slack is enabled
    const {data: systemConfig} = useQuery({
        queryKey: ['slack-system-config'],
        queryFn: async () => {
            const response = await fetch('/api/admin/system/slack');
            if (!response.ok) return null;
            return response.json();
        },
    });

    // Fetch Slack integration config
    const {data: integration, isLoading} = useQuery({
        queryKey: ['slack-integration', projectId],
        queryFn: async () => {
            const response = await fetch(`/api/projects/${projectId}/integrations/slack`);
            if (!response.ok) {
                if (response.status === 404) return null;
                throw new Error('Failed to fetch Slack integration');
            }
            return response.json() as Promise<SlackIntegration>;
        },
    });

    // Fetch project
    const {data: project} = useQuery({
        queryKey: ['project', projectId],
        queryFn: async () => {
            const response = await fetch(`/api/projects/${projectId}`);
            if (!response.ok) throw new Error('Failed to fetch project');
            return response.json() as Promise<Project>;
        },
    });

    // Fetch available Slack channels
    const {data: channelsData, isLoading: isLoadingChannels} = useQuery({
        queryKey: ['slack-channels', projectId],
        queryFn: async () => {
            const response = await fetch(`/api/projects/${projectId}/integrations/slack/channels`);
            if (!response.ok) {
                if (response.status === 400) return null;
                throw new Error('Failed to fetch channels');
            }
            return response.json();
        },
        enabled: !!integration, // Only fetch if integration is connected
    });

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            channelId: integration?.channelId || '',
            channelName: integration?.channelName || '',
            autoSend: integration?.autoSend ?? true,
            enabled: integration?.enabled ?? true,
        },
    });

    // Update when integration loads
    useEffect(() => {
        if (integration) {
            form.reset({
                channelId: integration.channelId,
                channelName: integration.channelName || '',
                autoSend: integration.autoSend,
                enabled: integration.enabled,
            });
        }
    }, [integration, form]);

    // Update settings mutation
    const updateMutation = useMutation({
        mutationFn: async (values: FormValues) => {
            const response = await fetch(`/api/projects/${projectId}/integrations/slack`, {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(values),
            });
            if (!response.ok) throw new Error('Failed to update Slack integration');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['slack-integration', projectId]});
            toast({
                title: 'Success',
                description: 'Slack integration settings updated',
            });
        },
        onError: (error) => {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to update settings',
                variant: 'destructive',
            });
        },
    });

    // Disconnect mutation
    const disconnectMutation = useMutation({
        mutationFn: async () => {
            const response = await fetch(`/api/projects/${projectId}/integrations/slack`, {
                method: 'DELETE',
            });
            if (!response.ok) throw new Error('Failed to disconnect Slack');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({queryKey: ['slack-integration', projectId]});
            toast({
                title: 'Success',
                description: 'Slack integration disconnected',
            });
            setShowDisconnectDialog(false);
        },
        onError: (error) => {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to disconnect',
                variant: 'destructive',
            });
        },
    });

    // Handle OAuth authentication
    const handleConnectSlack = () => {
        if (!systemConfig?.slackOAuthClientId) {
            toast({
                title: 'Error',
                description: 'Slack OAuth is not configured. Please contact your administrator.',
                variant: 'destructive',
            });
            return;
        }

        setIsAuthenticating(true);
        const clientId = systemConfig.slackOAuthClientId;
        const redirectUri = `${window.location.origin}/api/integrations/slack/callback`;
        const scope = 'chat:write,channels:join,channels:read,groups:read,im:read,mpim:read,users:read';
        const state = btoa(JSON.stringify({projectId}));

        const authUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(state)}`;

        window.location.href = authUrl;
    };

    // Handle form submission
    const onSubmit = async (values: FormValues) => {
        updateMutation.mutate(values);
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="h-32 bg-muted animate-pulse rounded-lg"/>
            </div>
        );
    }

    // Check if Slack is not configured at system level
    const isSlackConfigured = systemConfig?.slackOAuthEnabled;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <SlackLogo className="w-12 h-12"/>
                        Slack Integration
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Post changelog updates directly to your Slack workspace
                    </p>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.back()}
                    className="gap-2"
                >
                    <ArrowLeftIcon className="w-4 h-4"/>
                    Back
                </Button>
            </div>

            {!isSlackConfigured ? (
                // Not configured at system level
                <motion.div
                    initial={{opacity: 0, y: 20}}
                    animate={{opacity: 1, y: 0}}
                    transition={{duration: 0.3}}
                >
                    <Alert variant="warning" borderStyle="accent">
                        <AlertTitle>Slack Not Configured</AlertTitle>
                        <AlertDescription>
                            The Slack integration has not been set up in system integrations.
                            Please contact your administrator to configure Slack OAuth credentials.
                        </AlertDescription>
                    </Alert>
                </motion.div>
            ) : !integration ? (
                // Not connected
                <motion.div
                    initial={{opacity: 0, y: 20}}
                    animate={{opacity: 1, y: 0}}
                    transition={{duration: 0.3}}
                >
                    <Card>
                        <CardHeader>
                            <CardTitle>Connect Slack Workspace</CardTitle>
                            <CardDescription>
                                Authorize Changerawr to post updates to your Slack workspace
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Alert variant="info" borderStyle="accent">
                                <AlertTitle>Authorization Required</AlertTitle>
                                <AlertDescription>
                                    You'll be redirected to Slack to authorize this integration. We'll request
                                    permissions to post messages and read channels.
                                </AlertDescription>
                            </Alert>

                            <Button
                                onClick={handleConnectSlack}
                                disabled={isAuthenticating}
                                className="w-full gap-2 bg-[#36C5F0] hover:bg-[#1E90FF] text-white"
                            >
                                {isAuthenticating ? (
                                    <Loader2Icon className="w-4 h-4 animate-spin"/>
                                ) : (
                                    <LinkIcon className="w-4 h-4"/>
                                )}
                                {isAuthenticating ? 'Connecting...' : 'Connect Slack Workspace'}
                            </Button>
                        </CardContent>
                    </Card>
                </motion.div>
            ) : (
                // Connected
                <motion.div
                    initial={{opacity: 0, y: 20}}
                    animate={{opacity: 1, y: 0}}
                    transition={{duration: 0.3}}
                    className="space-y-6"
                >
                    {/* Connection Status */}
                    <Card className="border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-green-900 dark:text-green-100">
                                <CheckIcon className="w-5 h-5"/>
                                Connected to {integration.teamName}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <p className="text-sm text-muted-foreground">Workspace</p>
                                    <p className="font-medium">{integration.teamName || integration.teamId}</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-sm text-muted-foreground">Bot Username</p>
                                    <p className="font-medium">{integration.botUsername || integration.botUserId}</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-sm text-muted-foreground">Default Channel</p>
                                    <p className="font-medium">#{integration.channelName || integration.channelId}</p>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-sm text-muted-foreground">Messages Posted</p>
                                    <p className="font-medium">{integration.postCount}</p>
                                </div>
                            </div>

                            {integration.lastErrorMessage && (
                                <Alert variant="destructive" borderStyle="accent">
                                    <AlertTitle>Last Error</AlertTitle>
                                    <AlertDescription>
                                        {integration.lastErrorMessage}
                                    </AlertDescription>
                                </Alert>
                            )}
                        </CardContent>
                    </Card>

                    {/* Settings Form */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Settings</CardTitle>
                            <CardDescription>Configure how changelog updates are posted to Slack</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                    {/* Channel Configuration */}
                                    <div className="space-y-4">
                                        <h3 className="font-semibold">Channel Configuration</h3>

                                        {isLoadingChannels ? (
                                            <div className="space-y-2">
                                                <p className="text-sm font-medium">Channel</p>
                                                <div className="h-10 bg-muted animate-pulse rounded-md"/>
                                            </div>
                                        ) : (
                                            <FormField
                                                control={form.control}
                                                name="channelId"
                                                render={({field}) => {
                                                    const selectedChannel = channelsData?.channels?.find(
                                                        (ch: any) => ch.id === field.value
                                                    );
                                                    const displayText = selectedChannel
                                                        ? `${selectedChannel.isPrivate ? '🔒' : '#'} ${selectedChannel.name}`
                                                        : "Select a channel";

                                                    return (
                                                        <FormItem>
                                                            <FormLabel>Channel</FormLabel>
                                                            <FormControl>
                                                                <Select value={field.value || ''} onValueChange={field.onChange}>
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder={displayText}>
                                                                            {displayText}
                                                                        </SelectValue>
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {channelsData?.channels?.map((channel: any) => (
                                                                            <SelectItem key={channel.id} value={channel.id}>
                                                                                {channel.isPrivate ? '🔒' : '#'} {channel.name}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </FormControl>
                                                            <FormDescription>
                                                                Select the Slack channel where changelog updates will be posted
                                                            </FormDescription>
                                                            <FormMessage/>
                                                        </FormItem>
                                                    );
                                                }}
                                            />
                                        )}

                                        <FormField
                                            control={form.control}
                                            name="channelName"
                                            render={({field}) => (
                                                <FormItem>
                                                    <FormLabel>Channel Name (Optional)</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            placeholder="changelog-updates"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormDescription>
                                                        Display name for the channel (for reference)
                                                    </FormDescription>
                                                    <FormMessage/>
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    {/* Posting Settings */}
                                    <div className="space-y-4">
                                        <h3 className="font-semibold">Posting Preferences</h3>

                                        <FormField
                                            control={form.control}
                                            name="autoSend"
                                            render={({field}) => (
                                                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                                    <div className="space-y-0.5">
                                                        <FormLabel>Auto-Post Updates</FormLabel>
                                                        <FormDescription>
                                                            Automatically post to Slack when a changelog entry is published
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

                                        <FormField
                                            control={form.control}
                                            name="enabled"
                                            render={({field}) => (
                                                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                                                    <div className="space-y-0.5">
                                                        <FormLabel>Enable Integration</FormLabel>
                                                        <FormDescription>
                                                            Disable to pause all Slack posting
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
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex gap-2">
                                        <Button
                                            type="submit"
                                            disabled={updateMutation.isPending}
                                            className="gap-2"
                                        >
                                            {updateMutation.isPending ? (
                                                <Loader2Icon className="w-4 h-4 animate-spin"/>
                                            ) : (
                                                <CheckIcon className="w-4 h-4"/>
                                            )}
                                            Save Settings
                                        </Button>

                                        <Button
                                            type="button"
                                            variant="destructive"
                                            onClick={() => setShowDisconnectDialog(true)}
                                            className="gap-2"
                                        >
                                            <TrashIcon className="w-4 h-4"/>
                                            Disconnect
                                        </Button>
                                    </div>
                                </form>
                            </Form>
                        </CardContent>
                    </Card>

                    {/* Disconnect Dialog */}
                    <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Disconnect Slack?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will remove the Slack integration from {project?.name}. You can
                                    reconnect anytime.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={() => disconnectMutation.mutate()}
                                    disabled={disconnectMutation.isPending}
                                    className="bg-destructive"
                                >
                                    {disconnectMutation.isPending ? (
                                        <Loader2Icon className="w-4 h-4 animate-spin"/>
                                    ) : (
                                        'Disconnect'
                                    )}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </motion.div>
            )}
        </div>
    );
}