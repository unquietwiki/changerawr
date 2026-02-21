'use client'

import React, {useState, useEffect} from 'react';
import {useAuth} from '@/context/auth';
import {useRouter} from 'next/navigation';
import {useThemeWithLoading} from '@/components/theme-provider';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {useToast} from '@/hooks/use-toast';
import {Loader2, Moon, Sun, Save, Bell, Lock, Globe} from 'lucide-react';
import {motion, AnimatePresence} from 'framer-motion';
import {useMediaQuery} from '@/hooks/use-media-query';
import {Switch} from '@/components/ui/switch';
import {Separator} from '@/components/ui/separator';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {PasskeysSection} from "@/components/settings/passkeys-section";
import ConnectedSsoProviders from '@/components/settings/connected-sso-section';
import {SearchableSelect} from '@/components/ui/searchable-select';
import {getTimezonesByRegion} from '@/lib/constants/timezones';

interface FormState {
    name: string;
    enableNotifications: boolean;
    timezone: string | null;
}

interface TimezoneConfig {
    allowUserTimezone: boolean;
    timezone: string;
    source: 'user' | 'system';
}

interface OAuthProvider {
    id: string;
    name: string;
    enabled: boolean;
    isDefault: boolean;
}

interface OAuthConnection {
    id: string;
    providerId: string;
    provider: OAuthProvider;
    providerUserId: string;
    expiresAt: string | null;
    createdAt: string;
    updatedAt: string;
}

interface SsoData {
    connections: OAuthConnection[];
    allProviders: OAuthProvider[];
}

