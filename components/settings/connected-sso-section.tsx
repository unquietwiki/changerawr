// components/settings/ConnectedSsoProviders.tsx
import React from 'react';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {ProviderLogo} from '@/components/sso/ProviderLogo';
import {Alert, AlertDescription} from '@/components/ui/alert';
import {CheckCircle2, Clock, AlertTriangle, Shield} from 'lucide-react';
import {motion} from 'framer-motion';
import {useTimezone} from '@/hooks/use-timezone';

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

interface ConnectedSsoProvidersProps {
    connections: OAuthConnection[];
    allProviders: OAuthProvider[];
    isLoading?: boolean;
}

type ConnectionStatus = 'connected' | 'expired' | 'disabled';

const ConnectedSsoProviders: React.FC<ConnectedSsoProvidersProps> = ({
                                                                         connections,
                                                                         allProviders,
                                                                         isLoading = false
                                                                     }) => {
    const timezone = useTimezone();

    const getConnectionStatus = (connection: OAuthConnection): ConnectionStatus => {
        if (!connection.provider.enabled) {
            return 'disabled';
        }

        if (connection.expiresAt) {
            const expirationDate = new Date(connection.expiresAt);
            const now = new Date();
            if (expirationDate <= now) {
                return 'expired';
            }
        }

        return 'connected';
    };

    const getStatusIcon = (status: ConnectionStatus) => {
        switch (status) {
            case 'connected':
                return <CheckCircle2 className="h-4 w-4 text-green-600"/>;
            case 'expired':
                return <Clock className="h-4 w-4 text-orange-500"/>;
            case 'disabled':
                return <AlertTriangle className="h-4 w-4 text-red-500"/>;
        }
    };

    const getStatusBadge = (status: ConnectionStatus) => {
        switch (status) {
            case 'connected':
                return <Badge variant="secondary"
                              className="bg-green-50 text-green-700 hover:bg-green-100">Connected</Badge>;
            case 'expired':
                return <Badge variant="secondary"
                              className="bg-orange-50 text-orange-700 hover:bg-orange-100">Expired</Badge>;
            case 'disabled':
                return <Badge variant="destructive">Provider Disabled</Badge>;
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            timeZone: timezone,
        });
    };

    const formatRelativeTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInMs = now.getTime() - date.getTime();
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

        if (diffInDays === 0) return 'Today';
        if (diffInDays === 1) return 'Yesterday';
        if (diffInDays < 30) return `${diffInDays} days ago`;
        if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
        return `${Math.floor(diffInDays / 365)} years ago`;
    };

    // Group connections and include removed providers
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const connectedProviderIds = new Set(connections.map(conn => conn.providerId));
    const removedProviders = connections.filter(conn =>
        !allProviders.some(provider => provider.id === conn.providerId)
    );

    if (isLoading) {
        return (
            <Card className="border shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg md:text-xl flex items-center">
                        <Shield className="h-5 w-5 mr-2 text-muted-foreground"/>
                        Connected SSO Providers
                    </CardTitle>
                    <CardDescription className="text-sm">
                        Manage your single sign-on connections
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-center py-8">
                        <div className="animate-pulse text-sm text-muted-foreground">Loading your connections...</div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border shadow-sm">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg md:text-xl flex items-center">
                    <Shield className="h-5 w-5 mr-2 text-muted-foreground"/>
                    Connected SSO Providers
                </CardTitle>
                <CardDescription className="text-sm">
                    View your single sign-on connections. These providers allow you to log in without entering a
                    password.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {connections.length === 0 ? (
                    <Alert>
                        <AlertDescription className="text-sm">
                            You haven&apos;t connected any SSO providers yet. You can still log in using your email and
                            password.
                        </AlertDescription>
                    </Alert>
                ) : (
                    <>
                        {/* Active Connections */}
                        <div className="space-y-3">
                            {connections
                                .filter(conn => allProviders.some(provider => provider.id === conn.providerId))
                                .map((connection, index) => {
                                    const status = getConnectionStatus(connection);
                                    return (
                                        <motion.div
                                            key={connection.id}
                                            initial={{opacity: 0, y: 20}}
                                            animate={{opacity: 1, y: 0}}
                                            transition={{duration: 0.2, delay: index * 0.1}}
                                            className="flex items-center justify-between p-4 border rounded-lg bg-card/50 hover:bg-card transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <ProviderLogo
                                                    providerName={connection.provider.name}
                                                    size="md"
                                                />
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-medium text-sm md:text-base">{connection.provider.name}</h4>
                                                        {connection.provider.isDefault && (
                                                            <Badge variant="outline" className="text-xs">Default</Badge>
                                                        )}
                                                    </div>
                                                    <p className="text-xs md:text-sm text-muted-foreground">
                                                        Connected {formatRelativeTime(connection.createdAt)}
                                                        {connection.expiresAt && status === 'connected' && (
                                                            <span> • Expires {formatDate(connection.expiresAt)}</span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {getStatusIcon(status)}
                                                {getStatusBadge(status)}
                                            </div>
                                        </motion.div>
                                    );
                                })
                            }
                        </div>

                        {/* Removed Provider Warning */}
                        {removedProviders.length > 0 && (
                            <motion.div
                                initial={{opacity: 0, height: 0}}
                                animate={{opacity: 1, height: 'auto'}}
                                transition={{duration: 0.3}}
                            >
                                <Alert className="border-orange-200 bg-orange-50/50">
                                    <AlertTriangle className="h-4 w-4 text-orange-600"/>
                                    <AlertDescription className="text-orange-800">
                                        <div className="font-medium mb-2 text-sm">Some connected providers are no longer
                                            available:
                                        </div>
                                        <div className="space-y-2">
                                            {removedProviders.map((connection) => (
                                                <div key={connection.id}
                                                     className="flex items-center gap-2 text-xs md:text-sm">
                                                    <div
                                                        className="w-6 h-6 rounded-md bg-orange-200 flex items-center justify-center">
                            <span className="text-xs font-semibold text-orange-800">
                              {connection.provider.name.substring(0, 2).toUpperCase()}
                            </span>
                                                    </div>
                                                    <span>{connection.provider.name}</span>
                                                    <span
                                                        className="text-orange-600">• Connected {formatRelativeTime(connection.createdAt)}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="mt-2 text-xs md:text-sm">
                                            These connections are preserved in case the providers are re-enabled. You
                                            can still log in using other methods.
                                        </p>
                                    </AlertDescription>
                                </Alert>
                            </motion.div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
};

export default ConnectedSsoProviders;