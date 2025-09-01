// app/dashboard/projects/[projectId]/page.tsx

'use client';

import {use} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {motion} from 'framer-motion';
import Link from 'next/link';
import {
    ArrowRight,
    BarChart3,
    Calendar,
    CheckCircle2,
    Clock,
    Code,
    ExternalLink,
    FileText,
    Globe,
    Mail,
    Plus,
    Settings,
    TrendingUp,
    Upload,
    Users,
} from 'lucide-react';

import {SiGithub} from '@icons-pack/react-simple-icons';

import {
    Avatar,
    AvatarFallback
} from '@/components/ui/avatar';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {
    Card,
    CardContent,
} from '@/components/ui/card';
import {Separator} from '@/components/ui/separator';
import {useToast} from '@/hooks/use-toast';

import {EmptyStateWithImport} from '@/components/projects/importing/ImportDataPrompt';
import {ImportResult} from '@/lib/types/projects/importing';
import {CatchUpView} from '@/components/project/catch-up/CatchUpView';

interface Project {
    id: string;
    name: string;
    isPublic: boolean;
    allowAutoPublish: boolean;
    requireApproval: boolean;
    defaultTags: string[];
    changelog?: {
        id: string;
        entries: Array<{
            id: string;
            title: string;
            version?: string;
            publishedAt?: string;
            createdAt: string;
            tags: Array<{ id: string; name: string; color?: string }>;
        }>;
    };
    createdAt: string;
    updatedAt: string;
}

interface User {
    id: string;
    role: 'ADMIN' | 'STAFF' | 'VIEWER';
}

interface ProjectPageProps {
    params: Promise<{ projectId: string }>;
}

const fadeIn = {
    initial: {opacity: 0, y: 20},
    animate: {opacity: 1, y: 0},
    transition: {duration: 0.5}
};

const staggerChildren = {
    animate: {
        transition: {
            staggerChildren: 0.1
        }
    }
};

interface QuickStatsCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ElementType;
    trend?: {
        value: number;
        direction: 'up' | 'down';
    };
    color?: string;
}