export default function SettingsPage() {
    const {user} = useAuth();
    const {theme, setTheme, isLoading: themeLoading} = useThemeWithLoading();
    const router = useRouter();
    const {toast} = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);
    const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
    const [isResettingPassword, setIsResettingPassword] = useState(false);
    const isMobile = useMediaQuery("(max-width: 640px)");

    // SSO connections state
    const [ssoData, setSsoData] = useState<SsoData>({
        connections: [],
        allProviders: []
    });
    const [isSsoLoading, setIsSsoLoading] = useState(true);

    // Original saved values - these don't change unless we explicitly save
    const [savedValues, setSavedValues] = useState<FormState | null>(null);

    const [timezoneConfig, setTimezoneConfig] = useState<TimezoneConfig>({
        allowUserTimezone: true,
        timezone: 'UTC',
        source: 'system',
    });

    // Current form values that the user is editing
    const [formState, setFormState] = useState<FormState>({
        name: '',
        enableNotifications: true,
        timezone: null,
    });

    // Fetch current settings
    useEffect(() => {
        async function fetchSettings() {
            try {
                setIsFetching(true);
                const [settingsRes, tzRes] = await Promise.all([
                    fetch('/api/auth/settings'),
                    fetch('/api/config/timezone'),
                ]);

                if (tzRes.ok) {
                    const tzData = await tzRes.json();
                    setTimezoneConfig(tzData);
                }

                if (settingsRes.ok) {
                    const data = await settingsRes.json();

                    const initialValues: FormState = {
                        name: user?.name || '',
                        enableNotifications: data.enableNotifications !== undefined
                            ? data.enableNotifications
                            : true,
                        timezone: data.timezone ?? null,
                    };

                    setSavedValues(initialValues);
                    setFormState(initialValues);
                }
            } catch (error) {
                console.error('Failed to fetch settings:', error);
                toast({
                    title: 'Error',
                    description: 'Failed to load your settings. Please try again.',
                    variant: 'destructive',
                });
            } finally {
                setIsFetching(false);
            }
        }

        if (user) {
            fetchSettings();
        }
    }, [user, toast]);

    // Fetch SSO connections
    useEffect(() => {
        async function fetchSsoConnections() {
            try {
                setIsSsoLoading(true);
                const response = await fetch('/api/auth/connections');
                if (response.ok) {
                    const data = await response.json();
                    setSsoData(data);
                }
            } catch (error) {
                console.error('Failed to fetch SSO connections:', error);
                // Don't show error toast for SSO data as it's not critical
            } finally {
                setIsSsoLoading(false);
            }
        }

        if (user) {
            fetchSsoConnections();
        }
    }, [user]);

    // Check if there are unsaved changes
    const hasChanges = savedValues ? (
        formState.name !== savedValues.name ||
        formState.enableNotifications !== savedValues.enableNotifications ||
        formState.timezone !== savedValues.timezone
    ) : false;

    // Handle theme toggle - now much simpler
    const handleThemeToggle = (newTheme: string) => {
        setTheme(newTheme);
    };

    // Handle name change
    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormState(prev => ({...prev, name: e.target.value}));
    };

    // Handle notification toggle
    const handleNotificationToggle = (checked: boolean) => {
        setFormState(prev => ({...prev, enableNotifications: checked}));
    };

    // Handle password reset request
    const handlePasswordReset = async () => {
        setIsResettingPassword(true);
        try {
            const response = await fetch('/api/auth/reset-password/request', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
            });

            if (!response.ok) {
                throw new Error('Failed to request password reset');
            }

            await response.json();

            toast({
                title: 'Password reset email sent',
                description: 'Check your email for a link to reset your password.',
            });

            setIsResetDialogOpen(false);
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'An error occurred',
                variant: 'destructive',
            });
        } finally {
            setIsResettingPassword(false);
        }
    };

    // Handle save
    const handleSave = async () => {
        if (!hasChanges || !savedValues) return;

        setIsLoading(true);
        try {
            const response = await fetch('/api/auth/settings', {
                method: 'PATCH',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(formState),
            });

            if (!response.ok) throw new Error('Failed to update settings');

            // Update saved values to reflect the new saved state
            setSavedValues(formState);

            toast({
                title: 'Settings saved',
                description: 'Your settings have been updated successfully.',
            });

            // Refresh the router to update any server-side data
            router.refresh();

        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'An error occurred',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Handle cancel/revert changes
    const handleCancel = () => {
        if (savedValues) {
            setFormState(savedValues);
        }
    };

    if (isFetching || themeLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-primary"/>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    handleSave();
                }}
                className="container max-w-2xl px-4 md:px-6 space-y-4 md:space-y-6 pb-20 md:pb-8"
            >
                {/* Desktop header */}
                <div
                    className="hidden md:flex sticky top-0 z-10 bg-background pt-4 pb-2 mb-4 flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Settings</h1>
                            <p className="text-sm text-muted-foreground mt-1">
                                Manage your account settings and preferences.
                            </p>
                        </div>
                    </div>

                    <AnimatePresence>
                        {hasChanges && (
                            <motion.div
                                initial={{opacity: 0, y: 20}}
                                animate={{opacity: 1, y: 0}}
                                exit={{opacity: 0, y: 20}}
                                transition={{duration: 0.2}}
                                className="flex gap-2 w-full sm:w-auto"
                            >
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleCancel}
                                    className="flex-1 sm:flex-initial"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isLoading}
                                    className="flex-1 sm:flex-initial sm:min-w-[100px]"
                                >
                                    {isLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin"/>
                                    ) : (
                                        <>
                                            <Save className="mr-2 h-4 w-4"/>
                                            Save Changes
                                        </>
                                    )}
                                </Button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Theme selection card */}
                <Card className="border shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg md:text-xl">Appearance</CardTitle>
                        <CardDescription className="text-sm">
                            Choose your preferred theme. Your selection is automatically saved.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-3">
                            <ThemeButton
                                isActive={theme === 'light'}
                                onClick={() => handleThemeToggle('light')}
                                icon={<Sun className="h-4 w-4 md:h-5 md:w-5"/>}
                                name="Light"
                                disabled={themeLoading}
                            />
                            <ThemeButton
                                isActive={theme === 'dark'}
                                onClick={() => handleThemeToggle('dark')}
                                icon={<Moon className="h-4 w-4 md:h-5 md:w-5"/>}
                                name="Dark"
                                disabled={themeLoading}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Timezone card */}
                {timezoneConfig.allowUserTimezone && (
                    <Card className="border shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg md:text-xl flex items-center gap-2">
                                <Globe className="h-5 w-5 text-muted-foreground" />
                                Timezone
                            </CardTitle>
                            <CardDescription className="text-sm">
                                Set your preferred timezone. Leave as system default to use the global setting ({timezoneConfig.timezone}).
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <SearchableSelect
                                value={formState.timezone ?? '__system__'}
                                onValueChange={(value) =>
                                    setFormState(prev => ({
                                        ...prev,
                                        timezone: value === '__system__' ? null : value,
                                    }))
                                }
                                placeholder="Select timezone"
                                searchPlaceholder="Search timezones..."
                                items={[
                                    {
                                        value: '__system__',
                                        label: `System Default (${timezoneConfig.timezone})`,
                                        searchValue: 'system default',
                                    },
                                ]}
                                groups={Object.entries(getTimezonesByRegion()).map(([region, tzs]) => ({
                                    heading: region,
                                    items: tzs.map(tz => ({
                                        value: tz.value,
                                        label: `${tz.label} (${tz.value})`,
                                        searchValue: `${tz.label} ${tz.value} ${region}`,
                                    })),
                                }))}
                            />
                        </CardContent>
                    </Card>
                )}

                {/* Notification settings card */}
                <Card className="border shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg md:text-xl">Notifications</CardTitle>
                        <CardDescription className="text-sm">
                            Manage your notification preferences.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-start justify-between space-x-3">
                            <div className="flex items-start space-x-3 flex-1">
                                <Bell className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0"/>
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium text-sm md:text-base">Email Notifications</p>
                                    <p className="text-xs md:text-sm text-muted-foreground mt-1">
                                        Receive email notifications for important events like request approvals.
                                    </p>
                                </div>
                            </div>
                            <Switch
                                checked={formState.enableNotifications}
                                onCheckedChange={handleNotificationToggle}
                                className="flex-shrink-0"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Profile card */}
                <Card className="border shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg md:text-xl">Profile</CardTitle>
                        <CardDescription className="text-sm">
                            Update your profile information.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 md:space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-sm font-medium">Display Name</Label>
                            <Input
                                id="name"
                                value={formState.name}
                                onChange={handleNameChange}
                                placeholder="Enter your display name"
                                className="h-10 md:h-11"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                            <Input
                                id="email"
                                value={user?.email}
                                disabled
                                className="h-10 md:h-11 bg-muted cursor-not-allowed"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Your email address cannot be changed.
                            </p>
                        </div>

                        <Separator className="my-4"/>

                        {/* Password Reset Section */}
                        <div className="pt-2">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <div className="space-y-1 flex-1">
                                    <h3 className="text-sm font-medium flex items-center">
                                        <Lock className="h-4 w-4 mr-1"/>
                                        Password
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        Reset your account password via email.
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsResetDialogOpen(true)}
                                    className="w-full sm:w-auto"
                                >
                                    Reset Password
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Connected SSO Providers Section */}
                <ConnectedSsoProviders
                    connections={ssoData.connections}
                    allProviders={ssoData.allProviders}
                    isLoading={isSsoLoading}
                />

                {/* Passkeys Section */}
                <PasskeysSection/>

                {/* Password Reset Dialog */}
                <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Reset Password</DialogTitle>
                            <DialogDescription>
                                This will send a password reset link to your email address: {user?.email}
                            </DialogDescription>
                        </DialogHeader>
                        <p className="text-sm text-muted-foreground">
                            For security reasons, you will be logged out of all devices after resetting your password.
                        </p>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setIsResetDialogOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handlePasswordReset}
                                disabled={isResettingPassword}
                            >
                                {isResettingPassword ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                                        Sending...
                                    </>
                                ) : 'Send Reset Link'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Mobile fixed save button */}
                {isMobile && hasChanges && (
                    <motion.div
                        initial={{y: 100, opacity: 0}}
                        animate={{y: 0, opacity: 1}}
                        exit={{y: 100, opacity: 0}}
                        className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t z-40"
                    >
                        <div className="flex gap-3 max-w-sm mx-auto">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleCancel}
                                className="flex-1 h-11"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="flex-1 h-11"
                            >
                                {isLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin"/>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4"/>
                                        Save
                                    </>
                                )}
                            </Button>
                        </div>
                    </motion.div>
                )}
            </form>
        </div>
    );
}

// A component for theme selection buttons
function ThemeButton({
                         isActive,
                         onClick,
                         icon,
                         name,
                         disabled = false
                     }: {
    isActive: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    name: string;
    disabled?: boolean;
}) {
    return (
        <Button
            type="button"
            variant={isActive ? "default" : "outline"}
            className="w-full relative h-14 justify-start px-5"
            onClick={onClick}
            disabled={disabled}
        >
            <div className="flex items-center">
                <div className="mr-3">
                    {icon}
                </div>
                <span className="font-medium">{name}</span>
            </div>

            {isActive && (
                <motion.span
                    initial={{opacity: 0, scale: 0.8}}
                    animate={{opacity: 1, scale: 1}}
                    className="absolute right-3 text-xs bg-primary-foreground text-primary px-2 py-1 rounded-full"
                >
                    Active
                </motion.span>
            )}
        </Button>
    );
}