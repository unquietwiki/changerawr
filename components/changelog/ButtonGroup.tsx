'use client'

import React from 'react'
import ScrollToTopButton from './ScrollToTopButton'
import { ThemeToggle } from './ThemeToggle'
import { useScrollVisibility } from './ScrollToTopButton'

interface ButtonGroupProps {
    projectId: string
}

export default function ButtonGroup({ projectId }: ButtonGroupProps) {
    const scrollVisible = useScrollVisibility()

    return (
        <div className={`fixed flex flex-col gap-2 right-6 md:right-8 z-50 transition-all duration-300 ${
            scrollVisible
                ? 'bottom-6 md:bottom-8'
                : 'bottom-6 md:bottom-8'
        }`}>
            {scrollVisible && <ScrollToTopButton />}
            <ThemeToggle projectId={projectId} />
        </div>
    )
}