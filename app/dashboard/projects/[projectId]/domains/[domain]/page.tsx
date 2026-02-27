import { Metadata } from 'next'
import { DomainSettingsClient } from './client'

export const metadata: Metadata = {
    title: 'Domain Settings',
    description: 'Manage custom domain settings',
}

interface DomainSettingsPageProps {
    params: Promise<{
        projectId: string
        domain: string
    }>
}

export default async function DomainSettingsPage({ params }: DomainSettingsPageProps) {
    const { projectId, domain } = await params

    return <DomainSettingsClient projectId={projectId} domain={decodeURIComponent(domain)} />
}
