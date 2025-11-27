import {Metadata} from 'next'
import React from "react";
import ButtonGroup from "@/components/changelog/ButtonGroup";
import {getDomainByDomain} from '@/lib/custom-domains/service';

interface CustomDomainLayoutProps {
    params: Promise<{
        domain: string;
        path?: string[];
    }>
    children: React.ReactNode
}

export async function generateMetadata(
    {params}: CustomDomainLayoutProps
): Promise<Metadata> {
    const {domain: encodedDomain} = await params;
    const domain = decodeURIComponent(encodedDomain);

    const domainConfig = await getDomainByDomain(domain);

    if (!domainConfig || !domainConfig.verified) {
        return {
            metadataBase: new URL(`https://${domain}`),
        };
    }

    return {
        metadataBase: new URL(`https://${domain}`),
        alternates: {
            types: {
                'application/rss+xml': `/rss.xml`,
            },
        },
    };
}

export default async function CustomDomainLayout({children, params}: CustomDomainLayoutProps) {
    const {domain: encodedDomain} = await params;
    const domain = decodeURIComponent(encodedDomain);

    const domainConfig = await getDomainByDomain(domain);
    const projectId = domainConfig?.projectId;
    const isVerified = domainConfig?.verified;

    return (
        <div className="container mx-auto py-8">
            {isVerified && projectId && <ButtonGroup projectId={projectId} />}
            {children}
        </div>
    );
}