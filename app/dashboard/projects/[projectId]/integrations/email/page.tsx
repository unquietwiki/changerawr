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
import {Alert, AlertDescription} from '@/components/ui/alert';
import {
    CheckIcon,
    Loader2Icon,
    MailIcon,
    AlertCircleIcon,
    ArrowLeftIcon,
    SendIcon,
    EyeIcon,
    EyeOffIcon,
    XIcon,
    UsersIcon,
    CheckCircleIcon,
    PlusIcon,
    UserPlusIcon,
} from 'lucide-react';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Badge} from "@/components/ui/badge";
import {RadioGroup, RadioGroupItem} from "@/components/ui/radio-group";
import {RenderMarkdown} from '@/components/MarkdownEditor';

// Define types
interface EmailConfig {
    id?: string;
    enabled: boolean;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string | null;
    smtpPassword?: string | null;
    smtpSecure: boolean;
    fromEmail: string;
    fromName: string | null;
    replyToEmail: string | null;
    defaultSubject: string | null;
    lastTestedAt?: Date | null;
    testStatus?: string | null;
}

interface ChangelogEntry {
    id: string;
    title: string;
    content: string;
    version?: string | null;
    publishedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
    tags?: { id: string; name: string }[];
}

interface Project {
    id: string;
    name: string;
    isPublic: boolean;
    allowAutoPublish: boolean;
    requireApproval: boolean;
    defaultTags: string[];
    createdAt: Date;
    updatedAt: Date;
}

// interface Subscriber {
//     id: string;
//     email: string;
//     name?: string;
//     subscriptionType: 'ALL_UPDATES' | 'MAJOR_ONLY' | 'DIGEST_ONLY';
//     createdAt: string;
//     lastEmailSentAt?: string;
// }

// Form schema
const formSchema = z.object({
    enabled: z.boolean().default(false),
    smtpHost: z.string().min(1, 'SMTP host is required'),
    smtpPort: z.coerce.number().int().min(1).max(65535),
    smtpUser: z.string().optional().nullable(),
    smtpPassword: z.string().optional().nullable(),
    smtpSecure: z.boolean().default(false),
    fromEmail: z.string().email('Invalid email address'),
    fromName: z.string().optional().nullable(),
    replyToEmail: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
    defaultSubject: z.string().optional().nullable(),
});

type FormValues = z.infer<typeof formSchema>;

// Test email form schema
const testEmailSchema = z.object({
    testEmail: z.string().email('Invalid email address'),
});

type TestEmailFormValues = z.infer<typeof testEmailSchema>;

// Send email form schema
const sendEmailSchema = z.object({
    recipientType: z.enum(['MANUAL', 'SUBSCRIBERS', 'BOTH']).default('SUBSCRIBERS'),
    manualRecipients: z.array(z.string().email("Invalid email address")).optional(),
    subject: z.string().min(1, "Subject is required"),
    changelogEntryId: z.string().optional(),
    isDigest: z.boolean().default(false),
    subscriptionTypes: z.array(z.enum(['ALL_UPDATES', 'MAJOR_ONLY', 'DIGEST_ONLY'])).optional(),
});

type SendEmailFormValues = z.infer<typeof sendEmailSchema>;

