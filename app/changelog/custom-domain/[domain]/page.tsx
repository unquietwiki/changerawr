// noinspection HtmlUnknownTarget

import {Suspense} from 'react';
import {notFound} from 'next/navigation';
import ChangelogEntries from '@/components/changelog/ChangelogEntries';
import ShareButton from '@/components/changelog/ShareButton';
import {Skeleton} from '@/components/ui/skeleton';
import {GitBranch, Clock, Rss} from 'lucide-react';
import {cn} from '@/lib/utils';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from '@/components/ui/tooltip';
import Link from 'next/link';
import {Metadata} from 'next';
import SubscriptionForm from "@/components/subscription-form";
import {trackChangelogView} from "@/lib/middleware/analytics";
import {headers} from "next/headers";
import {getDomainByDomain} from '@/lib/custom-domains/service';

interface ChangelogResponse {
    project: {
        id: string;
        name: string;
        description?: string;
        emailNotificationsEnabled?: boolean;
    };
    items: Array<{
        id: string;
        publishedAt: string;
        title?: string;
    }>;
    nextCursor?: string;
}

type CustomDomainPageProps = {
    params: Promise<{
        domain: string;
        path?: string[];
    }>;
};

async function getInitialData(projectId: string): Promise<ChangelogResponse | null> {
    const res = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/changelog/${projectId}/entries`,
        {next: {revalidate: 300}}
    );

    if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error('Failed to fetch changelog');
    }

    return res.json();
}

export async function generateMetadata(
    {params}: CustomDomainPageProps
): Promise<Metadata> {
    const {domain: encodedDomain} = await params;
    const domain = decodeURIComponent(encodedDomain);

    const domainConfig = await getDomainByDomain(domain);

    if (!domainConfig) {
        return {
            title: 'Domain Not Found',
            description: 'The requested domain configuration was not found.'
        };
    }

    if (!domainConfig.verified) {
        return {
            title: `${domain} - Verification Required`,
            description: 'Domain verification is required to access this changelog.'
        };
    }

    const data = await getInitialData(domainConfig.projectId);

    if (!data) {
        return {
            title: 'Changelog Not Found',
            description: 'The requested changelog could not be found.'
        };
    }

    const {project, items} = data;
    const latestUpdate = items[0]?.publishedAt
        ? new Date(items[0].publishedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
        : null;

    return {
        title: `${project.name} Changelog & Release Notes`,
        description: project.description ||
            `View the latest updates and changes for ${project.name}${latestUpdate ? ` - last updated ${latestUpdate}` : ''}.`,
        openGraph: {
            title: `${project.name} Changelog`,
            description: project.description ||
                `Stay up to date with the latest improvements, features, and bug fixes for ${project.name}.`,
            type: 'website',
            url: `https://${domain}`,
        },
        alternates: {
            canonical: `https://${domain}`,
            types: {
                'application/rss+xml': `https://${domain}/rss.xml`,
            },
        },
    };
}

// Loading component for Suspense
function ChangelogSkeleton() {
    return (
        <div className="space-y-12">
            {[...Array(3)].map((_, i) => (
                <div key={i} className="space-y-4 animate-pulse">
                    <div className="space-y-3">
                        <Skeleton className="h-8 w-[300px]"/>
                        <Skeleton className="h-5 w-[200px]"/>
                    </div>
                    <Skeleton className="h-48 w-full rounded-lg"/>
                    <div className="flex gap-2 pt-4">
                        <Skeleton className="h-6 w-16 rounded-full"/>
                        <Skeleton className="h-6 w-16 rounded-full"/>
                        <Skeleton className="h-6 w-16 rounded-full"/>
                    </div>
                </div>
            ))}
        </div>
    );
}

// Domain verification page component
function DomainVerificationPage({domain}: { domain: string }) {
    return (
        <div className="min-h-[calc(100vh-4rem)] bg-background flex items-center justify-center px-4">
            <div className="max-w-2xl w-full mx-auto">
                <div className="text-center">
                    {/* Large warning icon */}
                    <div className="w-24 h-24 mx-auto mb-8">
                        <svg className="w-full h-full text-red-600" fill="none" stroke="currentColor"
                             viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"/>
                        </svg>
                    </div>

                    {/* Main heading */}
                    <h1 className="text-4xl font-normal text-foreground mb-6">
                        Domain verification required
                    </h1>

                    {/* URL with proper handling for long domains */}
                    <div className="bg-muted rounded-lg p-4 mb-8 border-l-4 border-red-600">
                        <p className="text-muted-foreground text-sm mb-2 uppercase tracking-wide font-medium">
                            DOMAIN
                        </p>
                        <p className="text-foreground font-mono text-lg break-all leading-relaxed">
                            {domain}
                        </p>
                    </div>

                    {/* Error message */}
                    <div
                        className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 mb-8">
                        <h2 className="text-lg font-semibold text-red-800 dark:text-red-200 mb-3">
                            DNS verification pending
                        </h2>
                        <p className="text-red-700 dark:text-red-300 text-sm">
                            This domain is configured but has not completed the verification process.
                            DNS records must be validated before content can be served.
                        </p>
                    </div>

                    {/* Technical details */}
                    <div className="text-left bg-muted rounded-lg p-6 mb-8">
                        <h3 className="font-semibold text-foreground mb-4">Technical Details</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex">
                                <span className="text-muted-foreground w-24 flex-shrink-0">Status:</span>
                                <span className="text-foreground">Unverified</span>
                            </div>
                            <div className="flex">
                                <span className="text-muted-foreground w-24 flex-shrink-0">Error:</span>
                                <span
                                    className="text-foreground font-mono">DNS_VERIFICATION_REQUIRED</span>
                            </div>
                            <div className="flex">
                                <span className="text-muted-foreground w-24 flex-shrink-0">Code:</span>
                                <span className="text-foreground font-mono">ERR_DOMAIN_NOT_VERIFIED</span>
                            </div>
                        </div>
                    </div>

                    {/* Footer note */}
                    <p className="text-xs text-muted-foreground mt-8">
                        Contact your system administrator if you believe this is an error
                    </p>
                </div>
            </div>
        </div>
    );
}

