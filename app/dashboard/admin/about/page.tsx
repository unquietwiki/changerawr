'use client'

import React, {useEffect, useState} from 'react';
import {Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle} from '@/components/ui/card';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {appInfo, getCopyrightYears} from '@/lib/app-info';
import {Heart, History, Zap, Activity} from 'lucide-react';
import UpdateStatus from '@/components/UpdateStatus';
import {useWhatsNew} from '@/hooks/useWhatsNew';
import WhatsNewModal from '@/components/dashboard/WhatsNewModal';
import DinoGame from '@/components/DinoGame';
import {UpdateStatus as UpdateStatusType} from '@/lib/types/easypanel';
import {useTimezone} from '@/hooks/use-timezone';

export default function AboutPage() {
    const [databaseInfo, setDatabaseInfo] = useState<{ databaseVersion?: string }>({});
    const [updateStatus, setUpdateStatus] = useState<UpdateStatusType | null>(null);
    const [showDinoGame, setShowDinoGame] = useState(false);
    const [rawrClickCount, setRawrClickCount] = useState(0);
    const [licenseActive, setLicenseActive] = useState(false);
    const [sslEnabled, setSslEnabled] = useState(false);
    const [agentVersion, setAgentVersion] = useState<{ version?: string; status?: string } | null>(null);
    const timezone = useTimezone();

    const {
        showWhatsNew,
        whatsNewContent,
        closeWhatsNew,
        manuallyShowWhatsNew,
        isLoading,
    } = useWhatsNew();

    const handleRawrClick = () => {
        setRawrClickCount(prev => {
            const newCount = prev + 1;
            if (newCount >= 5) {
                setShowDinoGame(true);
                return 0; // Reset counter
            }
            return newCount;
        });
    };

    useEffect(() => {
        async function fetchSystemInfo() {
            try {
                // Fetch runtime config
                const configResponse = await fetch('/api/config/runtime');
                const configData = await configResponse.json();
                setSslEnabled(configData.sslEnabled);

                // Fetch database info
                const versionResponse = await fetch('/api/system/version');
                const versionData = await versionResponse.json();
                setDatabaseInfo(versionData);

                // Fetch update status (includes Easypanel info)
                const updateResponse = await fetch('/api/system/update-status');
                if (updateResponse.ok) {
                    const updateData = await updateResponse.json();
                    setUpdateStatus(updateData);
                }

                // Fetch license status
                try {
                    const licenseResponse = await fetch('/api/admin/sponsor');
                    if (licenseResponse.ok) {
                        const licenseData = await licenseResponse.json();
                        setLicenseActive(licenseData.active === true);
                    }
                } catch {}

                // Fetch nginx-agent version if SSL is enabled
                if (configData.sslEnabled) {
                    try {
                        const agentResponse = await fetch('/api/system/agent-version');
                        if (agentResponse.ok) {
                            const agentData = await agentResponse.json();
                            setAgentVersion(agentData);
                        }
                    } catch {}
                }
            } catch (error) {
                console.error('Failed to fetch system info:', error);
            }
        }

        fetchSystemInfo();
    }, []);

    return (
        <div className="max-w-lg mx-auto space-y-6 py-6">
            {/* What's New Modal */}
            {whatsNewContent && (
                <WhatsNewModal
                    isOpen={showWhatsNew}
                    onClose={closeWhatsNew}
                    content={whatsNewContent}
                />
            )}

            {/* Dino Game Modal */}
            <DinoGame
                isOpen={showDinoGame}
                onClose={() => setShowDinoGame(false)}
            />

            <Card className="border-2 overflow-hidden">
                <CardHeader className="text-center pb-2">
                    <div className="flex justify-center mb-4">
                        <div className="w-24 h-24 rounded-full flex items-center justify-center bg-primary/10">
                            <span className="text-4xl font-bold">🦖</span>
                        </div>
                    </div>
                    <CardTitle className="text-3xl font-bold">Changerawr</CardTitle>
                    <CardDescription>Ship, Change, Rawr 🦖</CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                    <div className="flex justify-center gap-2 mb-4">
                        <Badge variant="outline" className="px-3 py-1">v{appInfo.version}</Badge>
                        <Badge variant="secondary" className="px-3 py-1">{appInfo.status}</Badge>
                        {updateStatus?.easypanelConfigured && (
                            <Badge variant="default" className="px-3 py-1 bg-blue-600 hover:bg-blue-700">
                                <Zap className="h-3 w-3 mr-1"/>
                                Easypanel
                            </Badge>
                        )}
                    </div>

                    {/* What's New Button */}
                    <Button
                        onClick={manuallyShowWhatsNew}
                        variant="outline"
                        size="sm"
                        className="mb-4"
                        disabled={isLoading}
                    >
                        <History className="h-4 w-4 mr-2"/>
                        {isLoading ? "Loading..." : "What's New in This Version"}
                    </Button>

                    {/* Update Status Component */}
                    <div className="pt-2">
                        <UpdateStatus
                            currentVersion={appInfo.version}
                            checkOnMount={true}
                            autoCheckInterval={60 * 60 * 1000} // Check every hour - pretty useless unless you left the page open
                            showEasypanelInfo={false} // We handle this above
                        />
                    </div>

                    <div className="max-w-xs mx-auto mt-4">
                        <p className="text-sm text-muted-foreground">
                            Making changelog management cute and simple since 2025!
                            Keep your users updated with adorable, organized release notes. ✨
                        </p>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col items-center pt-2 pb-6">
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        Made with <Heart className="h-4 w-4 text-red-500 fill-red-500"/> by <a
                        href="https://superdev.one" className="hover:underline">Supernova3339</a>
                    </p>
                    <p className="text-xs text-muted-foreground">© {getCopyrightYears()} {appInfo.name} • All rights
                        reserved</p>
                </CardFooter>
            </Card>

            {/* System Information */}
            <Card className="border overflow-hidden">
                <CardHeader>
                    <CardTitle className="text-lg font-medium">🛠️ System Information</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between py-1 border-b border-border/40">
                            <span>Application</span>
                            <span>{appInfo.name}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/40">
                            <span>Version</span>
                            <span>{appInfo.version} ({appInfo.status})</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/40">
                            <span>Framework</span>
                            <span>{appInfo.framework}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/40">
                            <span>Database</span>
                            <span>PostgreSQL {databaseInfo?.databaseVersion || 'Unknown'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/40">
                            <span>CUM Engine</span>
                            <span>v{appInfo.cumEngine}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/40">
                            <span>Environment</span>
                            <span>{appInfo.environment}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-border/40">
                            <span>Released</span>
                            <span>{new Date(appInfo.releaseDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: timezone })}</span>
                        </div>
                        {sslEnabled && agentVersion && (
                            <div className="flex justify-between py-1 border-b border-border/40">
                                <span>nginx-agent</span>
                                <span className="flex items-center gap-1">
                                    {agentVersion.version || 'Unknown'}
                                    {agentVersion.status === 'live' && (
                                        <Activity className="h-3 w-3 text-green-500"/>
                                    )}
                                </span>
                            </div>
                        )}
                        {updateStatus?.easypanelConfigured && (
                            <>
                                <div className="flex justify-between py-1 border-b border-border/40">
                                    <span>Deployment</span>
                                    <span className="flex items-center gap-1">
                                        <Activity className="h-3 w-3 text-green-500"/>
                                        Auto-managed
                                    </span>
                                </div>
                                <div className="flex justify-between py-1">
                                    <span>Updates</span>
                                    <span className="text-blue-600">Automatic</span>
                                </div>
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Sponsor Thank You */}
            {licenseActive && (
                <Card className="border-2 border-pink-200 dark:border-pink-800 bg-gradient-to-br from-pink-50/50 to-purple-50/50 dark:from-pink-950/20 dark:to-purple-950/20 overflow-hidden">
                    <CardContent className="pt-6 text-center">
                        <div className="flex justify-center mb-3">
                            <Heart className="h-8 w-8 text-pink-500 fill-pink-500"/>
                        </div>
                        <h3 className="text-lg font-semibold mb-1">Thank You for Sponsoring!</h3>
                        <p className="text-sm text-muted-foreground">
                            Your support helps keep Changerawr alive and growing.
                            Extended features are unlocked for this instance.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Easter egg - Secret Dino Game */}
            <div className="text-center text-xs text-muted-foreground pt-2">
                <span
                    className="cursor-pointer hover:text-primary transition-colors select-none"
                    onClick={handleRawrClick}
                    title={rawrClickCount > 0 ? `${5 - rawrClickCount} more clicks...` : 'Click me!'}
                >
                    rawr~ ʕ•ᴥ•ʔ
                </span>
                {rawrClickCount > 0 && rawrClickCount < 5 && (
                    <div className="mt-1 text-[10px] opacity-50">
                        {5 - rawrClickCount} more...
                    </div>
                )}
            </div>
        </div>
    );
}