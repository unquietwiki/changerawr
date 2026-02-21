// components/setup/steps/settings-step.tsx
'use client';

import React, { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { SetupStep } from '@/components/setup/setup-step';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useSetup } from '@/components/setup/setup-context';
import { toast } from '@/hooks/use-toast';
import { Settings, Globe } from 'lucide-react';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { getTimezonesByRegion } from '@/lib/constants/timezones';

interface SettingsStepProps {
    onNext: () => void;
    onBack: () => void;
}

const settingsSchema = z.object({
    defaultInvitationExpiry: z.number().min(1).max(30).default(7),
    requireApprovalForChangelogs: z.boolean().default(true),
    maxChangelogEntriesPerProject: z.number().min(10).max(10000).default(100),
    enableAnalytics: z.boolean().default(true),
    enableNotifications: z.boolean().default(true),
    timezone: z.string().min(1).max(100).default('UTC'),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

export function SettingsStep({ onNext, onBack }: SettingsStepProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { markStepCompleted, isStepCompleted } = useSetup();
    const isCompleted = isStepCompleted('settings');

    const {
        register,
        handleSubmit,
        setValue,
        watch,
        formState: { errors }
    } = useForm<SettingsFormValues>({
        resolver: zodResolver(settingsSchema),
        defaultValues: {
            defaultInvitationExpiry: 7,
            requireApprovalForChangelogs: true,
            maxChangelogEntriesPerProject: 100,
            enableAnalytics: true,
            enableNotifications: true,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        }
    });

    // For the switches we need to watch the values
    const requireApprovalForChangelogs = watch('requireApprovalForChangelogs');
    const enableAnalytics = watch('enableAnalytics');
    const enableNotifications = watch('enableNotifications');

    const onSubmit = async (data: SettingsFormValues) => {
        if (isCompleted) {
            onNext();
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await fetch('/api/setup/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save system settings');
            }

            markStepCompleted('settings');
            toast({
                title: 'Success',
                description: 'System settings saved successfully',
            });
            onNext();
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to save system settings',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SetupStep
            title="System Settings"
            description="Configure your system's default behavior"
            icon={<Settings className="h-10 w-10 text-primary" />}
            onNext={isCompleted ? onNext : undefined}
            onBack={onBack}
            isLoading={isSubmitting}
            isComplete={isCompleted}
            hideFooter={!isCompleted}
        >
            <form id="settingsForm" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="defaultInvitationExpiry">
                        Default Invitation Expiry (days)
                    </Label>
                    <Input
                        id="defaultInvitationExpiry"
                        type="number"
                        {...register('defaultInvitationExpiry', { valueAsNumber: true })}
                    />
                    {errors.defaultInvitationExpiry && (
                        <p className="text-sm text-destructive">
                            {errors.defaultInvitationExpiry.message}
                        </p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="maxChangelogEntriesPerProject">
                        Max Changelog Entries per Project
                    </Label>
                    <Input
                        id="maxChangelogEntriesPerProject"
                        type="number"
                        {...register('maxChangelogEntriesPerProject', { valueAsNumber: true })}
                    />
                    {errors.maxChangelogEntriesPerProject && (
                        <p className="text-sm text-destructive">
                            {errors.maxChangelogEntriesPerProject.message}
                        </p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        Timezone
                    </Label>
                    <SearchableSelect
                        value={watch('timezone')}
                        onValueChange={(value) => setValue('timezone', value)}
                        placeholder="Select timezone"
                        searchPlaceholder="Search timezones..."
                        groups={Object.entries(getTimezonesByRegion()).map(([region, tzs]) => ({
                            heading: region,
                            items: tzs.map(tz => ({
                                value: tz.value,
                                label: `${tz.label} (${tz.value})`,
                                searchValue: `${tz.label} ${tz.value} ${region}`,
                            })),
                        }))}
                    />
                    <p className="text-sm text-muted-foreground">
                        Used for date-based version templates and scheduling
                    </p>
                </div>

                <Separator />

                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Require Changelog Approval</Label>
                            <p className="text-sm text-muted-foreground">
                                Require approval for new changelog entries
                            </p>
                        </div>
                        <Switch
                            checked={requireApprovalForChangelogs}
                            onCheckedChange={(checked) => setValue('requireApprovalForChangelogs', checked)}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Enable Analytics</Label>
                            <p className="text-sm text-muted-foreground">
                                Collect usage statistics and analytics
                            </p>
                        </div>
                        <Switch
                            checked={enableAnalytics}
                            onCheckedChange={(checked) => setValue('enableAnalytics', checked)}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label>Enable Notifications</Label>
                            <p className="text-sm text-muted-foreground">
                                Send notifications for important events
                            </p>
                        </div>
                        <Switch
                            checked={enableNotifications}
                            onCheckedChange={(checked) => setValue('enableNotifications', checked)}
                        />
                    </div>
                </div>

                {!isCompleted && (
                    <div className="pt-4">
                        <button
                            type="submit"
                            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 py-2 px-4 rounded-md font-medium"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Saving Settings...' : 'Save System Settings'}
                        </button>
                    </div>
                )}
            </form>
        </SetupStep>
    );
}