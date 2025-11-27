/**
 * Official Slack Logo
 * Used in accordance with Slack's brand guidelines
 * https://slack.com/brand-guidelines
 */
export function SlackLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 270 270"
      className={className}
    >
      <style>{`
        .slack-red { fill: #E01E5A; }
        .slack-cyan { fill: #36C5F0; }
        .slack-green { fill: #2EB67D; }
        .slack-yellow { fill: #ECB22E; }
      `}</style>
      <g>
        <g>
          <path
            className="slack-red"
            d="M99.4,151.2c0,7.1-5.8,12.9-12.9,12.9c-7.1,0-12.9-5.8-12.9-12.9c0-7.1,5.8-12.9,12.9-12.9h12.9V151.2z"
          />
          <path
            className="slack-red"
            d="M105.9,151.2c0-7.1,5.8-12.9,12.9-12.9s12.9,5.8,12.9,12.9v32.3c0,7.1-5.8,12.9-12.9,12.9s-12.9-5.8-12.9-12.9V151.2z"
          />
        </g>
        <g>
          <path
            className="slack-cyan"
            d="M118.8,99.4c-7.1,0-12.9-5.8-12.9-12.9c0-7.1,5.8-12.9,12.9-12.9s12.9,5.8,12.9,12.9v12.9H118.8z"
          />
          <path
            className="slack-cyan"
            d="M118.8,105.9c7.1,0,12.9,5.8,12.9,12.9s-5.8,12.9-12.9,12.9H86.5c-7.1,0-12.9-5.8-12.9-12.9s5.8-12.9,12.9-12.9H118.8z"
          />
        </g>
        <g>
          <path
            className="slack-green"
            d="M170.6,118.8c0-7.1,5.8-12.9,12.9-12.9c7.1,0,12.9,5.8,12.9,12.9s-5.8,12.9-12.9,12.9h-12.9V118.8z"
          />
          <path
            className="slack-green"
            d="M164.1,118.8c0,7.1-5.8,12.9-12.9,12.9c-7.1,0-12.9-5.8-12.9-12.9V86.5c0-7.1,5.8-12.9,12.9-12.9c7.1,0,12.9,5.8,12.9,12.9V118.8z"
          />
        </g>
        <g>
          <path
            className="slack-yellow"
            d="M151.2,170.6c7.1,0,12.9,5.8,12.9,12.9c0,7.1-5.8,12.9-12.9,12.9c-7.1,0-12.9-5.8-12.9-12.9v-12.9H151.2z"
          />
          <path
            className="slack-yellow"
            d="M151.2,164.1c-7.1,0-12.9-5.8-12.9-12.9c0-7.1,5.8-12.9,12.9-12.9h32.3c7.1,0,12.9,5.8,12.9,12.9c0,7.1-5.8,12.9-12.9,12.9H151.2z"
          />
        </g>
      </g>
    </svg>
  )
}