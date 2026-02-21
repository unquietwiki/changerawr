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
    Button,
    Preview,
    Tailwind
} from '@react-email/components';

interface SchedulePublishedEmailProps {
    recipientName?: string;
    projectName: string;
    entryTitle: string;
    entryVersion?: string;
    publishedAt: Date;
    viewEntryUrl?: string;
    timezone?: string;
}

export const SchedulePublishedEmail: React.FC<SchedulePublishedEmailProps> = ({
                                                                                  recipientName,
                                                                                  projectName,
                                                                                  entryTitle,
                                                                                  entryVersion,
                                                                                  publishedAt,
                                                                                  viewEntryUrl,
                                                                                  timezone = 'UTC',
                                                                              }) => {
    const formattedDate = publishedAt.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: timezone,
        timeZoneName: 'short'
    });

    const getPersonalizedGreeting = (): string => {
        if (recipientName) {
            return `Hello ${recipientName},`;
        }
        return 'Hello,';
    };

    return (
        <Html>
            <Head/>
            <Preview>
                🎉 &ldquo;{entryTitle}&rdquo; is now live! Your scheduled changelog entry has been published
                successfully.
            </Preview>
            <Tailwind>
                <Body className="bg-slate-50 font-sans py-5">
                    <Container className="bg-white mx-auto p-0 max-w-2xl rounded-xl shadow-lg overflow-hidden">
                        {/* Header with Brand */}
                        <Section className="bg-gradient-to-br from-emerald-600 to-emerald-700 px-6 py-8 text-center">
                            <Row>
                                <Column>
                                    <Text
                                        className="text-white text-sm font-semibold tracking-wide m-0 mb-2 opacity-90">
                                        Changerawr
                                    </Text>
                                    <Heading className="text-white text-3xl font-bold m-0 text-center leading-tight">
                                        <span className="text-3xl mr-2">🎉</span> Your Entry is Live!
                                    </Heading>
                                </Column>
                            </Row>
                        </Section>

                        {/* Main Content */}
                        <Section className="px-6 py-8">
                            <Text className="text-gray-800 text-lg font-semibold leading-6 m-0 mb-5">
                                {getPersonalizedGreeting()}
                            </Text>

                            <Text className="text-gray-600 text-base leading-7 my-4">
                                Great news! Your scheduled changelog
                                entry <strong>&ldquo;{entryTitle}&rdquo;</strong> has
                                been automatically published and is now live for your audience.
                            </Text>

                            {/* Enhanced Entry Details Card */}
                            <Section className="bg-white border-2 border-gray-200 rounded-xl p-6 my-6 shadow-sm">
                                <Row>
                                    <Column>
                                        <div className="border-b border-gray-200 pb-3 mb-4">
                                            <Text className="text-gray-700 text-base font-medium m-0">
                                                📝 Entry Details
                                            </Text>
                                        </div>
                                    </Column>
                                </Row>

                                <Row className="mb-3">
                                    <Column className="w-[30%] align-top pr-3">
                                        <Text className="text-gray-500 text-sm font-medium leading-5 m-0">
                                            Title
                                        </Text>
                                    </Column>
                                    <Column className="w-[70%]">
                                        <Text className="text-gray-800 text-[15px] font-semibold leading-5 m-0">
                                            {entryTitle}
                                        </Text>
                                    </Column>
                                </Row>

                                <Row className="mb-3">
                                    <Column className="w-[30%] align-top pr-3">
                                        <Text className="text-gray-500 text-sm font-medium leading-5 m-0">
                                            Project
                                        </Text>
                                    </Column>
                                    <Column className="w-[70%]">
                                        <Text className="text-gray-800 text-[15px] font-semibold leading-5 m-0">
                                            {projectName}
                                        </Text>
                                    </Column>
                                </Row>

                                <Row className="mb-3">
                                    <Column className="w-[30%] align-top pr-3">
                                        <Text className="text-gray-500 text-sm font-medium leading-5 m-0">
                                            Published
                                        </Text>
                                    </Column>
                                    <Column className="w-[70%]">
                                        <Text className="text-gray-800 text-[15px] font-semibold leading-5 m-0">
                                            {formattedDate}
                                        </Text>
                                    </Column>
                                </Row>

                                {entryVersion && (
                                    <Row className="mb-3">
                                        <Column className="w-[30%] align-top pr-3">
                                            <Text className="text-gray-500 text-sm font-medium leading-5 m-0">
                                                Version
                                            </Text>
                                        </Column>
                                        <Column className="w-[70%]">
                                            <Text className="text-gray-800 text-[15px] font-semibold leading-5 m-0">
                                                {entryVersion}
                                            </Text>
                                        </Column>
                                    </Row>
                                )}

                                {/* Success Badge */}
                                <Section
                                    className="bg-green-50 border border-emerald-500 rounded-md px-3 py-2 mt-4 text-center">
                                    <Text className="text-emerald-700 text-sm font-semibold m-0">
                                        ✅ Successfully Published
                                    </Text>
                                </Section>
                            </Section>

                            <Text className="text-gray-600 text-base leading-7 my-4">
                                Your changelog entry is now visible to your audience.
                            </Text>

                            {/* Enhanced Action Buttons */}
                            <Section className="my-8">
                                {viewEntryUrl && (
                                    <Row className="mb-3">
                                        <Column>
                                            <Button
                                                className="bg-emerald-600 rounded-lg text-white text-base font-semibold no-underline text-center block w-full py-3.5 px-6 border-0 shadow-sm hover:bg-emerald-700"
                                                href={viewEntryUrl}
                                            >
                                                🔗 View Live Entry
                                            </Button>
                                        </Column>
                                    </Row>
                                )}
                            </Section>
                        </Section>

                        <Hr className="border-gray-200 m-0"/>

                        {/* Enhanced Footer */}
                        <Section className="bg-gray-50 p-6 text-center">
                            <Text className="text-gray-500 text-sm leading-5 my-2">
                                <strong>Why did I receive this?</strong><br/>
                                This notification was sent because you scheduled a changelog entry for automatic
                                publishing.
                            </Text>

                            <Text className="text-gray-400 text-xs mt-4 mb-0">
                                Made with ❤️ by <strong>Changerawr</strong>
                            </Text>
                        </Section>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
};

export default SchedulePublishedEmail;