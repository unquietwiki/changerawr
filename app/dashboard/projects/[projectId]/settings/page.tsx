'use client'

import {use, useState} from 'react'
import {useRouter} from 'next/navigation'
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {Label} from '@/components/ui/label'
import {Switch} from '@/components/ui/switch'
import {Card, CardContent, CardDescription, CardHeader, CardTitle,} from '@/components/ui/card'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {useToast} from '@/hooks/use-toast'
import {
    AlertTriangle,
    CheckCircle,
    Clock,
    Code,
    ExternalLink,
    Github,
    Globe,
    Loader2,
    Lock,
    Mail,
    Puzzle,
    Rss,
    Settings,
    Shield,
    Tag,
    ArrowRight,
    Slack,
} from 'lucide-react'
import {DestructiveActionRequest} from '@/components/changelog/RequestHandler'
import {useAuth} from '@/context/auth'
import {Alert, AlertDescription} from '@/components/ui/alert'
import TagManagement from "@/components/project/settings/TagManagement";
import {Badge} from '@/components/ui/badge'

interface ProjectSettingsPageProps {
    params: Promise<{ projectId: string }>
}

interface ProjectSettings {
    id: string
    name: string
    isPublic: boolean
    allowAutoPublish: boolean
    requireApproval: boolean
    defaultTags: string[]
    updatedAt: string
}

