/**
 * Floating Changelog Widget
 * A floating button with badge count that expands to show changelog entries
 */

class ChangelogFloatingWidget {
    constructor(container, options) {
        this.container = container;
        this.options = {
            theme: 'light',
            position: 'bottom-right',
            maxEntries: 3,
            customCSS: null,
            buttonText: 'What\'s New',
            showBadge: true,
            ...options
        };

        this.isOpen = false;
        this.isLoading = false;
        this.unreadCount = 0;
        this.baseUrl = options.baseUrl || process.env.NEXT_PUBLIC_APP_URL || '';
        this.init();
    }

    async loadStyles() {
        // Load core CSS files
        const cssFiles = [
            '/widgets/core/styles/variables.css',
            '/widgets/core/styles/reset.css',
            '/widgets/core/styles/common.css',
            '/widgets/core/styles/floating.css'
        ];

        for (const file of cssFiles) {
            if (!document.querySelector(`link[href="${this.baseUrl}${file}"]`)) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = this.baseUrl + file;
                document.head.appendChild(link);
            }
        }

        // Inject custom CSS if provided
        if (this.options.customCSS) {
            const styleId = `changerawr-custom-css-${this.options.projectId || 'default'}`;
            let customStyle = document.getElementById(styleId);

            if (!customStyle) {
                customStyle = document.createElement('style');
                customStyle.id = styleId;
                document.head.appendChild(customStyle);
            }

            customStyle.textContent = this.options.customCSS;
        }
    }

    updatePosition() {
        // Use CSS classes for positioning
        this.container.classList.remove(
            'changerawr-position-top-right',
            'changerawr-position-top-left',
            'changerawr-position-bottom-right',
            'changerawr-position-bottom-left'
        );
        this.container.classList.add(`changerawr-position-${this.options.position}`);
    }

    async init() {
        await this.loadStyles();

        // Apply base classes
        this.container.classList.add('changerawr-widget', 'changerawr-floating');

        // Apply theme
        if (this.options.theme === 'dark') {
            this.container.classList.add('dark');
        }

        // Apply position
        this.updatePosition();

        // ARIA attributes
        this.container.setAttribute('role', 'region');
        this.container.setAttribute('aria-label', 'Changelog updates');

        this.render();
        await this.loadEntries();
        this.setupKeyboardNavigation();
    }

    setupKeyboardNavigation() {
        this.container.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }

            if (e.key === 'Tab' && this.isOpen) {
                const focusableElements = this.container.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                const firstElement = focusableElements[0];
                const lastElement = focusableElements[focusableElements.length - 1];

                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
            }
        });
    }

    async loadEntries() {
        this.isLoading = true;

        try {
            const response = await fetch(
                `${this.baseUrl}/api/changelog/${this.options.projectId}/entries`
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            this.entries = data.items || [];
            this.project = data.project;

            // Calculate unread count (entries from last 7 days)
            const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            this.unreadCount = this.entries.filter(entry => {
                const entryDate = new Date(entry.createdAt).getTime();
                return entryDate > weekAgo;
            }).length;

            this.updateBadge();
        } catch (error) {
            console.error('Failed to load changelog entries:', error);
            this.unreadCount = 0;
        } finally {
            this.isLoading = false;
        }
    }

    render() {
        // Create floating button
        const button = document.createElement('button');
        button.className = 'changerawr-floating-button';
        button.setAttribute('aria-label', 'Open changelog');
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-haspopup', 'dialog');

        const icon = document.createElement('span');
        icon.className = 'changerawr-floating-icon';
        icon.innerHTML = '📰';

        const text = document.createElement('span');
        text.className = 'changerawr-floating-text';
        text.textContent = this.options.buttonText;

        if (this.options.showBadge) {
            const badge = document.createElement('span');
            badge.className = 'changerawr-floating-badge';
            badge.textContent = '0';
            button.appendChild(badge);
        }

        button.appendChild(icon);
        button.appendChild(text);

        button.addEventListener('click', () => this.toggle());

        // Create popup panel
        const panel = document.createElement('div');
        panel.className = 'changerawr-floating-panel';
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', 'Changelog entries');

        const header = this.createHeader();
        const content = document.createElement('div');
        content.className = 'changerawr-entries';
        const footer = this.createFooter();

        panel.appendChild(header);
        panel.appendChild(content);
        panel.appendChild(footer);

        this.container.innerHTML = '';
        this.container.appendChild(button);
        this.container.appendChild(panel);
    }

    createHeader() {
        const header = document.createElement('div');
        header.className = 'changerawr-header';

        const title = document.createElement('div');
        title.className = 'changerawr-header-title';
        title.textContent = this.project?.name || 'Changelog';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'changerawr-close';
        closeBtn.innerHTML = '✕';
        closeBtn.setAttribute('aria-label', 'Close changelog');
        closeBtn.addEventListener('click', () => this.close());

        header.appendChild(title);
        header.appendChild(closeBtn);

        return header;
    }

    createFooter() {
        const footer = document.createElement('div');
        footer.className = 'changerawr-footer';

        const poweredBy = document.createElement('span');
        poweredBy.innerHTML = 'Powered by <a href="https://changerawr.com" target="_blank" rel="noopener">Changerawr</a>';

        const rssLink = document.createElement('a');
        rssLink.href = `${this.baseUrl}/api/changelog/${this.options.projectId}/rss`;
        rssLink.textContent = 'RSS';
        rssLink.target = '_blank';
        rssLink.rel = 'noopener';

        footer.appendChild(poweredBy);
        footer.appendChild(rssLink);

        return footer;
    }

    updateBadge() {
        if (!this.options.showBadge) return;

        const badge = this.container.querySelector('.changerawr-floating-badge');
        if (!badge) return;

        if (this.unreadCount > 0) {
            badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount.toString();
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    renderEntries() {
        const content = this.container.querySelector('.changerawr-entries');
        if (!content) return;

        content.innerHTML = '';

        if (!this.entries || this.entries.length === 0) {
            content.innerHTML = `
                <div class="changerawr-empty">
                    <div class="changerawr-empty-icon">📰</div>
                    <div class="changerawr-empty-message">No changelog entries yet</div>
                </div>
            `;
            return;
        }

        const entriesToShow = this.entries.slice(0, this.options.maxEntries);

        entriesToShow.forEach((entry, index) => {
            const entryEl = document.createElement('div');
            entryEl.className = 'changerawr-entry';
            entryEl.style.animationDelay = `${index * 0.1}s`;

            // Tags
            if (entry.tags && entry.tags.length > 0) {
                const tagsContainer = document.createElement('div');
                tagsContainer.className = 'changerawr-entry-meta';

                entry.tags.forEach(tag => {
                    const tagEl = document.createElement('span');
                    tagEl.className = 'changerawr-tag';
                    tagEl.textContent = tag.name;
                    if (tag.color) {
                        tagEl.style.backgroundColor = tag.color + '20';
                        tagEl.style.color = tag.color;
                    }
                    tagsContainer.appendChild(tagEl);
                });

                entryEl.appendChild(tagsContainer);
            }

            // Title
            const title = document.createElement('div');
            title.className = 'changerawr-entry-title';
            title.textContent = entry.title;
            entryEl.appendChild(title);

            // Excerpt/Content
            if (entry.excerpt) {
                const excerpt = document.createElement('div');
                excerpt.className = 'changerawr-entry-content';
                excerpt.textContent = entry.excerpt;
                entryEl.appendChild(excerpt);
            }

            // Read more link
            const readMore = document.createElement('a');
            readMore.className = 'changerawr-read-more';
            readMore.href = `${this.baseUrl}/changelog/${this.options.projectId}/${entry.id}`;
            readMore.textContent = 'Read more →';
            readMore.target = '_blank';
            readMore.rel = 'noopener';
            entryEl.appendChild(readMore);

            content.appendChild(entryEl);
        });
    }

    open() {
        if (this.isOpen) return;

        this.isOpen = true;
        this.container.classList.add('open');

        const button = this.container.querySelector('.changerawr-floating-button');
        const panel = this.container.querySelector('.changerawr-floating-panel');

        if (button) {
            button.setAttribute('aria-expanded', 'true');
        }

        if (panel) {
            this.renderEntries();

            // Focus first focusable element after animation
            setTimeout(() => {
                const focusable = panel.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                if (focusable.length > 0) {
                    focusable[0].focus();
                }
            }, 350);
        }
    }

    close() {
        if (!this.isOpen) return;

        this.isOpen = false;
        this.container.classList.remove('open');

        const button = this.container.querySelector('.changerawr-floating-button');

        if (button) {
            button.setAttribute('aria-expanded', 'false');
            button.focus();
        }
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
}

// Export globally for browser
window.ChangerawrWidget = {
    init: (options) => {
        const container = options.container || document.getElementById('changerawr-widget');
        return new ChangelogFloatingWidget(container, options);
    }
};