function QuickStatsCard({
                            title,
                            value,
                            subtitle,
                            icon: Icon,
                            trend,
                            color = "text-primary"
                        }: QuickStatsCardProps) {
    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">{title}</p>
                        <div>
                            <p className="text-2xl font-bold">{value}</p>
                            {subtitle && (
                                <p className="text-xs text-muted-foreground">{subtitle}</p>
                            )}
                        </div>
                        {trend && (
                            <div className="flex items-center text-xs">
                                <TrendingUp className={`h-3 w-3 mr-1 ${
                                    trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
                                }`}/>
                                <span className={trend.direction === 'up' ? 'text-green-600' : 'text-red-600'}>
                  {trend.value}% from last month
                </span>
                            </div>
                        )}
                    </div>
                    <div className={`p-3 rounded-full bg-muted/50`}>
                        <Icon className={`h-6 w-6 ${color}`}/>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

interface ActionCardProps {
    title: string;
    description: string;
    icon: React.ElementType;
    href?: string;
    onClick?: () => void;
    enabled?: boolean;
    color?: string;
    badge?: string;
    external?: boolean;
}

function ActionCard({
                        title,
                        description,
                        icon: Icon,
                        href,
                        onClick,
                        enabled = true,
                        color = "text-primary",
                        badge,
                        external = false
                    }: ActionCardProps) {
    const content = (
        <Card className={`transition-all duration-200 ${
            enabled ? 'hover:shadow-lg hover:scale-[1.02] cursor-pointer' : 'opacity-60 cursor-not-allowed'
        }`}>
            <CardContent className="p-6 h-full flex flex-col">
                <div className="flex items-start justify-between mb-4">
                    <div className={`p-3 rounded-full bg-muted/50`}>
                        <Icon className={`h-6 w-6 ${color}`}/>
                    </div>
                    {badge && (
                        <Badge variant="secondary" className="text-xs">
                            {badge}
                        </Badge>
                    )}
                </div>

                <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">{title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                        {description}
                    </p>
                </div>

                <div className="flex items-center text-sm mt-4">
                    {enabled ? (
                        <>
              <span className="text-primary font-medium">
                {external ? 'Open' : 'Configure'}
              </span>
                            <ArrowRight className="ml-2 h-4 w-4 text-primary"/>
                        </>
                    ) : (
                        <Badge variant="outline"
                               className="border-amber-200 bg-amber-100/50 text-amber-700 dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-400">
                            Requires Public Project
                        </Badge>
                    )}
                </div>
            </CardContent>
        </Card>
    );

    if (!enabled) {
        return content;
    }

    if (onClick) {
        return <div onClick={onClick}>{content}</div>;
    }

    if (href) {
        if (external) {
            return (
                <a href={href} target="_blank" rel="noopener noreferrer">
                    {content}
                </a>
            );
        }
        return <Link href={href}>{content}</Link>;
    }

    return content;
}

interface RecentEntryCardProps {
    entry: {
        id: string;
        title: string;
        version?: string;
        publishedAt?: string;
        createdAt: string;
        tags: Array<{ name: string; color?: string }>;
    };
    projectId: string;
}

function RecentEntryCard({entry, projectId}: RecentEntryCardProps) {
    const isPublished = !!entry.publishedAt;
    const displayDate = entry.publishedAt || entry.createdAt;

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${
                            isPublished ? 'bg-green-500' : 'bg-yellow-500'
                        }`}/>
                        <Badge variant={isPublished ? "default" : "secondary"} className="text-xs">
                            {isPublished ? 'Published' : 'Draft'}
                        </Badge>
                        {entry.version && (
                            <Badge variant="outline" className="text-xs">
                                {entry.version}
                            </Badge>
                        )}
                    </div>
                    <span className="text-xs text-muted-foreground">
            {new Date(displayDate).toLocaleDateString()}
          </span>
                </div>

                <Link
                    href={`/dashboard/projects/${projectId}/changelog/${entry.id}`}
                    className="block group"
                >
                    <h4 className="font-medium group-hover:text-primary transition-colors mb-2 line-clamp-2">
                        {entry.title}
                    </h4>
                </Link>

                {entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                        {entry.tags.slice(0, 3).map((tag, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                                {tag.name}
                            </Badge>
                        ))}
                        {entry.tags.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                                +{entry.tags.length - 3}
                            </Badge>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function ProjectPage({params}: ProjectPageProps) {
    const {projectId} = use(params);
    const queryClient = useQueryClient();
    const {toast} = useToast();

    // Fetch project data
    const {data: project, isLoading: isLoadingProject} = useQuery<Project>({
        queryKey: ['project', projectId],
        queryFn: async () => {
            const response = await fetch(`/api/projects/${projectId}`);
            if (!response.ok) throw new Error('Failed to fetch project');
            return response.json();
        }
    });

    // Fetch user data for permissions
    const {data: user} = useQuery<User>({
        queryKey: ['user'],
        queryFn: async () => {
            const response = await fetch('/api/auth/me');
            if (!response.ok) throw new Error('Failed to fetch user');
            return response.json();
        }
    });

    const handleImportComplete = (result: ImportResult) => {
        toast({
            title: 'Import completed!',
            description: `Successfully imported ${result.importedCount} entries.`,
        });

        // Refresh project data
        queryClient.invalidateQueries({queryKey: ['project', projectId]});
    };

    if (isLoadingProject) {
        return (
            <div className="container max-w-7xl space-y-6 p-4 md:p-8">
                <div className="space-y-4">
                    <div className="h-20 bg-muted rounded-xl animate-pulse"/>
                    <div className="grid gap-4 md:grid-cols-4">
                        {Array.from({length: 4}).map((_, i) => (
                            <div key={i} className="h-32 bg-muted rounded-lg animate-pulse"/>
                        ))}
                    </div>
                    <div className="grid gap-6 md:grid-cols-3">
                        {Array.from({length: 6}).map((_, i) => (
                            <div key={i} className="h-48 bg-muted rounded-lg animate-pulse"/>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!project) {
        return (
            <div className="container max-w-7xl">
                <div className="text-center py-12">
                    <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4"/>
                    <h2 className="text-2xl font-semibold mb-2">Project Not Found</h2>
                    <p className="text-muted-foreground mb-6">
                        The project you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.
                    </p>
                    <Button asChild>
                        <Link href="/dashboard/projects">Back to Projects</Link>
                    </Button>
                </div>
            </div>
        );
    }

    const isAdmin = user?.role === 'ADMIN';
    const hasEntries = project.changelog?.entries && project.changelog.entries.length > 0;
    const recentEntries = project.changelog?.entries.slice(0, 3) || [];
    const publishedCount = project.changelog?.entries.filter(e => e.publishedAt).length || 0;
    const draftCount = project.changelog?.entries.filter(e => !e.publishedAt).length || 0;

    // Show import prompt if no entries and user is admin
    if (!hasEntries && isAdmin) {
        return (
            <div className="container max-w-7xl space-y-6 p-4 md:p-8">
                {/* Project Header */}
                <motion.div
                    initial="initial"
                    animate="animate"
                    variants={fadeIn}
                    className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-background to-muted/60 p-6 rounded-xl border"
                >
                    <div className="flex gap-4 items-center">
                        <Avatar
                            className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-medium text-2xl border-2 border-primary/20">
                            <AvatarFallback>
                                {project.name.substring(0, 1).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight mb-1">{project.name}</h1>
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Badge variant={project.isPublic ? "default" : "secondary"}>
                                    {project.isPublic ? "Public" : "Private"}
                                </Badge>
                                <span className="text-sm">No entries yet</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {project.isPublic && (
                            <Button variant="outline" size="sm" asChild>
                                <Link href={`/changelog/${project.id}`} target="_blank">
                                    <ExternalLink className="h-4 w-4 mr-2"/>
                                    View Public Page
                                </Link>
                            </Button>
                        )}
                        <Button variant="secondary" size="sm" asChild>
                            <Link href={`/dashboard/projects/${project.id}/settings`}>
                                <Settings className="h-4 w-4 mr-2"/>
                                Settings
                            </Link>
                        </Button>
                    </div>
                </motion.div>

                {/* Import State */}
                <EmptyStateWithImport
                    projectId={project.id}
                    projectName={project.name}
                    isAdmin={isAdmin}
                    onImportComplete={handleImportComplete}
                />
            </div>
        );
    }

    return (
        <div className="container max-w-7xl space-y-6 p-4 md:p-8">
            {/* Project Header */}
            <motion.div
                initial="initial"
                animate="animate"
                variants={fadeIn}
                className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-r from-background to-muted/60 p-6 rounded-xl border"
            >
                <div className="flex gap-4 items-center">
                    <Avatar
                        className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-medium text-2xl border-2 border-primary/20">
                        <AvatarFallback>
                            {project.name.substring(0, 1).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight mb-1">{project.name}</h1>
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Badge variant={project.isPublic ? "default" : "secondary"}>
                                {project.isPublic ? "Public" : "Private"}
                            </Badge>
                            {hasEntries && (
                                <span className="text-sm">
                  {project.changelog?.entries.length} entries
                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {project.isPublic && (
                        <Button variant="outline" size="sm" asChild>
                            <Link href={`/changelog/${project.id}`} target="_blank">
                                <ExternalLink className="h-4 w-4 mr-2"/>
                                View Public Page
                            </Link>
                        </Button>
                    )}
                    <Button variant="secondary" size="sm" asChild>
                        <Link href={`/dashboard/projects/${project.id}/settings`}>
                            <Settings className="h-4 w-4 mr-2"/>
                            Settings
                        </Link>
                    </Button>
                </div>
            </motion.div>

            {/* Quick Stats */}
            <motion.div
                initial="initial"
                animate="animate"
                variants={staggerChildren}
                className="grid gap-4 md:grid-cols-4"
            >
                <motion.div variants={fadeIn}>
                    <QuickStatsCard
                        title="Total Entries"
                        value={project.changelog?.entries.length || 0}
                        icon={FileText}
                        color="text-blue-600"
                    />
                </motion.div>
                <motion.div variants={fadeIn}>
                    <QuickStatsCard
                        title="Published"
                        value={publishedCount}
                        subtitle="Live entries"
                        icon={CheckCircle2}
                        color="text-green-600"
                    />
                </motion.div>
                <motion.div variants={fadeIn}>
                    <QuickStatsCard
                        title="Drafts"
                        value={draftCount}
                        subtitle="Pending entries"
                        icon={Clock}
                        color="text-yellow-600"
                    />
                </motion.div>
                <motion.div variants={fadeIn}>
                    <QuickStatsCard
                        title="Last Updated"
                        value={new Date(project.updatedAt).toLocaleDateString()}
                        icon={Calendar}
                        color="text-purple-600"
                    />
                </motion.div>
            </motion.div>

            {/* Catch-Up Section - NEW */}
            <motion.div
                initial="initial"
                animate="animate"
                variants={fadeIn}
            >
                <CatchUpView projectId={projectId} />
            </motion.div>

            {/* Quick Actions */}
            <motion.div
                initial="initial"
                animate="animate"
                variants={fadeIn}
            >
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold">Quick Actions</h2>
                    {hasEntries && isAdmin && (
                        <Button variant="outline" size="sm" asChild>
                            <Link href={`/dashboard/projects/${project.id}/import`}>
                                <Upload className="h-4 w-4 mr-2"/>
                                Import More Data
                            </Link>
                        </Button>
                    )}
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                    <ActionCard
                        title="Create Entry"
                        description="Write a new changelog entry to document your latest updates and features."
                        icon={Plus}
                        href={`/dashboard/projects/${project.id}/changelog/new`}
                        color="text-green-600"
                    />

                    <ActionCard
                        title="View Changelog"
                        description="Browse all your changelog entries, manage drafts, and see publication status."
                        icon={FileText}
                        href={`/dashboard/projects/${project.id}/changelog`}
                        color="text-blue-600"
                    />

                    <ActionCard
                        title="Analytics"
                        description="Track engagement metrics and see how your audience interacts with your changelog."
                        icon={BarChart3}
                        href={`/dashboard/projects/${project.id}/analytics`}
                        color="text-purple-600"
                    />
                </div>
            </motion.div>

            {/* Integrations & Features */}
            <motion.div
                initial="initial"
                animate="animate"
                variants={fadeIn}
            >
                <div className="flex items-center gap-2 mb-6">
                    <h2 className="text-2xl font-bold">Integrations & Features</h2>
                    <Separator className="flex-1"/>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                    <ActionCard
                        title="Widget Embed"
                        description="Add a changelog widget to your website to keep users informed about updates."
                        icon={Code}
                        href={`/dashboard/projects/${project.id}/integrations/widget`}
                        enabled={project.isPublic}
                        color="text-orange-600"
                        badge={project.isPublic ? undefined : "Requires Public"}
                    />

                    <ActionCard
                        title="Email Notifications"
                        description="Send email updates to subscribers when you publish new changelog entries."
                        icon={Mail}
                        href={`/dashboard/projects/${project.id}/integrations/email`}
                        color="text-blue-600"
                    />

                    <ActionCard
                        title="Public Changelog"
                        description="Share your changelog with the world through a beautiful, standalone public page."
                        icon={Globe}
                        href={`/changelog/${project.id}`}
                        enabled={project.isPublic}
                        color="text-green-600"
                        external={true}
                        badge={project.isPublic ? "Live" : "Requires Public"}
                    />

                    <ActionCard
                        title="GitHub Integration"
                        description="Automatically sync commits and releases from your GitHub repository."
                        icon={SiGithub}
                        href={`/dashboard/projects/${project.id}/integrations/github`}
                        color="text-gray-700"
                        badge="Beta"
                    />

                    <ActionCard
                        title="Team Management"
                        description="Manage team members, roles, and permissions for collaborative changelog editing."
                        icon={Users}
                        href={`/dashboard/projects/${project.id}/team`}
                        color="text-indigo-600"
                        badge="Coming Soon"
                        enabled={false}
                    />

                    <ActionCard
                        title="Custom Domain"
                        description="Use your own domain for the public changelog page to maintain brand consistency."
                        icon={Globe}
                        href={`/dashboard/projects/${project.id}/domains`}
                        enabled={project.isPublic}
                        color="text-teal-600"
                        badge={project.isPublic ? undefined : "Requires Public"}
                    />
                </div>
            </motion.div>

            {/* Recent Entries */}
            {hasEntries && (
                <motion.div
                    initial="initial"
                    animate="animate"
                    variants={fadeIn}
                >
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold">Recent Entries</h2>
                            <Badge variant="outline" className="font-normal">
                                {project.changelog?.entries.length || 0} total
                            </Badge>
                        </div>

                        <Button asChild>
                            <Link href={`/dashboard/projects/${project.id}/changelog`}>
                                View All Entries
                                <ArrowRight className="ml-2 h-4 w-4"/>
                            </Link>
                        </Button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        {recentEntries.map((entry) => (
                            <RecentEntryCard
                                key={entry.id}
                                entry={entry}
                                projectId={project.id}
                            />
                        ))}
                    </div>

                    {recentEntries.length === 0 && (
                        <Card>
                            <CardContent className="p-12 text-center">
                                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4"/>
                                <h3 className="text-lg font-semibold mb-2">No entries yet</h3>
                                <p className="text-muted-foreground mb-6">
                                    Get started by creating your first changelog entry.
                                </p>
                                <Button asChild>
                                    <Link href={`/dashboard/projects/${project.id}/changelog/new`}>
                                        <Plus className="h-4 w-4 mr-2"/>
                                        Create First Entry
                                    </Link>
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </motion.div>
            )}
        </div>
    );
}