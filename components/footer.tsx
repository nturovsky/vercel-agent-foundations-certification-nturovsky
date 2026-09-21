import { Github } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
        <a
          href="https://vercel.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground transition-colors hover:text-muted-foreground"
          aria-label="Vercel"
        >
          <svg
            className="h-5 w-5"
            viewBox="0 0 76 65"
            fill="currentColor"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
          </svg>
        </a>

        <a
          href="https://github.com/vercel"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground transition-colors hover:text-foreground"
          aria-label="GitHub"
        >
          <Github className="h-5 w-5" />
        </a>
      </div>
    </footer>
  )
}
