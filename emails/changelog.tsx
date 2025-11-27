import * as React from 'react';
import {
    Html,
    Head,
    Body,
    Container,
    Section,
    Row,
    Column,
    Heading,
    Text,
    Hr,
    Link
} from '@react-email/components';
import { renderMarkdown } from '@/lib/services/core/markdown/useCustomExtensions';

/**
 * Sanitizes HTML to fix malformed tags (unclosed li, p, etc.)
 * This is necessary because the markdown renderer may produce non-strict HTML
 */
function sanitizeHtml(html: string): string {
    // Fix unclosed li tags by ensuring proper closing
    let sanitized = html.replace(/<li>([^<]*)<li>/g, '<li>$1</li><li>');
    sanitized = sanitized.replace(/<li>([^<]*)<\/li><li>/g, '<li>$1</li><li>');

    // Ensure all li tags are properly closed before closing ul/ol
    sanitized = sanitized.replace(/<li>([^<]*)<\/(ul|ol)>/g, '<li>$1</li></$2>');

    // Fix unclosed p tags
    sanitized = sanitized.replace(/<p>([^<]*)<p>/g, '<p>$1</p><p>');
    sanitized = sanitized.replace(/<p>([^<]*)<\/p><p>/g, '<p>$1</p><p>');

    return sanitized;
}

interface Entry {
    id: string;
    title: string;
    content: string;
    version?: string | null;
    publishedAt?: Date | null;
    tags?: { id: string; name: string }[];
}

interface ChangelogEmailProps {
    projectName: string;
    entries: Entry[];
    isDigest?: boolean;
    unsubscribeUrl?: string;
    recipientName?: string; // Added recipient name for personalization
    recipientEmail?: string; // Added recipient email for fallback
    changelogUrl: string,
    customDomain?: string // optional custom domain
}

export const ChangelogEmail: React.FC<ChangelogEmailProps> = ({
                                                                  projectName,
                                                                  entries,
                                                                  isDigest = false,
                                                                  unsubscribeUrl,
                                                                  recipientName,
                                                                  recipientEmail,
                                                                  changelogUrl,
                                                                  customDomain
                                                              }) => {
    const title = isDigest
        ? `${projectName} - Latest Changelog Updates`
        : `${projectName} - ${entries[0]?.title || 'Changelog Update'}`;

    // Create personalized greeting
    const getPersonalizedGreeting = () => {
        if (recipientName) {
            return `Hello ${recipientName},`;
        } else if (recipientEmail) {
            // Extract name from email as fallback (e.g., john.doe@example.com -> John)
            const possibleName = recipientEmail.split('@')[0].split('.')[0];
            const capitalizedName = possibleName.charAt(0).toUpperCase() + possibleName.slice(1);
            return `Hello ${capitalizedName},`;
        }
        return 'Hello,';
    };

    // Use custom domain for branding if available
    const brandDomain = customDomain || changelogUrl

    return (
        <Html>
            <Head>
                <title>{title}</title>
            </Head>
            <Body style={{
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                backgroundColor: '#f6f9fc',
                margin: '0 auto',
                padding: '20px 0'
            }}>
                <Container style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
                    maxWidth: '600px',
                    margin: '0 auto',
                    padding: '20px'
                }}>
                    <Section>
                        <Heading as="h1" style={{
                            color: '#333',
                            fontSize: '24px',
                            fontWeight: 'bold',
                            margin: '10px 0 20px',
                            textAlign: 'center'
                        }}>
                            {projectName} Changelog
                        </Heading>

                        {/* Personalized greeting */}
                        <Text style={{
                            color: '#333',
                            fontSize: '16px',
                            margin: '0 0 15px'
                        }}>
                            {getPersonalizedGreeting()}
                        </Text>

                        <Text style={{
                            color: '#666',
                            fontSize: '16px',
                            margin: '0 0 20px'
                        }}>
                            {isDigest
                                ? `Here are the latest updates to ${projectName} that we wanted to share with you.`
                                : `We've just published a new update to ${projectName} that we wanted to share with you.`
                            }
                        </Text>
                        <Hr style={{ margin: '20px 0' }} />
                    </Section>

                    {entries.map((entry, index) => (
                        <Section key={entry.id} style={{
                            padding: '10px 0',
                            borderBottom: index < entries.length - 1 ? '1px solid #eaeaea' : 'none',
                            marginBottom: '20px'
                        }}>
                            <Row>
                                <Column>
                                    <Heading as="h2" style={{
                                        fontSize: '18px',
                                        fontWeight: 'bold',
                                        margin: '10px 0'
                                    }}>
                                        {entry.title}
                                        {entry.version && (
                                            <Text style={{
                                                color: '#666',
                                                fontSize: '14px',
                                                fontWeight: 'normal',
                                                display: 'inline',
                                                marginLeft: '10px'
                                            }}>
                                                {entry.version}
                                            </Text>
                                        )}
                                    </Heading>

                                    {entry.tags && entry.tags.length > 0 && (
                                        <Row style={{ marginBottom: '10px' }}>
                                            {entry.tags.map(tag => (
                                                <Text key={tag.id} style={{
                                                    backgroundColor: '#f1f5f9',
                                                    borderRadius: '4px',
                                                    color: '#475569',
                                                    display: 'inline-block',
                                                    fontSize: '12px',
                                                    fontWeight: 'normal',
                                                    margin: '0 4px 4px 0',
                                                    padding: '2px 6px'
                                                }}>
                                                    {tag.name}
                                                </Text>
                                            ))}
                                        </Row>
                                    )}

                                    <div
                                        style={{
                                            color: '#333',
                                            fontSize: '14px',
                                            lineHeight: '24px',
                                            margin: '10px 0',
                                        }}
                                        dangerouslySetInnerHTML={{
                                            __html: sanitizeHtml(renderMarkdown(entry.content))
                                        }}
                                    />

                                    {entry.publishedAt && (
                                        <Text style={{
                                            color: '#999',
                                            fontSize: '12px',
                                            margin: '10px 0'
                                        }}>
                                            Published: {new Date(entry.publishedAt).toLocaleDateString()}
                                        </Text>
                                    )}
                                </Column>
                            </Row>
                        </Section>
                    ))}

                    <Section style={{ marginTop: '30px' }}>
                        <Hr style={{ margin: '0 0 20px' }} />
                        <Text style={{
                            color: '#999',
                            fontSize: '12px',
                            textAlign: 'center'
                        }}>
                            Thank you for your continued interest in {projectName}.
                        </Text>
                        <Text style={{
                            color: '#999',
                            fontSize: '12px',
                            textAlign: 'center'
                        }}>
                            You received this email because you&apos;re subscribed to changelog updates for {projectName} | {brandDomain}.
                            {unsubscribeUrl && (
                                <>
                                    <br />
                                    <Link
                                        href={unsubscribeUrl}
                                        style={{
                                            color: '#666',
                                            textDecoration: 'underline',
                                        }}
                                    >
                                        Unsubscribe from these notifications
                                    </Link>
                                </>
                            )}
                        </Text>
                    </Section>
                </Container>
            </Body>
        </Html>
    );
};

export default ChangelogEmail;