export default function EmailIntegrationPage() {
    const params = useParams();
    const router = useRouter();
    const {toast} = useToast();
    const queryClient = useQueryClient();
    const projectId = params.projectId as string;

    // State
    const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [activeTab, setActiveTab] = useState('settings');
    const [manualRecipients, setManualRecipients] = useState<string[]>([]);
    const [newRecipient, setNewRecipient] = useState('');
    const [recentEntries, setRecentEntries] = useState<ChangelogEntry[]>([]);
    const [isLoadingSubscribers, setIsLoadingSubscribers] = useState(false);
    const [subscriberCount, setSubscriberCount] = useState<number>(0);
    const [sendingToSubscribers, setSendingToSubscribers] = useState<boolean>(true);
    const [selectedSubscriptionTypes, setSelectedSubscriptionTypes] = useState<('ALL_UPDATES' | 'MAJOR_ONLY' | 'DIGEST_ONLY')[]>([
        'ALL_UPDATES', 'MAJOR_ONLY', 'DIGEST_ONLY'
    ]);

    const getCustomDomain = (): string | null => {
        if (typeof window === 'undefined') return null;

        const hostname = window.location.hostname;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

        try {
            const appDomain = new URL(appUrl).hostname;

            if (hostname !== appDomain &&
                !hostname.includes('localhost') &&
                !hostname.includes('127.0.0.1')) {
                return hostname;
            }
        } catch (error) {
            console.error('Error parsing app URL:', error);
        }

        return null;
    };

    // Fetch email configuration
    const {data: emailConfig, isLoading} = useQuery<EmailConfig>({
        queryKey: ['email-config', projectId],
        queryFn: async () => {
            const response = await fetch(`/api/projects/${projectId}/integrations/email`);
            if (!response.ok) throw new Error('Failed to fetch email configuration');
            return response.json();
        },
    });

    // Fetch project info
    const {data: project} = useQuery<Project>({
        queryKey: ['project', projectId],
        queryFn: async () => {
            const response = await fetch(`/api/projects/${projectId}`);
            if (!response.ok) throw new Error('Failed to fetch project');
            return response.json();
        },
    });

    // Fetch recent changelog entries
    const {data: entriesData} = useQuery({
        queryKey: ['changelog-entries', projectId],
        queryFn: async () => {
            const response = await fetch(`/api/projects/${projectId}/changelog?limit=10`);
            if (!response.ok) throw new Error('Failed to fetch changelog entries');
            return response.json();
        },
    });

    // Get subscriber count
    const fetchSubscriberCount = async () => {
        setIsLoadingSubscribers(true);
        try {
            const response = await fetch(`/api/subscribers?projectId=${projectId}&limit=1`);
            if (response.ok) {
                const data = await response.json();
                setSubscriberCount(data.totalCount || 0);
            }
        } catch (error) {
            console.error('Failed to fetch subscribers:', error);
        } finally {
            setIsLoadingSubscribers(false);
        }
    };

    // Update recent entries when data is loaded
    useEffect(() => {
        if (entriesData?.entries) {
            setRecentEntries(entriesData.entries);
        }
    }, [entriesData]);

    // Fetch subscribers count on tab change
    useEffect(() => {
        if (activeTab === 'send') {
            fetchSubscriberCount();
        }
    }, [activeTab, projectId]);

    // Configure main settings form
    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            enabled: false,
            smtpHost: '',
            smtpPort: 587,
            smtpUser: '',
            smtpPassword: '',
            smtpSecure: false,
            fromEmail: '',
            fromName: '',
            replyToEmail: '',
            defaultSubject: 'New Changelog Update',
        },
    });

    // Test email form
    const testEmailForm = useForm<TestEmailFormValues>({
        resolver: zodResolver(testEmailSchema),
        defaultValues: {
            testEmail: '',
        },
    });

    // Send email form
    const sendEmailForm = useForm<SendEmailFormValues>({
        resolver: zodResolver(sendEmailSchema),
        defaultValues: {
            recipientType: 'SUBSCRIBERS',
            manualRecipients: [],
            subject: project?.name ? `${project.name} - Changelog Update` : 'Changelog Update',
            changelogEntryId: undefined,
            isDigest: false,
            subscriptionTypes: ['ALL_UPDATES', 'MAJOR_ONLY', 'DIGEST_ONLY'],
        }
    });

    // Update form when data is loaded
    useEffect(() => {
        if (emailConfig) {
            form.reset({
                enabled: emailConfig.enabled,
                smtpHost: emailConfig.smtpHost,
                smtpPort: emailConfig.smtpPort,
                smtpUser: emailConfig.smtpUser || '',
                smtpPassword: '', // Don't populate password
                smtpSecure: emailConfig.smtpSecure,
                fromEmail: emailConfig.fromEmail,
                fromName: emailConfig.fromName || '',
                replyToEmail: emailConfig.replyToEmail || '',
                defaultSubject: emailConfig.defaultSubject || 'New Changelog Update',
            });
        }
    }, [emailConfig, form]);

    // Save configuration mutation
    const saveConfig = useMutation({
        mutationFn: async (data: FormValues) => {
            const response = await fetch(`/api/projects/${projectId}/integrations/email`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to save email configuration');
            }

            return response.json();
        },
        onSuccess: () => {
            toast({
                title: 'Settings Saved',
                description: 'Email configuration has been updated successfully.',
            });
            queryClient.invalidateQueries({queryKey: ['email-config', projectId]});
        },
        onError: (error) => {
            toast({
                title: 'Error',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    // Test connection mutation
    const testConnection = useMutation({
        mutationFn: async (data: TestEmailFormValues & FormValues) => {
            const response = await fetch(`/api/projects/${projectId}/integrations/email/test`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || error.message || 'Failed to test email connection');
            }

            return response.json();
        },
        onSuccess: () => {
            toast({
                title: 'Connection Successful',
                description: 'The test email was sent successfully.',
            });
            setIsTestDialogOpen(false);
            testEmailForm.reset();
        },
        onError: (error) => {
            toast({
                title: 'Connection Failed',
                description: error.message,
                variant: 'destructive',
            });
        },
    });

    // Email sending mutation
    const sendEmailMutation = useMutation({
        mutationFn: async (data: SendEmailFormValues) => {
            const isDigest = data.changelogEntryId === 'digest';
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const customDomain = getCustomDomain();

            // Prepare recipients based on selection
            let recipients: string[] = [];

            if (data.recipientType === 'MANUAL' || data.recipientType === 'BOTH') {
                recipients = [...manualRecipients];
            }

            // Build the payload
            const payload = {
                recipients: data.recipientType !== 'SUBSCRIBERS' ? recipients : undefined,
                subject: data.subject,
                isDigest,
                subscriptionTypes: (data.recipientType === 'SUBSCRIBERS' || data.recipientType === 'BOTH')
                    ? selectedSubscriptionTypes
                    : undefined,
                ...(isDigest ? {} : {changelogEntryId: data.changelogEntryId})
            };

            const response = await fetch(`/api/projects/${projectId}/integrations/email/send`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to send email');
            }

            return response.json();
        },
        onSuccess: (data) => {
            toast({
                title: 'Email Sent',
                description: `Successfully sent to ${data.recipientCount || 0} recipients.`,
            });
            // Reset form
            setManualRecipients([]);
            setSelectedSubscriptionTypes(['ALL_UPDATES', 'MAJOR_ONLY', 'DIGEST_ONLY']);
            sendEmailForm.reset({
                recipientType: 'SUBSCRIBERS',
                manualRecipients: [],
                subject: project?.name ? `${project.name} - Changelog Update` : 'Changelog Update',
                changelogEntryId: undefined,
                isDigest: false,
                subscriptionTypes: ['ALL_UPDATES', 'MAJOR_ONLY', 'DIGEST_ONLY']
            });
        },
        onError: (error) => {
            toast({
                title: 'Email Failed',
                description: error.message,
                variant: 'destructive',
            });
        }
    });

    // Add/remove recipients
    const addRecipient = () => {
        if (!newRecipient) return;

        try {
            // Validate email
            const email = z.string().email().parse(newRecipient);

            // Check for duplicates
            if (!manualRecipients.includes(email)) {
                setManualRecipients([...manualRecipients, email]);
                sendEmailForm.setValue('manualRecipients', [...manualRecipients, email]);
            }

            setNewRecipient('');
        } catch {
            // Invalid email format
            toast({
                title: 'Invalid Email',
                description: 'Please enter a valid email address',
                variant: 'destructive'
            });
        }
    };

    const removeRecipient = (index: number) => {
        const newRecipients = [...manualRecipients];
        newRecipients.splice(index, 1);
        setManualRecipients(newRecipients);
        sendEmailForm.setValue('manualRecipients', newRecipients);
    };

    const onSaveSubmit = (values: FormValues) => {
        saveConfig.mutate(values);
    };

    const onTestSubmit = (testValues: TestEmailFormValues) => {
        // Combine form values with test email
        const currentFormValues = form.getValues();

        testConnection.mutate({
            ...currentFormValues,
            ...testValues,
        });
    };

    const onSendEmailSubmit = (values: SendEmailFormValues) => {
        // Make sure we have selected recipients or subscriber types
        if (values.recipientType === 'MANUAL' && manualRecipients.length === 0) {
            toast({
                title: 'No Recipients',
                description: 'Please add at least one recipient email address',
                variant: 'destructive'
            });
            return;
        }

        if (values.recipientType === 'SUBSCRIBERS' && selectedSubscriptionTypes.length === 0) {
            toast({
                title: 'No Subscribers Selected',
                description: 'Please select at least one subscription type',
                variant: 'destructive'
            });
            return;
        }

        if (!values.changelogEntryId) {
            toast({
                title: 'No Content Selected',
                description: 'Please select a changelog entry or digest to send',
                variant: 'destructive'
            });
            return;
        }

        // Send the email
        sendEmailMutation.mutate({
            ...values,
            manualRecipients: manualRecipients,
            subscriptionTypes: selectedSubscriptionTypes
        });
    };

    // Toggle subscription type selection
    const toggleSubscriptionType = (type: 'ALL_UPDATES' | 'MAJOR_ONLY' | 'DIGEST_ONLY') => {
        if (selectedSubscriptionTypes.includes(type)) {
            // Remove if already selected
            setSelectedSubscriptionTypes(selectedSubscriptionTypes.filter(t => t !== type));
        } else {
            // Add if not selected
            setSelectedSubscriptionTypes([...selectedSubscriptionTypes, type]);
        }
    };

    // Handle recipient type change
    const handleRecipientTypeChange = (value: 'MANUAL' | 'SUBSCRIBERS' | 'BOTH') => {
        sendEmailForm.setValue('recipientType', value);
        setSendingToSubscribers(value === 'SUBSCRIBERS' || value === 'BOTH');
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader2Icon className="h-8 w-8 animate-spin text-primary"/>
            </div>
        );
    }

    return (
        <div className="container max-w-4xl mx-auto py-6">
            <div className="flex items-center mb-6">
                <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                    onClick={() => router.push(`/dashboard/projects/${projectId}/settings`)}
                >
                    <ArrowLeftIcon className="h-4 w-4"/>
                    Back to Settings
                </Button>
                <h1 className="text-2xl font-bold ml-4">Email Integration</h1>

                <div className="ml-auto">
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => router.push(`/dashboard/projects/${projectId}/integrations/email/subscribers`)}
                    >
                        <UsersIcon className="h-4 w-4"/>
                        Manage Subscribers
                    </Button>
                </div>
            </div>

            <motion.div
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.3}}
            >
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList className="mb-6">
                        <TabsTrigger value="settings" className="flex items-center gap-2">
                            <MailIcon className="h-4 w-4"/>
                            SMTP Settings
                        </TabsTrigger>
                        <TabsTrigger value="send" className="flex items-center gap-2">
                            <SendIcon className="h-4 w-4"/>
                            Send Emails
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="settings">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center">
                                    <MailIcon className="h-5 w-5 mr-2 text-primary"/>
                                    <CardTitle>Email SMTP Configuration</CardTitle>
                                </div>
                                <CardDescription>
                                    Configure SMTP settings to send changelog updates via email
                                </CardDescription>
                            </CardHeader>

                            <CardContent>
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(onSaveSubmit)} className="space-y-6">
                                        {/* Enable/Disable Switch */}
                                        <FormField
                                            control={form.control}
                                            name="enabled"
                                            render={({field}) => (
                                                <FormItem
                                                    className="flex flex-row items-center justify-between rounded-lg border p-4">
                                                    <div className="space-y-0.5">
                                                        <FormLabel className="text-base">
                                                            Enable Email Notifications
                                                        </FormLabel>
                                                        <FormDescription>
                                                            Send notifications when new changelog entries are published
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

                                        {/* SMTP Server Group */}
                                        <div className="border rounded-lg p-4">
                                            <h3 className="text-lg font-medium mb-4">SMTP Configuration</h3>
                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <FormField
                                                    control={form.control}
                                                    name="smtpHost"
                                                    render={({field}) => (
                                                        <FormItem>
                                                            <FormLabel>SMTP Host</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="smtp.example.com" {...field} />
                                                            </FormControl>
                                                            <FormMessage/>
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="smtpPort"
                                                    render={({field}) => (
                                                        <FormItem>
                                                            <FormLabel>SMTP Port</FormLabel>
                                                            <FormControl>
                                                                <Input type="number" {...field} />
                                                            </FormControl>
                                                            <FormMessage/>
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="smtpUser"
                                                    render={({field}) => (
                                                        <FormItem>
                                                            <FormLabel>SMTP Username</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="username" {...field}
                                                                       value={field.value ?? ""}/>
                                                            </FormControl>
                                                            <FormMessage/>
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="smtpPassword"
                                                    render={({field}) => (
                                                        <FormItem>
                                                            <FormLabel>SMTP Password</FormLabel>
                                                            <FormControl>
                                                                <div className="relative">
                                                                    <Input
                                                                        type={showPassword ? "text" : "password"}
                                                                        placeholder="••••••••"
                                                                        {...field}
                                                                        value={field.value ?? ""}
                                                                    />
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        className="absolute right-0 top-0 h-full px-3"
                                                                        onClick={() => setShowPassword(!showPassword)}
                                                                    >
                                                                        {showPassword ? (
                                                                            <EyeOffIcon className="h-4 w-4"/>
                                                                        ) : (
                                                                            <EyeIcon className="h-4 w-4"/>
                                                                        )}
                                                                    </Button>
                                                                </div>
                                                            </FormControl>
                                                            <FormDescription>
                                                                {emailConfig?.smtpPassword ?
                                                                    "Password saved. Leave blank to keep the same password." :
                                                                    "Enter your SMTP password."}
                                                            </FormDescription>
                                                            <FormMessage/>
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="smtpSecure"
                                                    render={({field}) => (
                                                        <FormItem
                                                            className="flex flex-row items-center justify-between rounded-lg border p-4 col-span-2">
                                                            <div className="space-y-0.5">
                                                                <FormLabel>Use Secure Connection (TLS)</FormLabel>
                                                                <FormDescription>
                                                                    Enable TLS encryption for SMTP connection
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
                                        </div>

                                        {/* Email Content Group */}
                                        <div className="border rounded-lg p-4">
                                            <h3 className="text-lg font-medium mb-4">Email Content</h3>
                                            <div className="grid gap-4 sm:grid-cols-2">
                                                <FormField
                                                    control={form.control}
                                                    name="fromEmail"
                                                    render={({field}) => (
                                                        <FormItem>
                                                            <FormLabel>From Email</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    placeholder="changelog@yourcompany.com" {...field} />
                                                            </FormControl>
                                                            <FormMessage/>
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="fromName"
                                                    render={({field}) => (
                                                        <FormItem>
                                                            <FormLabel>From Name</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="Your Company Changelog" {...field}
                                                                       value={field.value ?? ''}/>
                                                            </FormControl>
                                                            <FormMessage/>
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="replyToEmail"
                                                    render={({field}) => (
                                                        <FormItem>
                                                            <FormLabel>Reply-To Email (Optional)</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="support@yourcompany.com" {...field}
                                                                       value={field.value ?? ''}/>
                                                            </FormControl>
                                                            <FormMessage/>
                                                        </FormItem>
                                                    )}
                                                />

                                                <FormField
                                                    control={form.control}
                                                    name="defaultSubject"
                                                    render={({field}) => (
                                                        <FormItem>
                                                            <FormLabel>Default Subject</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="New Changelog Update" {...field}
                                                                       value={field.value || ''}/>
                                                            </FormControl>
                                                            <FormMessage/>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-4">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => setIsTestDialogOpen(true)}
                                                disabled={saveConfig.isPending || !form.formState.isValid}
                                            >
                                                <SendIcon className="mr-2 h-4 w-4"/>
                                                Test Connection
                                            </Button>

                                            <Button
                                                type="submit"
                                                disabled={saveConfig.isPending || !form.formState.isDirty}
                                            >
                                                {saveConfig.isPending ? (
                                                    <>
                                                        <Loader2Icon className="mr-2 h-4 w-4 animate-spin"/>
                                                        Saving...
                                                    </>
                                                ) : (
                                                    <>
                                                        <CheckIcon className="mr-2 h-4 w-4"/>
                                                        Save Settings
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    </form>
                                </Form>

                                {/* Testing status display */}
                                {emailConfig?.lastTestedAt && (
                                    <div className="mt-8 pt-4 border-t">
                                        <h3 className="text-sm font-medium mb-2">Testing Status</h3>
                                        <div className={`p-4 rounded-md ${
                                            emailConfig.testStatus?.startsWith('failed')
                                                ? 'bg-destructive/10 text-destructive'
                                                : 'bg-primary/10 text-primary'
                                        }`}>
                                            <div className="flex items-center">
                                                {emailConfig.testStatus?.startsWith('failed')
                                                    ? <AlertCircleIcon className="h-5 w-5 mr-2"/>
                                                    : <CheckIcon className="h-5 w-5 mr-2"/>
                                                }
                                                <div>
                                                    <p className="font-medium">
                                                        {emailConfig.testStatus?.startsWith('failed')
                                                            ? 'Test Failed'
                                                            : 'Test Successful'
                                                        }
                                                    </p>
                                                    <p className="text-sm">
                                                        {emailConfig.testStatus?.startsWith('failed') ? emailConfig.testStatus.replace('failed: ', '')
                                                            : 'Connection verified and test email sent successfully.'
                                                        }
                                                    </p>
                                                    <p className="text-xs mt-1">
                                                        Last
                                                        tested: {new Date(emailConfig.lastTestedAt).toLocaleString()}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="send">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center">
                                    <SendIcon className="h-5 w-5 mr-2 text-primary"/>
                                    <CardTitle>Send Changelog Email</CardTitle>
                                </div>
                                <CardDescription>
                                    Send changelog updates to specific recipients or subscribers
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {!emailConfig?.enabled ? (
                                    <Alert className="mb-6">
                                        <AlertDescription>
                                            Email notifications are not enabled. Please enable them in the SMTP Settings
                                            tab.
                                        </AlertDescription>
                                    </Alert>
                                ) : (
                                    <Form {...sendEmailForm}>
                                        <form onSubmit={sendEmailForm.handleSubmit(onSendEmailSubmit)}
                                              className="space-y-6">
                                            <FormField
                                                control={sendEmailForm.control}
                                                name="subject"
                                                render={({field}) => (
                                                    <FormItem>
                                                        <FormLabel>Email Subject</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="New Changelog Update" {...field} />
                                                        </FormControl>
                                                        <FormMessage/>
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={sendEmailForm.control}
                                                name="changelogEntryId"
                                                render={({field}) => (
                                                    <FormItem>
                                                        <FormLabel>Content to Send</FormLabel>
                                                        <Select
                                                            onValueChange={field.onChange}
                                                            defaultValue={field.value}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue
                                                                        placeholder="Select an entry or send a digest"/>
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="digest">
                                                                    <div className="flex items-center">
                                                                        <div
                                                                            className="mr-2 h-2 w-2 rounded-full bg-primary"></div>
                                                                        Send digest of recent entries
                                                                    </div>
                                                                </SelectItem>
                                                                {recentEntries.map(entry => (
                                                                    <SelectItem key={entry.id} value={entry.id}>
                                                                        {entry.title} {entry.version ? `(${entry.version})` : ''}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormDescription>
                                                            Choose a specific changelog entry or send a digest of recent
                                                            entries
                                                        </FormDescription>
                                                        <FormMessage/>
                                                    </FormItem>
                                                )}
                                            />

                                            <div className="border rounded-md p-4">
                                                <FormField
                                                    control={sendEmailForm.control}
                                                    name="recipientType"
                                                    render={({field}) => (
                                                        <FormItem className="space-y-3">
                                                            <FormLabel>Send To</FormLabel>
                                                            <FormControl>
                                                                <RadioGroup
                                                                    onValueChange={(value) =>
                                                                        handleRecipientTypeChange(value as 'MANUAL' | 'SUBSCRIBERS' | 'BOTH')
                                                                    }
                                                                    defaultValue={field.value}
                                                                    className="flex flex-col space-y-1"
                                                                >
                                                                    <FormItem
                                                                        className="flex items-center space-x-3 space-y-0">
                                                                        <FormControl>
                                                                            <RadioGroupItem value="SUBSCRIBERS"/>
                                                                        </FormControl>
                                                                        <FormLabel
                                                                            className="font-normal cursor-pointer">
                                                                            <div className="flex items-center">
                                                                                <UsersIcon
                                                                                    className="h-4 w-4 mr-2 text-muted-foreground"/>
                                                                                Subscribers
                                                                                {isLoadingSubscribers ? (
                                                                                    <Loader2Icon
                                                                                        className="ml-2 h-3 w-3 animate-spin"/>
                                                                                ) : (
                                                                                    <Badge variant="outline"
                                                                                           className="ml-2">
                                                                                        {subscriberCount}
                                                                                    </Badge>
                                                                                )}
                                                                            </div>
                                                                        </FormLabel>
                                                                    </FormItem>
                                                                    <FormItem
                                                                        className="flex items-center space-x-3 space-y-0">
                                                                        <FormControl>
                                                                            <RadioGroupItem value="MANUAL"/>
                                                                        </FormControl>
                                                                        <FormLabel
                                                                            className="font-normal cursor-pointer">
                                                                            <div className="flex items-center">
                                                                                <MailIcon
                                                                                    className="h-4 w-4 mr-2 text-muted-foreground"/>
                                                                                Manual Recipients
                                                                                {manualRecipients.length > 0 && (
                                                                                    <Badge variant="outline"
                                                                                           className="ml-2">
                                                                                        {manualRecipients.length}
                                                                                    </Badge>
                                                                                )}
                                                                            </div>
                                                                        </FormLabel>
                                                                    </FormItem>
                                                                    <FormItem
                                                                        className="flex items-center space-x-3 space-y-0">
                                                                        <FormControl>
                                                                            <RadioGroupItem value="BOTH"/>
                                                                        </FormControl>
                                                                        <FormLabel
                                                                            className="font-normal cursor-pointer">
                                                                            <div className="flex items-center">
                                                                                <UserPlusIcon
                                                                                    className="h-4 w-4 mr-2 text-muted-foreground"/>
                                                                                Both (Subscribers and Manual Recipients)
                                                                            </div>
                                                                        </FormLabel>
                                                                    </FormItem>
                                                                </RadioGroup>
                                                            </FormControl>
                                                            <FormMessage/>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>

                                            {/* Subscription Types - Only show if sending to subscribers */}
                                            {sendingToSubscribers && (
                                                <div className="border rounded-md p-4">
                                                    <h3 className="text-sm font-medium mb-2">Subscription Types</h3>
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        <Badge
                                                            variant={selectedSubscriptionTypes.includes('ALL_UPDATES') ? "default" : "outline"}
                                                            className="cursor-pointer hover:bg-primary/90 transition-colors"
                                                            onClick={() => toggleSubscriptionType('ALL_UPDATES')}
                                                        >
                                                            {selectedSubscriptionTypes.includes('ALL_UPDATES') && (
                                                                <CheckCircleIcon className="mr-1 h-3 w-3"/>
                                                            )}
                                                            All Updates
                                                        </Badge>
                                                        <Badge
                                                            variant={selectedSubscriptionTypes.includes('MAJOR_ONLY') ? "default" : "outline"}
                                                            className="cursor-pointer hover:bg-primary/90 transition-colors"
                                                            onClick={() => toggleSubscriptionType('MAJOR_ONLY')}
                                                        >
                                                            {selectedSubscriptionTypes.includes('MAJOR_ONLY') && (
                                                                <CheckCircleIcon className="mr-1 h-3 w-3"/>
                                                            )}
                                                            Major Updates Only
                                                        </Badge>
                                                        <Badge
                                                            variant={selectedSubscriptionTypes.includes('DIGEST_ONLY') ? "default" : "outline"}
                                                            className="cursor-pointer hover:bg-primary/90 transition-colors"
                                                            onClick={() => toggleSubscriptionType('DIGEST_ONLY')}
                                                        >
                                                            {selectedSubscriptionTypes.includes('DIGEST_ONLY') && (
                                                                <CheckCircleIcon className="mr-1 h-3 w-3"/>
                                                            )}
                                                            Digest Only
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground mt-2">
                                                        Select which subscription types to include in this email.
                                                    </p>
                                                </div>
                                            )}

                                            {/* Manual recipients - Only show if manual recipients are enabled */}
                                            {(sendEmailForm.watch('recipientType') === 'MANUAL' || sendEmailForm.watch('recipientType') === 'BOTH') && (
                                                <FormField
                                                    control={sendEmailForm.control}
                                                    name="manualRecipients"
                                                    render={() => (
                                                        <FormItem>
                                                            <FormLabel>Manual Recipients</FormLabel>
                                                            <div className="space-y-3">
                                                                <div className="flex gap-2">
                                                                    <Input
                                                                        placeholder="example@email.com"
                                                                        value={newRecipient}
                                                                        onChange={(e) => setNewRecipient(e.target.value)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') {
                                                                                e.preventDefault();
                                                                                addRecipient();
                                                                            }
                                                                        }}
                                                                        className="flex-1"
                                                                    />
                                                                    <Button
                                                                        type="button"
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={addRecipient}
                                                                        disabled={!newRecipient}
                                                                        className="whitespace-nowrap"
                                                                    >
                                                                        <PlusIcon className="h-4 w-4 mr-1"/>
                                                                        Add
                                                                    </Button>
                                                                </div>

                                                                {manualRecipients.length > 0 && (
                                                                    <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-muted/30">
                                                                        {manualRecipients.map((email, index) => (
                                                                            <Badge
                                                                                key={index}
                                                                                variant="secondary"
                                                                                className="flex items-center gap-2 px-3 py-2"
                                                                            >
                                                                                <MailIcon className="h-3 w-3"/>
                                                                                <span>{email}</span>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => removeRecipient(index)}
                                                                                    className="ml-1 hover:text-destructive transition-colors"
                                                                                >
                                                                                    <XIcon className="h-4 w-4"/>
                                                                                </button>
                                                                            </Badge>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {sendEmailForm.formState.errors.manualRecipients && (
                                                                <p className="text-sm font-medium text-destructive">
                                                                    {sendEmailForm.formState.errors.manualRecipients.message}
                                                                </p>
                                                            )}
                                                            <FormDescription>
                                                                Enter an email and click Add, or press Enter to add a recipient
                                                            </FormDescription>
                                                        </FormItem>
                                                    )}
                                                />
                                            )}

                                            {/* Send button and summary */}
                                            <div className="border rounded-md p-4 bg-muted/20">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h3 className="text-sm font-medium">Recipient Summary</h3>
                                                        <p className="text-sm text-muted-foreground mt-1">
                                                            {sendEmailForm.watch('recipientType') === 'SUBSCRIBERS' && (
                                                                <>Sending to {subscriberCount} subscribers</>
                                                            )}
                                                            {sendEmailForm.watch('recipientType') === 'MANUAL' && (
                                                                <>Sending to {manualRecipients.length} manual
                                                                    recipients</>
                                                            )}
                                                            {sendEmailForm.watch('recipientType') === 'BOTH' && (
                                                                <>Sending to {manualRecipients.length} manual recipients
                                                                    and approximately {subscriberCount} subscribers</>
                                                            )}
                                                        </p>
                                                    </div>
                                                    <Button
                                                        type="submit"
                                                        disabled={
                                                            sendEmailMutation.isPending ||
                                                            (sendEmailForm.watch('recipientType') === 'MANUAL' && manualRecipients.length === 0) ||
                                                            (sendEmailForm.watch('recipientType') === 'SUBSCRIBERS' && selectedSubscriptionTypes.length === 0) ||
                                                            !sendEmailForm.watch('changelogEntryId')
                                                        }
                                                    >
                                                        {sendEmailMutation.isPending ? (
                                                            <>
                                                                <Loader2Icon className="mr-2 h-4 w-4 animate-spin"/>
                                                                Sending...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <SendIcon className="mr-2 h-4 w-4"/>
                                                                Send Email
                                                            </>
                                                        )}
                                                    </Button>
                                                </div>
                                            </div>
                                        </form>
                                    </Form>
                                )}
                            </CardContent>
                        </Card>

                        {/* Email Preview Box */}
                        <Card className="mt-4">
                            <CardHeader>
                                <CardTitle className="text-sm">Email Preview</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="bg-card border rounded-md p-4 mb-4 text-sm">
                                    <div style={{maxWidth: '100%'}}>
                                        <h2 style={{
                                            fontSize: '18px',
                                            fontWeight: 'bold',
                                            marginBottom: '10px',
                                            textAlign: 'center'
                                        }}>
                                            {project?.name || 'Project Name'} Changelog
                                        </h2>
                                        <p style={{
                                            color: '#666',
                                            fontSize: '14px',
                                            marginBottom: '10px',
                                            textAlign: 'center'
                                        }}>
                                            {sendEmailForm.watch('changelogEntryId') === 'digest' ? 'Recent updates to our product' : 'New update to our product'}
                                        </p>
                                        <hr style={{margin: '10px 0'}}/>

                                        <div style={{padding: '10px 0'}}>
                                            <div style={{fontSize: '16px', fontWeight: 'bold', margin: '8px 0'}}>
                                                {recentEntries.length > 0 && sendEmailForm.watch('changelogEntryId') !== 'digest'
                                                    ? recentEntries.find(e => e.id === sendEmailForm.watch('changelogEntryId'))?.title || 'Example Changelog Entry'
                                                    : 'Recent Updates'}
                                                {recentEntries.length > 0 && sendEmailForm.watch('changelogEntryId') !== 'digest' && (
                                                    <span style={{
                                                        color: '#666',
                                                        fontSize: '12px',
                                                        fontWeight: 'normal',
                                                        marginLeft: '8px'
                                                    }}>
                                                        {recentEntries.find(e => e.id === sendEmailForm.watch('changelogEntryId'))?.version || 'v1.0.0'}
                                                    </span>
                                                )}
                                            </div>

                                            <div style={{marginBottom: '8px'}}>
                                                <span style={{
                                                    backgroundColor: '#f1f5f9',
                                                    borderRadius: '4px',
                                                    color: '#475569',
                                                    display: 'inline-block',
                                                    fontSize: '10px',
                                                    margin: '0 4px 4px 0',
                                                    padding: '2px 6px'
                                                }}>
                                                    {sendEmailForm.watch('changelogEntryId') === 'digest' ? 'Multiple Updates' : 'Feature'}
                                                </span>
                                            </div>

                                            {sendEmailForm.watch('changelogEntryId') === 'digest'
                                                ? <div style={{
                                                    color: '#333',
                                                    fontSize: '12px',
                                                    lineHeight: '1.4',
                                                    margin: '8px 0'
                                                }}>
                                                    &apos;This digest contains multiple recent updates to our
                                                    product...&apos;
                                                </div>
                                                : <div style={{
                                                    color: '#333',
                                                    fontSize: '12px',
                                                    lineHeight: '1.4',
                                                    margin: '8px 0'
                                                }}>
                                                    <RenderMarkdown>
                                                        {(() => {
                                                            const entry = recentEntries.find(e => e.id === sendEmailForm.watch('changelogEntryId'));
                                                            return entry?.content
                                                                ? entry.content.substring(0, 100) + '...'
                                                                : 'This is a simplified preview of how your email will look.';
                                                        })()}
                                                    </RenderMarkdown>
                                                </div>}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <p>
                                        This is a simplified preview. Actual emails will include styling and formatting
                                        based on the entry content.
                                    </p>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="hover:text-foreground transition-colors"
                                        onClick={() => router.push(`/dashboard/projects/${projectId}/integrations/email/subscribers`)}
                                    >
                                        <UsersIcon className="h-3 w-3 mr-1"/>
                                        Manage Subscribers
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Test email dialog */}
                <AlertDialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Test Email Connection</AlertDialogTitle>
                            <AlertDialogDescription>
                                Send a test email to verify your SMTP configuration.
                                This will validate your settings and confirm that emails can be delivered.
                            </AlertDialogDescription>
                        </AlertDialogHeader>

                        <Form {...testEmailForm}>
                            <form onSubmit={testEmailForm.handleSubmit(onTestSubmit)} className="py-4">
                                <FormField
                                    control={testEmailForm.control}
                                    name="testEmail"
                                    render={({field}) => (
                                        <FormItem>
                                            <FormLabel>Recipient Email</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="you@example.com"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormDescription>
                                                Enter your email address to receive the test message
                                            </FormDescription>
                                            <FormMessage/>
                                        </FormItem>
                                    )}
                                />
                            </form>
                        </Form>

                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                disabled={testConnection.isPending || !testEmailForm.formState.isValid}
                                onClick={testEmailForm.handleSubmit(onTestSubmit)}
                            >
                                {testConnection.isPending ? (
                                    <>
                                        <Loader2Icon className="mr-2 h-4 w-4 animate-spin"/>
                                        Testing...
                                    </>
                                ) : (
                                    <>
                                        <SendIcon className="mr-2 h-4 w-4"/>
                                        Send Test Email
                                    </>
                                )}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </motion.div>
        </div>
    );
}