'use client';

import {useState, useRef} from 'react';
import {useForm} from 'react-hook-form';
import {zodResolver} from '@hookform/resolvers/zod';
import {z} from 'zod';
import {motion, AnimatePresence} from 'framer-motion';
import {ArrowRight, Check, AlertCircle, Mail, Clock, Zap, CheckCircle2, Bell} from 'lucide-react';
import {Form, FormControl, FormField, FormItem, FormMessage} from '@/components/ui/form';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
import {Alert, AlertDescription} from '@/components/ui/alert';
import {cn} from '@/lib/utils';
import confetti from 'canvas-confetti';

const formSchema = z.object({
    email: z.string().email('Please enter a valid email address'),
    name: z.string().optional(),
    subscriptionType: z.enum(['DIGEST_ONLY', 'ALL_UPDATES', 'MAJOR_ONLY']).default('ALL_UPDATES'),
});

type SubscriptionFormValues = z.infer<typeof formSchema>;

interface Update {
    title: string;
    date: string;
}

interface SubscriptionFormProps {
    projectId: string;
    projectName: string;
    recentUpdates?: Update[];
}

type Step = 'email' | 'name' | 'preferences' | 'success';

export default function SubscriptionForm({
                                             projectId,
                                         }: SubscriptionFormProps) {
    const [currentStep, setCurrentStep] = useState<Step>('email');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const successRef = useRef<HTMLDivElement>(null);

    // Detect if we're on a custom domain
    const getCustomDomain = (): string | null => {
        if (typeof window === 'undefined') return null;

        const hostname = window.location.hostname;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';

        try {
            const appDomain = new URL(appUrl).hostname;

            // Skip localhost and development domains
            if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
                return null;
            }

            // If hostname is different from app domain and not a subdomain, it's a custom domain
            if (hostname !== appDomain && !hostname.endsWith(`.${appDomain}`)) {
                return hostname;
            }
        } catch (error) {
            console.error('Error parsing app URL:', error);
        }

        return null;
    };

    const form = useForm<SubscriptionFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: '',
            name: '',
            subscriptionType: 'ALL_UPDATES',
        },
        mode: 'onChange',
    });

    const triggerConfetti = () => {
        // Get the position of the success message
        if (successRef.current) {
            const rect = successRef.current.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;

            // Convert to relative position (0-1)
            const xRelative = x / window.innerWidth;
            const yRelative = y / window.innerHeight;

            // Fire confetti from the success message position
            confetti({
                particleCount: 100,
                spread: 70,
                origin: {x: xRelative, y: yRelative},
                colors: ['#818cf8', '#c4b5fd', '#a78bfa', '#8b5cf6', '#7c3aed'],
                disableForReducedMotion: true,
            });
        } else {
            // Fallback to center if ref is not available
            confetti({
                particleCount: 100,
                spread: 70,
                origin: {x: 0.5, y: 0.4},
                colors: ['#818cf8', '#c4b5fd', '#a78bfa', '#8b5cf6', '#7c3aed'],
                disableForReducedMotion: true,
            });
        }
    };

    const onSubmit = async (values: SubscriptionFormValues) => {
        setIsSubmitting(true);
        setError(null);

        try {
            const customDomain = getCustomDomain();

            const response = await fetch('/api/changelog/subscribe', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    email: values.email,
                    name: values.name,
                    projectId: projectId,
                    subscriptionType: values.subscriptionType,
                    customDomain
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to subscribe');
            }

            setCurrentStep('success');
            // Trigger confetti after a short delay to allow the success animation to start
            setTimeout(triggerConfetti, 300);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to subscribe');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleNext = () => {
        if (currentStep === 'email') {
            const emailValue = form.getValues('email');
            const emailError = form.formState.errors.email;

            if (emailValue && !emailError) {
                setCurrentStep('name');
            } else {
                form.trigger('email');
            }
        } else if (currentStep === 'name') {
            setCurrentStep('preferences');
        }
    };

    const skipNameStep = () => {
        setCurrentStep('preferences');
    };

    const restartForm = () => {
        form.reset();
        setCurrentStep('email');
    };

    // Get the domain name for display
    const displayDomain = getCustomDomain();

    return (
        <div
            className={cn(
                "w-full max-w-md mx-auto mt-16 mb-8",
                "transition-all duration-300"
            )}
        >
            {/* More subtle and integrated notification section */}
            <div className="flex items-center justify-center gap-3 mb-8">
                <div className="h-px flex-1 bg-border/40"/>
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Bell className="h-4 w-4"/>
                    <span className="text-sm font-medium">
                        {displayDomain ? 'Get Updates' : 'Subscribe for Updates'}
                    </span>
                </div>
                <div className="h-px flex-1 bg-border/40"/>
            </div>

            {/* Show custom domain indicator if present */}
            {displayDomain && (
                <div className="text-center mb-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-sm">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="font-medium">{displayDomain}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        Subscribing to updates from this changelog
                    </p>
                </div>
            )}

            <div className="relative">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <AnimatePresence mode="wait">
                            {currentStep === 'email' && (
                                <motion.div
                                    key="email-step"
                                    initial={{opacity: 0, y: 10}}
                                    animate={{opacity: 1, y: 0}}
                                    exit={{opacity: 0, y: -10}}
                                    transition={{duration: 0.2}}
                                    className="space-y-3"
                                >
                                    {error && (
                                        <Alert variant="destructive" className="mb-3">
                                            <AlertCircle className="h-4 w-4"/>
                                            <AlertDescription>{error}</AlertDescription>
                                        </Alert>
                                    )}

                                    <FormField
                                        control={form.control}
                                        name="email"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Mail
                                                            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60"/>
                                                        <Input
                                                            placeholder="your@email.com"
                                                            className="pl-10 h-10 bg-background/50 border-border/50 placeholder:text-muted-foreground/50"
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') {
                                                                    e.preventDefault();
                                                                    handleNext();
                                                                }
                                                            }}
                                                            {...field}
                                                        />
                                                    </div>
                                                </FormControl>
                                                <FormMessage className="text-xs"/>
                                            </FormItem>
                                        )}
                                    />

                                    <Button
                                        type="button"
                                        onClick={handleNext}
                                        className="w-full h-10"
                                        variant="secondary"
                                    >
                                        Continue
                                        <ArrowRight className="ml-2 h-4 w-4"/>
                                    </Button>
                                </motion.div>
                            )}

                            {currentStep === 'name' && (
                                <motion.div
                                    key="name-step"
                                    initial={{opacity: 0, y: 10}}
                                    animate={{opacity: 1, y: 0}}
                                    exit={{opacity: 0, y: -10}}
                                    transition={{duration: 0.2}}
                                    className="space-y-3"
                                >
                                    <div className="text-center mb-4">
                                        <p className="text-sm text-muted-foreground">
                                            Add your name for personalized updates
                                        </p>
                                    </div>

                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormControl>
                                                    <Input
                                                        placeholder="Your name (optional)"
                                                        className="h-10 bg-background/50 border-border/50"
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleNext();
                                                            }
                                                        }}
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormMessage className="text-xs"/>
                                            </FormItem>
                                        )}
                                    />

                                    <div className="flex gap-2">
                                        <Button
                                            type="button"
                                            onClick={skipNameStep}
                                            variant="ghost"
                                            className="flex-1 h-10"
                                        >
                                            Skip
                                        </Button>
                                        <Button
                                            type="button"
                                            onClick={handleNext}
                                            variant="secondary"
                                            className="flex-1 h-10"
                                        >
                                            Continue
                                        </Button>
                                    </div>
                                </motion.div>
                            )}

                            {currentStep === 'preferences' && (
                                <motion.div
                                    key="preferences-step"
                                    initial={{opacity: 0, y: 10}}
                                    animate={{opacity: 1, y: 0}}
                                    exit={{opacity: 0, y: -10}}
                                    transition={{duration: 0.2}}
                                    className="space-y-3"
                                >
                                    <div className="text-center mb-4">
                                        <p className="text-sm text-muted-foreground">
                                            How often should we notify you?
                                        </p>
                                    </div>

                                    <FormField
                                        control={form.control}
                                        name="subscriptionType"
                                        render={({field}) => (
                                            <FormItem>
                                                <FormControl>
                                                    <div className="grid gap-2">
                                                        {[
                                                            {
                                                                value: 'ALL_UPDATES',
                                                                icon: Zap,
                                                                title: 'All Updates',
                                                                description: 'Every change'
                                                            },
                                                            {
                                                                value: 'MAJOR_ONLY',
                                                                icon: CheckCircle2,
                                                                title: 'Major Only',
                                                                description: 'Important updates'
                                                            },
                                                            {
                                                                value: 'DIGEST_ONLY',
                                                                icon: Clock,
                                                                title: 'Weekly Digest',
                                                                description: 'Weekly summary'
                                                            }
                                                        ].map((option) => (
                                                            <button
                                                                key={option.value}
                                                                type="button"
                                                                className={cn(
                                                                    "flex items-center p-3 rounded-md text-left transition-all text-sm",
                                                                    field.value === option.value
                                                                        ? "bg-muted/50 text-foreground"
                                                                        : "text-muted-foreground hover:bg-muted/30",
                                                                )}
                                                                onClick={() => field.onChange(option.value)}
                                                            >
                                                                <option.icon className={cn(
                                                                    "h-4 w-4 mr-3",
                                                                    field.value === option.value ? "text-primary" : "text-muted-foreground"
                                                                )}/>
                                                                <div className="flex-1">
                                                                    <p className="font-medium">{option.title}</p>
                                                                    <p className="text-xs">{option.description}</p>
                                                                </div>
                                                                {field.value === option.value && (
                                                                    <Check className="h-4 w-4 text-primary"/>
                                                                )}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </FormControl>
                                                <FormMessage className="text-xs"/>
                                            </FormItem>
                                        )}
                                    />

                                    <Button
                                        type="submit"
                                        className="w-full h-10"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <div
                                                    className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"/>
                                                Subscribing...
                                            </>
                                        ) : (
                                            'Subscribe'
                                        )}
                                    </Button>
                                </motion.div>
                            )}

                            {currentStep === 'success' && (
                                <motion.div
                                    key="success-step"
                                    ref={successRef}
                                    initial={{opacity: 0, scale: 0.95}}
                                    animate={{opacity: 1, scale: 1}}
                                    transition={{duration: 0.2}}
                                    className="text-center py-6"
                                >
                                    <motion.div
                                        initial={{scale: 0.8}}
                                        animate={{scale: 1}}
                                        transition={{type: "spring", stiffness: 200, damping: 15}}
                                        className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4"
                                    >
                                        <Check className="h-6 w-6 text-primary"/>
                                    </motion.div>

                                    <h3 className="text-lg font-medium mb-1">You&apos;re all set!</h3>
                                    <p className="text-sm text-muted-foreground mb-2">
                                        We&apos;ll notify you about updates.
                                    </p>

                                    {displayDomain && (
                                        <p className="text-xs text-muted-foreground mb-6">
                                            Unsubscribe links will redirect to <span className="font-medium">{displayDomain}</span>
                                        </p>
                                    )}

                                    <Button
                                        type="button"
                                        onClick={restartForm}
                                        variant="ghost"
                                        size="sm"
                                        className="text-muted-foreground"
                                    >
                                        Subscribe another email
                                    </Button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </form>
                </Form>
            </div>
        </div>
    );
}