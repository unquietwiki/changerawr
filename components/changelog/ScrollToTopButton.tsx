'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ArrowUp } from 'lucide-react'

export function useScrollVisibility() {
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        const toggleVisibility = () => {
            // Show button when page is scrolled down 300px
            if (window.scrollY > 300) {
                setIsVisible(true)
            } else {
                setIsVisible(false)
            }
        }

        window.addEventListener('scroll', toggleVisibility)

        return () => window.removeEventListener('scroll', toggleVisibility)
    }, [])

    return isVisible
}

export default function ScrollToTopButton() {
    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        })
    }

    return (
        <Button
            size="icon"
            variant="outline"
            className="h-10 w-10 rounded-full backdrop-blur-sm shadow-lg hover:shadow-xl hover:scale-110 active:scale-95 origin-center"
            onClick={scrollToTop}
            aria-label="Scroll to top"
        >
            <ArrowUp className="h-5 w-5" />
        </Button>
    )
}