export default async function CustomDomainPage({params}: CustomDomainPageProps) {
    const {domain: encodedDomain, path} = await params;
    const domain = decodeURIComponent(encodedDomain);
    const pathSegments = path || [];

    // Look up the domain configuration
    const domainConfig = await getDomainByDomain(domain);

    if (!domainConfig) {
        notFound();
    }

    // If domain is not verified, show verification instructions
    if (!domainConfig.verified) {
        return <DomainVerificationPage domain={domain}/>;
    }

    // Get the project data using the domain's project ID
    const projectId = domainConfig.projectId;
    const data = await getInitialData(projectId);

    if (!data) {
        notFound();
    }

    // Track the changelog view asynchronously (don't block rendering)
    try {
        const headersList = await headers();
        const request = new Request(`https://${domain}`, {
            headers: headersList
        });

        // Track the main changelog page view
        await trackChangelogView(request, {
            projectId: data.project.id,
            // No specific entry ID for main page view
        });
    } catch (error) {
        // Don't let analytics tracking errors break the page
        console.error('Failed to track changelog view:', error);
    }

    const stats = {
        totalEntries: data.items.length + (data.nextCursor ? '+' : ''),
        lastUpdate: data.items[0]?.publishedAt,
    };

    // Generate current page URL for sharing (use custom domain)
    const pageUrl = `https://${domain}${pathSegments.length > 0 ? `/${pathSegments.join('/')}` : ''}`;

    return (
        <div className="min-h-screen bg-background">
            {/* Gradient background */}
            <div className="absolute top-0 inset-x-0 h-96 overflow-hidden pointer-events-none">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent"/>
                <div
                    className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(var(--primary-rgb),0.1),transparent)]"/>
            </div>

            <div className="relative pb-24">
                <header className="relative py-16 md:py-24 px-4 max-w-6xl mx-auto">
                    <div className="text-center space-y-6">
                        {/* Project name */}
                        <h1
                            className={cn(
                                "text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight",
                                "bg-gradient-to-b from-foreground via-foreground/95 to-foreground/80",
                                "bg-clip-text text-transparent"
                            )}
                        >
                            {data.project.name}
                        </h1>

                        {/* Subtitle */}
                        <p className="text-xl md:text-2xl text-muted-foreground font-medium">
                            Changelog &amp; Release Notes
                        </p>

                        {/* Description if available */}
                        {data.project.description && (
                            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                                {data.project.description}
                            </p>
                        )}

                        {/* Stats display with RSS and share links */}
                        <div className="flex flex-col items-center gap-6">
                            <div className="inline-flex flex-wrap justify-center items-center gap-4 md:gap-8 px-6 md:px-8 py-4
                            bg-background/60 backdrop-blur-sm
                            border border-border/40
                            rounded-full
                            hover:bg-background/80 hover:border-border/60
                            transition-all duration-300">
                                <div className="flex items-center gap-3">
                                    <GitBranch className="w-5 h-5 text-muted-foreground"/>
                                    <span className="font-medium text-lg">
                                        {stats.totalEntries} Updates
                                    </span>
                                </div>

                                {stats.lastUpdate && (
                                    <>
                                        <div className="hidden md:block w-1.5 h-1.5 rounded-full bg-border"/>
                                        <div className="flex items-center gap-3">
                                            <Clock className="w-5 h-5 text-muted-foreground"/>
                                            <time
                                                dateTime={stats.lastUpdate}
                                                className="font-medium text-lg tabular-nums"
                                            >
                                                {new Intl.DateTimeFormat('en-US', {
                                                    month: 'long',
                                                    day: 'numeric',
                                                    year: 'numeric',
                                                }).format(new Date(stats.lastUpdate))}
                                            </time>
                                        </div>
                                    </>
                                )}

                                <div className="hidden md:block w-1.5 h-1.5 rounded-full bg-border"/>

                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Link
                                                href="/rss.xml"
                                                className="flex items-center gap-2 text-muted-foreground hover:text-orange-500 transition-colors duration-200"
                                                aria-label="Subscribe to RSS feed"
                                            >
                                                <Rss className="w-5 h-5"/>
                                                <span className="font-medium text-lg">RSS</span>
                                            </Link>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            Subscribe to updates via RSS
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>

                                <div className="hidden md:block w-1.5 h-1.5 rounded-full bg-border"/>

                                {/* Client-side Share Button */}
                                <ShareButton
                                    url={pageUrl}
                                    title={`${data.project.name} Changelog`}
                                    text={data.project.description || `Check out the latest updates for ${data.project.name}`}
                                />
                            </div>
                        </div>
                        {/* Only show subscription form if email notifications are enabled */}
                        {data.project.emailNotificationsEnabled && (
                            <SubscriptionForm projectId={projectId} projectName={data.project.name}/>
                        )}
                    </div>
                </header>

                <div className="relative max-w-7xl mx-auto px-4 md:px-6">
                    <Suspense fallback={<ChangelogSkeleton/>}>
                        <ChangelogEntries projectId={projectId}/>
                    </Suspense>
                </div>

                {/* Footer spacer */}
                <div className="h-12"/>
            </div>
        </div>
    );
}