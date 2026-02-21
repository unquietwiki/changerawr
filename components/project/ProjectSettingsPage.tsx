'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Search, Grid, List, Calendar, Star, Sparkles, Settings } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Link from 'next/link'
import { useAuth } from '@/context/auth'
import { Skeleton } from '@/components/ui/skeleton'
import { Project as PrismaProject, Changelog, ChangelogEntry } from '@prisma/client'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useTimezone } from '@/hooks/use-timezone'

// Project interface
interface Project extends PrismaProject {
    entryCount: number
    latestEntry: (ChangelogEntry & { version: string }) | null
    changelog?: Changelog & {
        entries: ChangelogEntry[]
    }
}

// Generate vibrant pastel colors for project cards
const getProjectColor = (id: string) => {
    // Use the project id to generate a consistent color
    const hash = id.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
    const hue = hash % 360;
    return `hsl(${hue}, 85%, 88%)`;
}

// Format date helper function
const formatDate = (dateString: string | number | Date, timeZone = 'UTC') => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone,
    }).format(date)
}

export default function ProjectsPage() {
    const { user } = useAuth()
    const timezone = useTimezone()
    const [searchTerm, setSearchTerm] = useState('')
    const [viewType, setViewType] = useState('grid')
    const [sortOrder, setSortOrder] = useState('newest')

    // Fetch projects data
    const { data: projects, isLoading } = useQuery<Project[]>({
        queryKey: ['projects'],
        queryFn: async () => {
            const response = await fetch('/api/projects', {
                credentials: 'include',
            })
            if (!response.ok) throw new Error('Failed to fetch projects')
            return response.json()
        }
    })

    // Filter projects based on search term
    const filteredProjects = projects?.filter(project =>
        project.name.toLowerCase().includes(searchTerm.toLowerCase())
    ) || []

    // Sort projects based on selected order
    const sortedProjects = [...(filteredProjects || [])].sort((a, b) => {
        if (sortOrder === 'newest') {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        } else if (sortOrder === 'oldest') {
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        } else if (sortOrder === 'name') {
            return a.name.localeCompare(b.name)
        } else if (sortOrder === 'entries') {
            return (b.entryCount || 0) - (a.entryCount || 0)
        }
        return 0
    })

    // Fun empty state component
    const EmptyState = () => (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-64 p-6 text-center bg-muted/30 rounded-lg border-2 border-dashed border-muted"
        >
            <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                transition={{ repeat: Infinity, repeatType: "reverse", duration: 2 }}
            >
                <Sparkles className="h-16 w-16 text-primary mb-4" />
            </motion.div>
            <h3 className="text-xl font-bold mb-2">No projects found</h3>
            <p className="text-muted-foreground mb-4 max-w-md">
                {searchTerm ?
                    `No projects match "${searchTerm}"` :
                    "Start tracking your changelogs by creating your first project!"}
            </p>
            <Link href="/dashboard/projects/new">
                <Button className="hover:opacity-90 transition-opacity">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Project
                </Button>
            </Link>
        </motion.div>
    )

    // Project card animations
    const cardVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: (index: number) => ({
            opacity: 1,
            y: 0,
            transition: {
                delay: index * 0.05,
                duration: 0.3
            }
        }),
        exit: { opacity: 0, scale: 0.9 }
    }

    return (
        <TooltipProvider>
            <div className="space-y-6">
                {/* Header section */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center"
                >
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight mb-1">Your Projects</h2>
                        <p className="text-muted-foreground">
                            {!isLoading && `Manage ${filteredProjects.length} project${filteredProjects.length !== 1 ? 's' : ''}`}
                        </p>
                    </div>
                    <Link href="/dashboard/projects/new">
                        <Button size="lg" className="hover:shadow-md transition-all">
                            <Plus className="w-4 h-4 mr-2" />
                            New Project
                        </Button>
                    </Link>
                </motion.div>

                {/* Search and filters */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="flex flex-col sm:flex-row gap-4 bg-card/30 p-3 rounded-lg"
                >
                    <div className="relative flex-grow">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search projects..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 bg-background/70 border-muted-foreground/20"
                        />
                    </div>

                    <div className="flex gap-2">
                        <Tabs value={sortOrder} onValueChange={setSortOrder} className="w-auto">
                            <TabsList className="bg-muted/60 h-10">
                                <TabsTrigger value="newest" className="text-xs px-3">
                                    Newest
                                </TabsTrigger>
                                <TabsTrigger value="name" className="text-xs px-3">
                                    Name
                                </TabsTrigger>
                                <TabsTrigger value="entries" className="text-xs px-3">
                                    Most Active
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <Tabs value={viewType} onValueChange={setViewType} className="w-auto">
                            <TabsList className="bg-muted/60 h-10">
                                <TabsTrigger value="grid" className="px-3">
                                    <Grid className="h-4 w-4" />
                                </TabsTrigger>
                                <TabsTrigger value="list" className="px-3">
                                    <List className="h-4 w-4" />
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </motion.div>

                {/* Loading skeletons */}
                {isLoading && (
                    viewType === 'grid' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[...Array(6)].map((_, i) => (
                                <Card key={i} className="overflow-hidden">
                                    <CardHeader className="pb-2">
                                        <Skeleton className="h-6 w-3/4 mb-2" />
                                        <Skeleton className="h-4 w-1/2" />
                                    </CardHeader>
                                    <CardContent>
                                        <Skeleton className="h-4 w-full mb-3" />
                                        <Skeleton className="h-4 w-3/4" />
                                    </CardContent>
                                    <CardFooter>
                                        <Skeleton className="h-9 w-full" />
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {[...Array(5)].map((_, i) => (
                                <div key={i} className="flex items-center p-4 border rounded-lg">
                                    <div className="flex-1">
                                        <Skeleton className="h-6 w-1/3 mb-2" />
                                        <Skeleton className="h-4 w-1/4" />
                                    </div>
                                    <Skeleton className="h-9 w-24 mr-2" />
                                    <Skeleton className="h-9 w-24" />
                                </div>
                            ))}
                        </div>
                    )
                )}

                {/* No results */}
                {!isLoading && sortedProjects.length === 0 && <EmptyState />}

                {/* Grid view */}
                {!isLoading && sortedProjects.length > 0 && viewType === 'grid' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        <AnimatePresence>
                            {sortedProjects.map((project, index) => {
                                const projectColor = getProjectColor(project.id);

                                return (
                                    <motion.div
                                        key={project.id}
                                        custom={index}
                                        variants={cardVariants}
                                        initial="hidden"
                                        animate="visible"
                                        exit="exit"
                                        layout
                                        layoutId={`project-${project.id}`}
                                        whileHover={{ y: -5, transition: { duration: 0.2 } }}
                                    >
                                        <Card className="h-full overflow-hidden hover:shadow-lg transition-all cursor-pointer border border-border/60 group">
                                            <div className="h-2 group-hover:h-3 transition-all" style={{ background: projectColor }} />
                                            <CardHeader className="pb-2">
                                                <div className="flex justify-between items-start">
                                                    <CardTitle className="text-xl font-semibold line-clamp-1">{project.name}</CardTitle>
                                                    {project.isPublic && (
                                                        <Badge variant="secondary" className="text-xs">Public</Badge>
                                                    )}
                                                </div>
                                                <CardDescription className="flex items-center gap-1">
                                                    {project.latestEntry?.version ? (
                                                        <>
                                                            <span className="text-xs px-1.5 py-0.5 rounded bg-accent">{project.latestEntry.version}</span>
                                                        </>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground">No versions yet</span>
                                                    )}
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="flex gap-2 flex-wrap">
                                                    <Badge variant="outline" className="flex gap-1 items-center bg-muted/40">
                                                        <Calendar className="h-3 w-3" />
                                                        {formatDate(project.createdAt, timezone)}
                                                    </Badge>
                                                    <Badge variant="outline" className="flex gap-1 items-center bg-muted/40">
                                                        <Star className="h-3 w-3" />
                                                        {project.entryCount || 0} entries
                                                    </Badge>
                                                </div>
                                            </CardContent>
                                            <CardFooter className="pt-2">
                                                <div className="flex gap-2 w-full">
                                                    <Link href={`/dashboard/projects/${project.id}`} className="flex-1">
                                                        <Button variant="secondary" className="w-full">
                                                            View Changelog
                                                        </Button>
                                                    </Link>

                                                    {user?.role === 'ADMIN' && (
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Link href={`/dashboard/projects/${project.id}/settings`}>
                                                                    <Button variant="outline" size="icon" className="h-10 w-10">
                                                                        <Settings className="h-4 w-4" />
                                                                    </Button>
                                                                </Link>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <span>Project Settings</span>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    )}
                                                </div>
                                            </CardFooter>
                                        </Card>
                                    </motion.div>
                                )
                            })}
                        </AnimatePresence>
                    </div>
                )}

                {/* List view */}
                {!isLoading && sortedProjects.length > 0 && viewType === 'list' && (
                    <div className="space-y-3">
                        <AnimatePresence>
                            {sortedProjects.map((project, index) => {
                                const projectColor = getProjectColor(project.id);

                                return (
                                    <motion.div
                                        key={project.id}
                                        custom={index}
                                        variants={cardVariants}
                                        initial="hidden"
                                        animate="visible"
                                        exit="exit"
                                        layout
                                        layoutId={`project-${project.id}-list`}
                                        whileHover={{ x: 4, scale: 1.01, transition: { duration: 0.2 } }}
                                    >
                                        <div
                                            className="flex items-center p-4 border rounded-lg hover:bg-card/50 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
                                        >
                                            <div
                                                className="absolute left-0 top-0 bottom-0 w-1 group-hover:w-1.5 transition-all"
                                                style={{ background: projectColor }}
                                            />

                                            <div className="flex-1 ml-3">
                                                <div className="flex items-center gap-2">
                                                    <Link href={`/dashboard/projects/${project.id}`}>
                                                        <h3 className="font-semibold text-lg hover:text-primary transition-colors">{project.name}</h3>
                                                    </Link>
                                                    {project.isPublic && (
                                                        <Badge variant="secondary" className="text-xs">Public</Badge>
                                                    )}
                                                </div>
                                                <div className="flex gap-3 text-sm text-muted-foreground mt-1">
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        {formatDate(project.createdAt, timezone)}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Star className="h-3 w-3" />
                                                        {project.entryCount || 0} entries
                                                    </span>
                                                    {project.latestEntry?.version && (
                                                        <span className="px-1.5 py-0.5 bg-muted rounded text-xs">
                                                            {project.latestEntry.version}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <Link href={`/dashboard/projects/${project.id}`}>
                                                    <Button variant="secondary" size="sm">
                                                        View Changelog
                                                    </Button>
                                                </Link>

                                                {user?.role === 'ADMIN' && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Link href={`/dashboard/projects/${project.id}/settings`}>
                                                                <Button variant="outline" size="sm">
                                                                    <Settings className="h-4 w-4 mr-1" />
                                                                    Settings
                                                                </Button>
                                                            </Link>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <span>Project Settings</span>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </TooltipProvider>
    )
}