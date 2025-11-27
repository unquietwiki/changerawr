import { Metadata } from 'next'
import React from "react";
import ScrollToTopButton from "@/components/changelog/ScrollToTopButton";
import { ThemeToggle } from "@/components/changelog/ThemeToggle";
import ButtonGroup from "@/components/changelog/ButtonGroup";

interface ChangelogLayoutProps {
    params: Promise<{ projectId: string }>
    children: React.ReactNode
}

export async function generateMetadata(
    { params }: ChangelogLayoutProps
): Promise<Metadata> {
    const { projectId } = await params

    return {
        metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
        alternates: {
            types: {
                'application/rss+xml': `/api/changelog/${projectId}/rss.xml`,
            },
        },
    }
}

export default async function ChangelogLayout({ children, params }: ChangelogLayoutProps) {
    const { projectId } = await params

    return (
        <div className="container mx-auto py-8">
            {projectId && <ButtonGroup projectId={projectId} />}
            {children}
        </div>
    )
}