export default function ProjectSettingsPage({params}: ProjectSettingsPageProps) {
    const {projectId} = use(params)
    const router = useRouter()
    const {toast} = useToast()
    const queryClient = useQueryClient()
    const [activeTab, setActiveTab] = useState('general')
    // const [newTag, setNewTag] = useState('')
    const [isDeleting, setIsDeleting] = useState(false)

    const {user} = useAuth()

    const {data: project, isLoading} = useQuery<ProjectSettings>({
        queryKey: ['project-settings', projectId],
        queryFn: async () => {
            const response = await fetch(`/api/projects/${projectId}/settings`)
            if (!response.ok) throw new Error('Failed to fetch settings')
            return response.json()
        }
    })

    const updateSettings = useMutation({
        mutationFn: async (data: Partial<ProjectSettings>) => {
            const response = await fetch(`/api/projects/${projectId}/settings`, {
                method: 'PATCH',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data)
            })
            if (!response.ok) throw new Error('Failed to update settings')
            return response.json()
        },
        onSuccess: (data) => {
            queryClient.setQueryData(['project-settings', projectId], data)
            toast({title: 'Success', description: 'Settings updated successfully'})
        }
    })

    const deleteProject = useMutation({
        mutationFn: async () => {
            const response = await fetch(`/api/projects/${projectId}`, {
                method: 'DELETE'
            })
            if (!response.ok) throw new Error('Failed to delete project')
        },
        onSuccess: () => {
            toast({title: 'Success', description: 'Project deleted successfully'})
            router.push('/dashboard/projects')
        },
        onSettled: () => {
            setIsDeleting(false)
        }
    })

    if (isLoading || !project) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-pulse">Loading...</div>
            </div>
        )
    }

    const handleUpdate = (field: keyof ProjectSettings, value: unknown) => {
        updateSettings.mutate({[field]: value})
    }

    // const handleAddTag = (e?: React.KeyboardEvent<HTMLInputElement>) => {
    //     if (e && e.key !== 'Enter') return
    //     if (newTag.trim()) {
    //         const updatedTags = Array.from(new Set([...project.defaultTags, newTag.trim()]))
    //         updateSettings.mutate({defaultTags: updatedTags})
    //         setNewTag('')
    //     }
    // }
    //
    // const handleTagDeletion = (tag: string) => {
    //     if (user?.role === 'ADMIN') {
    //         const updatedTags = project.defaultTags.filter(t => t !== tag)
    //         handleUpdate('defaultTags', updatedTags)
    //     }
    // }

    const tabs = [
        {id: 'general', label: 'General', icon: Settings},
        {id: 'access', label: 'Access', icon: Shield},
        {id: 'integrations', label: 'Integrations', icon: Puzzle},
        {id: 'tags', label: 'Tags', icon: Tag},
        {id: 'danger', label: 'Danger', icon: AlertTriangle, className: 'text-destructive'}
    ]

    // Integration definitions - organized for better scalability
    const integrations = [
        {
            id: 'widget',
            name: 'Changelog Widget',
            description: 'Embed a customizable widget into your website',
            icon: Code,
            status: 'stable',
            requiresPublic: true,
            action: {
                type: 'navigate',
                label: 'Configure',
                path: `/dashboard/projects/${projectId}/integrations/widget`
            }
        },
        {
            id: 'email',
            name: 'Email Notifications',
            description: 'Send updates to subscribers via email',
            icon: Mail,
            status: 'stable',
            requiresPublic: false,
            action: {
                type: 'navigate',
                label: 'Configure',
                path: `/dashboard/projects/${projectId}/integrations/email`
            }
        },
        {
            id: 'github',
            name: 'GitHub Integration',
            description: 'Use your GitHub data with changelogs',
            icon: Github,
            status: 'stable',
            requiresPublic: false,
            action: {
                type: 'navigate',
                label: 'Configure',
                path: `/dashboard/projects/${projectId}/integrations/github`
            }
        },
        {
            id: 'rss',
            name: 'RSS Feed',
            description: 'Subscribe to changelog updates',
            icon: Rss,
            status: 'stable',
            requiresPublic: true,
            action: {
                type: 'external',
                label: 'View Feed',
                url: `/changelog/${projectId}/rss.xml`
            }
        },
        {
            id: 'domains',
            name: 'Domains',
            description: 'Configure a custom domain for your public changelog',
            icon: Globe,
            status: 'stable',
            requiresPublic: true,
            action: {
                type: 'navigate',
                label: 'Configure',
                path: `/dashboard/projects/${projectId}/domains`
            }
        },
        {
            id: 'slack',
            name: 'Slack',
            description: 'Post changelog updates to your Slack workspace',
            icon: Slack,
            status: 'stable',
            requiresPublic: false,
            action: {
                type: 'navigate',
                label: 'Configure',
                path: `/dashboard/projects/${projectId}/integrations/slack`
            }
        }
    ]

    const comingSoonIntegrations = ['Discord', 'Teams', 'Zapier', 'Webhook']

    const renderTabContent = () => {
        switch (activeTab) {
            case 'general':
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle>General Settings</CardTitle>
                            <CardDescription>
                                Basic project configuration and details
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Project Name</Label>
                                    <Input
                                        id="name"
                                        value={project.name}
                                        onChange={(e) => handleUpdate('name', e.target.value)}
                                        className="max-w-md"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )

            case 'access':
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle>Access Settings</CardTitle>
                            <CardDescription>
                                Configure visibility and permissions
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6">
                                <div className="flex justify-between items-center">
                                    <div className="space-y-0.5">
                                        <Label>Public Access</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Make changelog visible without authentication
                                        </p>
                                    </div>
                                    <Switch
                                        checked={project.isPublic}
                                        onCheckedChange={(checked) => handleUpdate('isPublic', checked)}
                                    />
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="space-y-0.5">
                                        <Label>Auto-Publish</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Automatically publish new entries
                                        </p>
                                    </div>
                                    <Switch
                                        checked={project.allowAutoPublish}
                                        onCheckedChange={(checked) => handleUpdate('allowAutoPublish', checked)}
                                    />
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="space-y-0.5">
                                        <Label>Require Approval</Label>
                                        <p className="text-sm text-muted-foreground">
                                            Require admin approval for new entries
                                        </p>
                                    </div>
                                    <Switch
                                        checked={project.requireApproval}
                                        onCheckedChange={(checked) => handleUpdate('requireApproval', checked)}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )

            case 'integrations':
                return (
                    <Card className="border-border/50 shadow-sm">
                        <CardHeader className="pb-4">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-primary/10 dark:bg-primary/20">
                                    <Puzzle className="h-4 w-4 text-primary" />
                                </div>
                                <CardTitle className="text-xl">Integrations</CardTitle>
                            </div>
                            <CardDescription className="text-muted-foreground">
                                Connect your changelog with external services and automation tools
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {!project.isPublic && (
                                <Alert icon={<Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />} className="border-amber-200/50 bg-amber-50/50 dark:border-amber-800/50 dark:bg-amber-950/20">
                                    <AlertDescription className="text-amber-800 dark:text-amber-200">
                                        Some integrations require your project to be public. Enable public access to unlock all features.
                                    </AlertDescription>
                                </Alert>
                            )}

                            {/* Available Integrations Grid */}
                            <div className="grid gap-4 md:grid-cols-2">
                                {integrations.map((integration) => {
                                    const Icon = integration.icon
                                    const isBlocked = integration.requiresPublic && !project.isPublic

                                    return (
                                        <Card
                                            key={integration.id}
                                            className={`group relative overflow-hidden transition-all duration-200 ${
                                                isBlocked
                                                    ? 'border-dashed border-border/60 bg-muted/20 opacity-70'
                                                    : 'border-border/50 bg-card hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5'
                                            }`}
                                        >
                                            {/* Accent line for active integrations */}
                                            {!isBlocked && (
                                                <div className="h-0.5 bg-gradient-to-r from-primary/60 via-primary/30 to-transparent" />
                                            )}

                                            <CardContent className="p-5">
                                                <div className="space-y-4">
                                                    {/* Header with icon and status */}
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex items-start gap-3">
                                                            <div className={`p-2.5 rounded-xl transition-colors ${
                                                                isBlocked
                                                                    ? 'bg-muted/60 text-muted-foreground/60'
                                                                    : 'bg-primary/10 text-primary group-hover:bg-primary/15 dark:bg-primary/20 dark:group-hover:bg-primary/25'
                                                            }`}>
                                                                <Icon className="h-5 w-5" />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-2">
                                                                    <h3 className="font-semibold text-foreground">{integration.name}</h3>
                                                                    {integration.status === 'beta' && (
                                                                        <Badge variant="outline" className="text-xs px-2 py-0.5 bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800">
                                                                            <Clock className="h-3 w-3 mr-1" />
                                                                            Beta
                                                                        </Badge>
                                                                    )}
                                                                    {integration.status === 'stable' && (
                                                                        <Badge variant="outline" className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800">
                                                                            <CheckCircle className="h-3 w-3 mr-1" />
                                                                            Stable
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                                                                    {integration.description}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Action area */}
                                                    <div className="flex justify-end pt-2">
                                                        {isBlocked ? (
                                                            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground bg-muted/60 rounded-lg border border-dashed">
                                                                <Lock className="h-4 w-4"/>
                                                                <span>Public project required</span>
                                                            </div>
                                                        ) : (
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    if (integration.action.type === 'navigate') {
                                                                        router.push(integration.action.path!)
                                                                    } else if (integration.action.type === 'external') {
                                                                        window.open(integration.action.url, '_blank')
                                                                    }
                                                                }}
                                                                className="gap-2 transition-all hover:scale-105 hover:shadow-sm bg-background hover:bg-accent"
                                                            >
                                                                {integration.action.label}
                                                                {integration.action.type === 'external' ? (
                                                                    <ExternalLink className="h-4 w-4" />
                                                                ) : (
                                                                    <ArrowRight className="h-4 w-4" />
                                                                )}
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </CardContent>

                                            {/* Subtle overlay for blocked integrations */}
                                            {isBlocked && (
                                                <div className="absolute inset-0 bg-gradient-to-br from-background/10 to-background/30 pointer-events-none" />
                                            )}
                                        </Card>
                                    )
                                })}
                            </div>

                            {/* Coming Soon Section */}
                            <div className="pt-6 border-t border-border/50">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="p-1 rounded bg-muted">
                                        <Clock className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                    <h3 className="text-sm font-medium text-muted-foreground">Coming Soon</h3>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                                    {comingSoonIntegrations.map((name) => (
                                        <div
                                            key={name}
                                            className="group flex items-center justify-center h-14 rounded-lg border border-dashed border-border/60 bg-muted/20 text-xs text-muted-foreground font-medium transition-colors hover:bg-muted/40 hover:border-border"
                                        >
                                            {name}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )

            case 'tags':
                return (
                    <>
                        <TagManagement projectId={project.id}/>
                        {/*TODO: redo this later */}
                        {/*<Card className="mt-4">*/}
                        {/*    <CardHeader>*/}
                        {/*        <CardTitle>Default Tags</CardTitle>*/}
                        {/*        <CardDescription>*/}
                        {/*            Manage default tags for changelog entries*/}
                        {/*        </CardDescription>*/}
                        {/*    </CardHeader>*/}
                        {/*    <CardContent>*/}
                        {/*        <div className="space-y-4">*/}
                        {/*            <div className="flex gap-2">*/}
                        {/*                <div className="relative flex-1 max-w-sm">*/}
                        {/*                    <Input*/}
                        {/*                        value={newTag}*/}
                        {/*                        onChange={(e) => setNewTag(e.target.value)}*/}
                        {/*                        onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}*/}
                        {/*                        placeholder="Add new tag..."*/}
                        {/*                    />*/}
                        {/*                </div>*/}
                        {/*                <Button*/}
                        {/*                    onClick={() => handleAddTag()}*/}
                        {/*                    disabled={!newTag.trim()}*/}
                        {/*                >*/}
                        {/*                    <Plus className="h-4 w-4 mr-2"/>*/}
                        {/*                    Add Tag*/}
                        {/*                </Button>*/}
                        {/*            </div>*/}

                        {/*            <div className="flex flex-wrap gap-2">*/}
                        {/*                {project.defaultTags.map((tag) => (*/}
                        {/*                    <Badge*/}
                        {/*                        key={tag}*/}
                        {/*                        variant="secondary"*/}
                        {/*                        className="flex items-center gap-1 px-3 py-1"*/}
                        {/*                        color={tag.color}*/}
                        {/*                    >*/}
                        {/*                        <Tag className="h-3 w-3"/>*/}
                        {/*                        {tag}*/}
                        {/*                        {user?.role === 'ADMIN' ? (*/}
                        {/*                            <button*/}
                        {/*                                onClick={() => handleTagDeletion(tag)}*/}
                        {/*                                className="ml-1 hover:text-destructive"*/}
                        {/*                            >*/}
                        {/*                                <X className="h-3 w-3"/>*/}
                        {/*                            </button>*/}
                        {/*                        ) : (*/}
                        {/*                            <DestructiveActionRequest*/}
                        {/*                                projectId={projectId}*/}
                        {/*                                action="DELETE_TAG"*/}
                        {/*                                targetId={tag}*/}
                        {/*                                targetName={tag}*/}
                        {/*                            />*/}
                        {/*                        )}*/}
                        {/*                    </Badge>*/}
                        {/*                ))}*/}
                        {/*            </div>*/}
                        {/*        </div>*/}
                        {/*    </CardContent>*/}
                        {/*</Card>*/}
                    </>
                )

            case 'danger':
                return (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-destructive">Danger Zone</CardTitle>
                            <CardDescription>
                                Destructive actions that require approval
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div className="rounded-md border border-destructive p-4">
                                    <h4 className="font-medium mb-2">Delete Project</h4>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        Permanently remove this project and all its data
                                    </p>
                                    {user?.role === 'ADMIN' ? (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="destructive">Delete Project</Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Delete Project?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will permanently delete the project and all associated
                                                        data.
                                                        This action cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction
                                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                        onClick={() => {
                                                            setIsDeleting(true)
                                                            deleteProject.mutate()
                                                        }}
                                                        disabled={isDeleting}
                                                    >
                                                        {isDeleting ? (
                                                            <>
                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin"/>
                                                                Deleting...
                                                            </>
                                                        ) : (
                                                            'Delete Project'
                                                        )}
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    ) : (
                                        <DestructiveActionRequest
                                            projectId={projectId}
                                            action="DELETE_PROJECT"
                                            onSuccess={() => router.push('/dashboard/projects')}
                                        />
                                    )}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )
        }
    }

    return (
        <div className="min-h-screen bg-background">
            <div className="container max-w-screen-xl px-4 py-4 md:py-8">
                <div className="flex flex-col md:flex-row gap-6">
                    {/* Left sidebar */}
                    <div className="w-full md:w-64 shrink-0">
                        <h1 className="text-2xl font-bold mb-4">Settings</h1>
                        <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-4 md:pb-0">
                            {tabs.map(({id, label, icon: Icon, className}) => (
                                <button
                                    key={id}
                                    onClick={() => setActiveTab(id)}
                                    className={`
                                        flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium
                                        ${activeTab === id ? 'bg-secondary' : 'hover:bg-secondary/50'}
                                        ${className || 'text-foreground'}
                                        whitespace-nowrap
                                    `}
                                >
                                    <Icon className="h-4 w-4"/>
                                    {label}
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Main content */}
                    <div className="flex-1">
                        {renderTabContent()}
                    </div>
                </div>
            </div>
        </div>
    )
}