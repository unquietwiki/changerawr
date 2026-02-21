'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle
} from '@/components/ui/card';
import {
    startRegistration,
    browserSupportsWebAuthn,
} from '@simplewebauthn/browser';
import { toast } from '@/hooks/use-toast';
import {
    Fingerprint,
    Trash2,
    Loader2,
    Smartphone,
    Key,
    Shield,
    Plus,
    Check,
    AlertCircle,
    Lock,
    Laptop,
    TabletSmartphone,
    Info
} from 'lucide-react';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";
import { useTimezone } from '@/hooks/use-timezone';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface Passkey {
    id: string;
    name: string;
    createdAt: string;
    lastUsedAt: string | null;
}

// Helper function to get device icon
const getDeviceIcon = (name: string) => {
    const lowercaseName = name.toLowerCase();
    if (lowercaseName.includes('iphone') || lowercaseName.includes('android') || lowercaseName.includes('phone')) {
        return <Smartphone className="h-4 w-4" />;
    } else if (lowercaseName.includes('ipad') || lowercaseName.includes('tablet')) {
        return <TabletSmartphone className="h-4 w-4" />;
    } else {
        return <Laptop className="h-4 w-4" />;
    }
};

// Helper function to format date
const formatDate = (dateString: string, timeZone = 'UTC') => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
        return 'Today';
    } else if (days === 1) {
        return 'Yesterday';
    } else if (days < 7) {
        return `${days} days ago`;
    } else {
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            timeZone,
        });
    }
};

export function PasskeysSection() {
    const timezone = useTimezone();
    const [passkeys, setPasskeys] = useState<Passkey[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [newPasskeyName, setNewPasskeyName] = useState('');
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [supportsWebAuthn, setSupportsWebAuthn] = useState(false);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [showInfoDialog, setShowInfoDialog] = useState(false);

    useEffect(() => {
        setSupportsWebAuthn(browserSupportsWebAuthn());
        fetchPasskeys();
    }, []);

    const fetchPasskeys = async () => {
        try {
            const response = await fetch('/api/auth/passkeys');
            if (!response.ok) throw new Error('Failed to fetch passkeys');

            const data = await response.json();
            setPasskeys(data.passkeys);
        } catch {
            toast({
                title: 'Error',
                description: 'Failed to load passkeys',
                variant: 'destructive',
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddPasskey = async () => {
        if (!newPasskeyName.trim()) {
            toast({
                title: 'Error',
                description: 'Please enter a name for your passkey',
                variant: 'destructive',
            });
            return;
        }

        try {
            setIsAdding(true);

            // Get registration options
            const optionsResponse = await fetch('/api/auth/passkeys/register/options', {
                method: 'POST',
            });

            if (!optionsResponse.ok) {
                throw new Error('Failed to get registration options');
            }

            const options = await optionsResponse.json();

            // Start WebAuthn registration
            const registrationResponse = await startRegistration(options);

            // Verify with server
            const verifyResponse = await fetch('/api/auth/passkeys/register/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    response: registrationResponse,
                    name: newPasskeyName,
                }),
            });

            if (!verifyResponse.ok) {
                throw new Error('Failed to register passkey');
            }

            toast({
                title: 'Success',
                description: 'Passkey added successfully',
            });

            setNewPasskeyName('');
            setShowAddDialog(false);
            fetchPasskeys();
        } catch (error) {
            console.error('Passkey registration error:', error);
            toast({
                title: 'Error',
                description: 'Failed to add passkey. Make sure your device supports passkeys.',
                variant: 'destructive',
            });
        } finally {
            setIsAdding(false);
        }
    };

    const handleDeletePasskey = async (id: string) => {
        try {
            const response = await fetch(`/api/auth/passkeys/${id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Failed to delete passkey');
            }

            toast({
                title: 'Success',
                description: 'Passkey deleted successfully',
            });

            fetchPasskeys();
        } catch {
            toast({
                title: 'Error',
                description: 'Failed to delete passkey',
                variant: 'destructive',
            });
        } finally {
            setDeleteId(null);
        }
    };

    if (!supportsWebAuthn) {
        return (
            <Card className="border-warning">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-warning" />
                        <CardTitle>Passkeys Not Supported</CardTitle>
                    </div>
                    <CardDescription>
                        Your browser doesn&apos;t support passkeys. Please use a modern browser to enable this security feature.
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5 text-primary" />
                                Passkeys
                            </CardTitle>
                            <CardDescription>
                                Secure, passwordless authentication for your account
                            </CardDescription>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="gap-2"
                            onClick={() => setShowInfoDialog(true)}
                        >
                            <Info className="h-4 w-4" />
                            Learn More
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : passkeys.length === 0 ? (
                        <div className="text-center py-8">
                            <div className="mx-auto w-fit rounded-full bg-primary/10 p-4 mb-4">
                                <Key className="h-8 w-8 text-primary" />
                            </div>
                            <h3 className="font-semibold text-lg mb-2">No passkeys yet</h3>
                            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                                Add a passkey to enable secure, passwordless authentication for your account.
                            </p>
                            <Button onClick={() => setShowAddDialog(true)} className="gap-2">
                                <Plus className="h-4 w-4" />
                                Add your first passkey
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <Badge variant="secondary" className="gap-1">
                                        <Check className="h-3 w-3" />
                                        {passkeys.length} Active
                                    </Badge>
                                </div>
                                <Button onClick={() => setShowAddDialog(true)} className="gap-2">
                                    <Plus className="h-4 w-4" />
                                    Add Passkey
                                </Button>
                            </div>

                            <Separator />

                            <AnimatePresence initial={false}>
                                <div className="space-y-3">
                                    {passkeys.map((passkey, index) => (
                                        <motion.div
                                            key={passkey.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -20 }}
                                            transition={{ duration: 0.2, delay: index * 0.05 }}
                                        >
                                            <div className="flex items-center gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                                                <div className="flex-shrink-0">
                                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                        {getDeviceIcon(passkey.name)}
                                                    </div>
                                                </div>
                                                <div className="flex-grow min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-medium truncate">{passkey.name}</h4>
                                                        {!passkey.lastUsedAt && (
                                                            <Badge variant="outline" className="text-xs">
                                                                Never used
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                        <span>Added {formatDate(passkey.createdAt, timezone)}</span>
                                                        {passkey.lastUsedAt && (
                                                            <>
                                                                <span>•</span>
                                                                <span>Last used {formatDate(passkey.lastUsedAt, timezone)}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex-shrink-0">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="text-destructive hover:text-destructive"
                                                                    onClick={() => setDeleteId(passkey.id)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>Delete passkey</TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </AnimatePresence>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Add Passkey Dialog */}
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add a Passkey</DialogTitle>
                        <DialogDescription>
                            Give your passkey a name to help you identify it later.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label htmlFor="passkey-name" className="text-sm font-medium">
                                Passkey Name
                            </label>
                            <Input
                                id="passkey-name"
                                placeholder="e.g., MacBook Pro, iPhone 15"
                                value={newPasskeyName}
                                onChange={(e) => setNewPasskeyName(e.target.value)}
                                disabled={isAdding}
                            />
                            <p className="text-sm text-muted-foreground">
                                Choose a name that helps you identify this device or browser.
                            </p>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3">
                        <Button
                            variant="outline"
                            onClick={() => setShowAddDialog(false)}
                            disabled={isAdding}
                        >
                            Cancel
                        </Button>
                        <Button onClick={handleAddPasskey} disabled={isAdding}>
                            {isAdding ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Adding...
                                </>
                            ) : (
                                <>
                                    <Fingerprint className="mr-2 h-4 w-4" />
                                    Add Passkey
                                </>
                            )}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Learn More Dialog */}
            <Dialog open={showInfoDialog} onOpenChange={setShowInfoDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>About Passkeys</DialogTitle>
                        <DialogDescription>
                            Learn how passkeys can make your account more secure
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Shield className="h-4 w-4 text-primary" />
                                        Enhanced Security
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="text-sm text-muted-foreground">
                                    Passkeys are resistant to phishing and use strong cryptographic security, making them more secure than passwords.
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Fingerprint className="h-4 w-4 text-primary" />
                                        Easy to Use
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="text-sm text-muted-foreground">
                                    Sign in with just your fingerprint, face, or device PIN. No need to remember complex passwords.
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Key className="h-4 w-4 text-primary" />
                                        Device Specific
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="text-sm text-muted-foreground">
                                    Each passkey is tied to a specific device or browser, providing an extra layer of security.
                                </CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Lock className="h-4 w-4 text-primary" />
                                        No Shared Secrets
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="text-sm text-muted-foreground">
                                    Your private key never leaves your device, eliminating the risk of server-side breaches.
                                </CardContent>
                            </Card>
                        </div>
                        <Separator />
                        <div>
                            <h4 className="font-medium mb-2">Supported Devices</h4>
                            <p className="text-sm text-muted-foreground">
                                Passkeys work on most modern devices and browsers, including:
                            </p>
                            <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
                                <li>iPhones and iPads (iOS 16+)</li>
                                <li>Android phones and tablets (Android 9+)</li>
                                <li>Windows computers with Windows Hello</li>
                                <li>Macs with Touch ID or macOS Ventura+</li>
                                <li>Chrome, Safari, Edge, and Firefox browsers</li>
                            </ul>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Passkey</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete this passkey? You won&apos;t be able to use it to sign in anymore.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteId && handleDeletePasskey(deleteId)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}